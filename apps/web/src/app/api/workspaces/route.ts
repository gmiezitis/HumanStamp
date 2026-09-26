import { NextRequest, NextResponse } from 'next/server';
import { requireSession, getUserWorkspaces } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { appendEvent } from '@/lib/event-log';
import { z } from 'zod';

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET() {
  try {
    const session = await requireSession();
    const workspaces = await getUserWorkspaces(session.userId);
    return NextResponse.json({ workspaces });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get workspaces error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const { name } = createWorkspaceSchema.parse(body);

    const workspace = await prisma.workspace.create({
      data: {
        name,
        memberships: {
          create: {
            userId: session.userId,
            role: 'owner',
          },
        },
      },
    });

    await appendEvent(
      workspace.id,
      'workspace.created',
      'workspace',
      workspace.id,
      { name },
      session.userId
    );

    return NextResponse.json({ workspace });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Create workspace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
