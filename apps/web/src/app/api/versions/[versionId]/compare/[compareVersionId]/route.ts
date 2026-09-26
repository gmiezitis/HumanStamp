import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspaceAccess } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { compareVersionFingerprints, type VideoFingerprint } from '@/lib/segment-fingerprint';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string; compareVersionId: string }> }
) {
  try {
    const { versionId, compareVersionId } = await params;
    const session = await requireSession();

    const [version1, version2] = await Promise.all([
      prisma.version.findUnique({
        where: { id: versionId },
        include: {
          project: {
            include: {
              client: {
                include: { workspace: true },
              },
            },
          },
        },
      }),
      prisma.version.findUnique({
        where: { id: compareVersionId },
        include: {
          project: {
            include: {
              client: {
                include: { workspace: true },
              },
            },
          },
        },
      }),
    ]);

    if (!version1 || !version2) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    if (version1.projectId !== version2.projectId) {
      return NextResponse.json({ error: 'Versions must be from the same project' }, { status: 400 });
    }

    await requireWorkspaceAccess(session.userId, version1.project.client.workspaceId);

    if (!version1.fingerprint || !version2.fingerprint) {
      return NextResponse.json({ error: 'Fingerprints not yet generated' }, { status: 202 });
    }

    const fp1: VideoFingerprint = JSON.parse(version1.fingerprint);
    const fp2: VideoFingerprint = JSON.parse(version2.fingerprint);

    const diff = compareVersionFingerprints(fp1, fp2);

    return NextResponse.json({
      diff,
      version1: {
        id: version1.id,
        versionNumber: version1.versionNumber,
        filename: version1.filename,
      },
      version2: {
        id: version2.id,
        versionNumber: version2.versionNumber,
        filename: version2.filename,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Compare versions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
