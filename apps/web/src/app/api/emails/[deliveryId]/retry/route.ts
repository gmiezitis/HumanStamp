import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession, requireWorkspaceAccess } from '@/lib/session';
import { requireEmailConfiguration } from '@/lib/email';
import {
  lockProject,
  requireCurrentVersion,
  WorkflowError,
} from '@/lib/workflow';
import { apiError } from '@/lib/api-error';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ deliveryId: string }> }
) {
  try {
    const { deliveryId } = await params;
    const session = await requireSession();
    const message = await prisma.emailDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        signOff: { include: { project: { include: { client: true } } } },
      },
    });
    if (!message)
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    await requireWorkspaceAccess(
      session.userId,
      message.signOff.project.client.workspaceId
    );
    requireEmailConfiguration();
    await prisma.$transaction(async (tx) => {
      await lockProject(tx, message.signOff.projectId);
      const review = await tx.clientSignOff.findUniqueOrThrow({
        where: { id: message.signOffId },
      });
      if (message.kind !== 'decision') {
        if (
          !review.versionId ||
          review.usedAt ||
          review.cancelledAt ||
          review.expiresAt <= new Date()
        ) {
          throw new WorkflowError('This review is no longer active.');
        }
        await requireCurrentVersion(tx, review.versionId, review.projectId);
      }
      const result = await tx.emailDelivery.updateMany({
        where: { id: deliveryId, status: 'failed' },
        data: {
          status: 'pending',
          attempts: 0,
          lastError: null,
          retryAt: new Date(),
          lockedUntil: null,
          leaseToken: null,
        },
      });
      if (!result.count)
        throw new WorkflowError(
          'This email is not failed; it may already be queued.'
        );
    });
    return NextResponse.json({ message: 'Email queued for retry.' });
  } catch (error) {
    return apiError(error);
  }
}
