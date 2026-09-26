import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspaceAccess } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await params;
    const session = await requireSession();

    const version = await prisma.version.findUnique({
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
    });

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    await requireWorkspaceAccess(session.userId, version.project.client.workspaceId);

    const { getEventLog } = await import('@/lib/event-log');
    const events = await getEventLog(
      version.project.client.workspaceId,
      'version',
      versionId
    );

    const labelEvent = events.find((e) => e.eventType === 'label.applied');
    if (!labelEvent) {
      return NextResponse.json({ error: 'No labeled version found' }, { status: 404 });
    }

    const eventData = JSON.parse(labelEvent.data);
    const labeledVersionId = eventData.labeledVersionId;

    if (!labeledVersionId) {
      return NextResponse.json({ error: 'No labeled version ID in event' }, { status: 404 });
    }

    const labeledVersion = await prisma.version.findUnique({
      where: { id: labeledVersionId },
    });

    if (!labeledVersion) {
      return NextResponse.json({ error: 'Labeled version not found' }, { status: 404 });
    }

    const storage = getStorage();
    const buffer = await storage.get(labeledVersion.storageKey);

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${labeledVersion.filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Download labeled file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
