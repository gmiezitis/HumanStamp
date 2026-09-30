import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireWorkspaceAccess } from '@/lib/session';
import { remindClientReview } from '@/lib/signoffs';
import { apiError } from '@/lib/api-error';

// This management endpoint receives a review ID, never a client bearer token.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token: id } = await params;
    const session = await requireSession();
    const review = await prisma.clientSignOff.findUnique({
      where: { id },
      include: { project: { include: { client: true } } },
    });
    if (!review)
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    await requireWorkspaceAccess(
      session.userId,
      review.project.client.workspaceId
    );
    return NextResponse.json(await remindClientReview(id, session.userId));
  } catch (error) {
    return apiError(error);
  }
}
