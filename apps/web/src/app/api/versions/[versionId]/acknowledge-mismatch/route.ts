import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspaceAccess } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const ackSchema = z.object({
  note: z.string().min(1),
});

export async function POST(
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

    const body = await req.json();
    const { note } = ackSchema.parse(body);

    await prisma.version.update({
      where: { id: versionId },
      data: {
        mismatchAcked: true,
        mismatchNote: note,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Note required' }, { status: 400 });
    }
    console.error('Acknowledge mismatch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
