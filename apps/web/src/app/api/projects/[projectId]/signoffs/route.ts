import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspaceAccess } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { createClientSignOff } from '@/lib/signoffs';
import { apiError } from '@/lib/api-error';
import { getBaseUrl } from '@/lib/url';
import { z } from 'zod';

const schema = z.object({
  email: z.string().trim().email().max(254),
  versionId: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const session = await requireSession();
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { client: true },
    });
    if (!project)
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    await requireWorkspaceAccess(session.userId, project.client.workspaceId);
    const input = schema.parse(await req.json());
    const signOff = await createClientSignOff({
      ...input,
      projectId,
      requesterEmail: session.email,
      userId: session.userId,
    });
    return NextResponse.json(
      {
        signOff: {
          id: signOff.id,
          email: signOff.email,
          versionId: signOff.versionId,
          expiresAt: signOff.expiresAt,
        },
        signOffUrl: `${getBaseUrl()}/signoff/${signOff.token}`,
        message:
          'Invitation queued. A reminder is scheduled after 24 hours if the review is still pending.',
      },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error);
  }
}
