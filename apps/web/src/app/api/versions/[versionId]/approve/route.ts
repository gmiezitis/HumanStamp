import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspaceAccess } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { appendEvent } from '@/lib/event-log';
import { z } from 'zod';

const approveSchema = z.object({
  approverName: z.string().optional(),
  approverRole: z.string().min(1),
  company: z.string().min(1),
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
    const { approverName, approverRole, company } = approveSchema.parse(body);

    const approval = await prisma.approval.create({
      data: {
        versionId,
        userId: session.userId,
        approverName,
        approverRole,
        company,
      },
      include: {
        user: true,
      },
    });

    await appendEvent(
      version.project.client.workspaceId,
      'version.approved',
      'approval',
      approval.id,
      { versionId, approverRole, company },
      session.userId
    );

    return NextResponse.json({ approval });
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
    console.error('Approve version error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
