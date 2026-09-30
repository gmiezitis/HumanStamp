import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspaceAccess } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { appendEvent } from '@/lib/event-log';
import { z } from 'zod';
import { lockProject, requireCurrentVersion } from '@/lib/workflow';
import { apiError } from '@/lib/api-error';

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

    await requireWorkspaceAccess(
      session.userId,
      version.project.client.workspaceId
    );

    const body = await req.json();
    const { approverName, approverRole, company } = approveSchema.parse(body);

    const approval = await prisma.$transaction(async (tx) => {
      await lockProject(tx, version.projectId);
      await requireCurrentVersion(tx, versionId, version.projectId);
      const created = await tx.approval.create({
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
        created.id,
        { versionId, approverRole, company },
        session.userId,
        tx
      );
      return created;
    });

    return NextResponse.json({ approval });
  } catch (error) {
    return apiError(error);
  }
}
