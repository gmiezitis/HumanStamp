import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSession, requireWorkspaceAccess } from '@/lib/session';
import { apiError } from '@/lib/api-error';
import { appendEvent } from '@/lib/event-log';

const schema = z
  .object({
    workspaceId: z.string().min(1).optional(),
    workspaceName: z.string().trim().min(1).max(100).optional(),
    clientName: z.string().trim().min(1).max(100),
    projectName: z.string().trim().min(1).max(100),
  })
  .refine((input) => Boolean(input.workspaceId || input.workspaceName));

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const input = schema.parse(await req.json());
    if (input.workspaceId)
      await requireWorkspaceAccess(session.userId, input.workspaceId);
    const project = await prisma.$transaction(async (tx) => {
      const workspaceId =
        input.workspaceId ||
        (
          await tx.workspace.create({
            data: {
              name: input.workspaceName!,
              memberships: {
                create: { userId: session.userId, role: 'owner' },
              },
            },
          })
        ).id;
      if (!input.workspaceId)
        await appendEvent(
          workspaceId,
          'workspace.created',
          'workspace',
          workspaceId,
          { name: input.workspaceName },
          session.userId,
          tx
        );
      const client = await tx.client.create({
        data: { name: input.clientName, workspaceId },
      });
      await appendEvent(
        workspaceId,
        'client.created',
        'client',
        client.id,
        { name: client.name },
        session.userId,
        tx
      );
      const created = await tx.project.create({
        data: { name: input.projectName, clientId: client.id },
      });
      await appendEvent(
        workspaceId,
        'project.created',
        'project',
        created.id,
        { name: created.name, clientId: client.id },
        session.userId,
        tx
      );
      return created;
    });
    return NextResponse.json(
      { project: { id: project.id }, url: `/dashboard/projects/${project.id}` },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error);
  }
}
