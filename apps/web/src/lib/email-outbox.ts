import { randomUUID } from 'crypto';
import { prisma } from './prisma';
import { sendEmail } from './email';

const MAX_ATTEMPTS = 5;
const LEASE_MS = 120_000;

export async function processEmailOutbox(limit = 10, deliver = sendEmail) {
  const now = new Date();
  const due = await prisma.emailDelivery.findMany({
    where: {
      OR: [
        { status: 'pending', retryAt: { lte: now } },
        { status: 'sending', lockedUntil: { lte: now } },
      ],
    },
    orderBy: { retryAt: 'asc' },
    take: limit,
  });
  for (const candidate of due) {
    const leaseToken = randomUUID();
    const claim = await prisma.emailDelivery.updateMany({
      where: {
        id: candidate.id,
        OR: [
          { status: 'pending', retryAt: { lte: now } },
          { status: 'sending', lockedUntil: { lte: now } },
        ],
      },
      data: {
        status: 'sending',
        leaseToken,
        lockedUntil: new Date(Date.now() + LEASE_MS),
        attempts: { increment: 1 },
      },
    });
    if (!claim.count) continue;
    const message = await prisma.emailDelivery.findUniqueOrThrow({
      where: { id: candidate.id },
      include: {
        signOff: {
          include: {
            project: {
              include: {
                versions: {
                  orderBy: { versionNumber: 'desc' },
                  take: 1,
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });
    const review = message.signOff;
    const where = { id: message.id, leaseToken };
    const release = { lockedUntil: null, leaseToken: null };
    if (
      message.kind !== 'decision' &&
      (review.usedAt ||
        review.cancelledAt ||
        review.expiresAt <= new Date() ||
        !review.versionId ||
        review.project.versions[0]?.id !== review.versionId)
    ) {
      await prisma.emailDelivery.updateMany({
        where,
        data: { ...release, status: 'cancelled' },
      });
      continue;
    }
    if (message.attempts > MAX_ATTEMPTS) {
      await prisma.emailDelivery.updateMany({
        where,
        data: {
          ...release,
          status: 'failed',
          lastError: 'RETRY_LIMIT_REACHED',
        },
      });
      continue;
    }
    try {
      const providerMessageId = await deliver({
        id: message.id,
        recipient: message.recipient,
        subject: message.subject,
        body: message.body,
      });
      const result = await prisma.emailDelivery.updateMany({
        where,
        data: {
          ...release,
          status: 'accepted',
          acceptedAt: new Date(),
          providerMessageId,
          lastError: null,
        },
      });
      if (result.count && message.kind === 'reminder') {
        await prisma.clientSignOff.update({
          where: { id: review.id },
          data: { lastReminderAt: new Date() },
        });
      }
    } catch (error) {
      const missingConfiguration =
        error instanceof Error && error.message === 'EMAIL_NOT_CONFIGURED';
      await prisma.emailDelivery.updateMany({
        where,
        data: {
          ...release,
          status:
            missingConfiguration || message.attempts >= MAX_ATTEMPTS
              ? 'failed'
              : 'pending',
          lastError: missingConfiguration
            ? 'EMAIL_NOT_CONFIGURED'
            : 'EMAIL_SEND_FAILED',
          retryAt: new Date(Date.now() + 10_000 * 2 ** (message.attempts - 1)),
        },
      });
    }
  }
}

export function startEmailOutboxWorker() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processEmailOutbox();
    } catch {
      console.error('Email outbox processing failed; will retry.');
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => {
    void tick();
  }, 5_000);
  return () => clearInterval(timer);
}
