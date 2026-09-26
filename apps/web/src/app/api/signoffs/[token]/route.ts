import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { appendEvent } from '@/lib/event-log';
import { z } from 'zod';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const signOff = await prisma.clientSignOff.findUnique({
      where: { token },
      include: {
        project: {
          include: {
            client: true,
            versions: {
              orderBy: { versionNumber: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!signOff) {
      return NextResponse.json({ error: 'Sign-off not found' }, { status: 404 });
    }

    if (signOff.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Sign-off link expired' }, { status: 410 });
    }

    if (signOff.usedAt) {
      return NextResponse.json({ error: 'Sign-off already used' }, { status: 410 });
    }

    return NextResponse.json({ signOff });
  } catch (error) {
    console.error('Get sign-off error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const completeSignOffSchema = z.object({
  decision: z.enum(['approved', 'changes-requested']),
  signerName: z.string().min(1),
  comment: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const signOff = await prisma.clientSignOff.findUnique({
      where: { token },
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

    if (!signOff) {
      return NextResponse.json({ error: 'Sign-off not found' }, { status: 404 });
    }

    if (signOff.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Sign-off link expired' }, { status: 410 });
    }

    if (signOff.usedAt) {
      return NextResponse.json({ error: 'Sign-off already used' }, { status: 410 });
    }

    const body = await req.json();
    const { decision, signerName, comment } = completeSignOffSchema.parse(body);

    const updated = await prisma.clientSignOff.update({
      where: { id: signOff.id },
      data: {
        usedAt: new Date(),
        decision,
        signerName,
        comment,
      },
    });

    await appendEvent(
      signOff.project.client.workspaceId,
      'signoff.completed',
      'signoff',
      signOff.id,
      { decision, signerName, email: signOff.email },
      undefined
    );

    return NextResponse.json({ signOff: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('Complete sign-off error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
