import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspaceAccess } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { appendEvent } from '@/lib/event-log';
import { getBaseUrl } from '@/lib/url';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const createSignOffSchema = z.object({
  email: z.string().email(),
  versionId: z.string().optional(),
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
      include: {
        client: {
          include: { workspace: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await requireWorkspaceAccess(session.userId, project.client.workspaceId);

    const body = await req.json();
    const { email, versionId } = createSignOffSchema.parse(body);

    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const signOff = await prisma.clientSignOff.create({
      data: {
        projectId,
        versionId,
        token,
        email,
        expiresAt,
      },
    });

    await appendEvent(
      project.client.workspaceId,
      'signoff.requested',
      'signoff',
      signOff.id,
      { email, versionId },
      session.userId
    );

    const baseUrl = getBaseUrl();
    const signOffUrl = `${baseUrl}/signoff/${token}`;

    return NextResponse.json({ signOff, signOffUrl });
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
    console.error('Create sign-off error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
