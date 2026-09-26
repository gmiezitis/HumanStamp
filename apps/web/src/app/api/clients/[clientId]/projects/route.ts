import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspaceAccess } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { appendEvent } from '@/lib/event-log';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const session = await requireSession();

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { workspace: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    await requireWorkspaceAccess(session.userId, client.workspaceId);

    const projects = await prisma.project.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { versions: true },
        },
      },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Get projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const session = await requireSession();

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { workspace: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    await requireWorkspaceAccess(session.userId, client.workspaceId);

    const body = await req.json();
    const { name } = createProjectSchema.parse(body);

    const project = await prisma.project.create({
      data: {
        clientId,
        name,
      },
    });

    await appendEvent(
      client.workspaceId,
      'project.created',
      'project',
      project.id,
      { name, clientId },
      session.userId
    );

    return NextResponse.json({ project });
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
    console.error('Create project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
