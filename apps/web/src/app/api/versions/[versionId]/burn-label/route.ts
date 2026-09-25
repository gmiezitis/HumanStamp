import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspaceAccess } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { enqueueBurnLabel } from '@/lib/queue';
import { z } from 'zod';

const burnLabelSchema = z.object({
  labelText: z.string().min(1),
  corner: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']),
  duration: z.number().optional(),
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
    const { labelText, corner, duration } = burnLabelSchema.parse(body);

    await enqueueBurnLabel({
      versionId,
      workspaceId: version.project.client.workspaceId,
      labelText,
      corner,
      duration: duration || 0,
    });

    return NextResponse.json({ success: true, message: 'Label burn job queued' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Burn label error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
