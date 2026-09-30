import { prisma } from './prisma';
import { nanoid } from 'nanoid';
import { appendEvent } from './event-log';
import { getBaseUrl } from './url';
import { requireEmailConfiguration } from './email';
import { lockProject, requireCurrentVersion, WorkflowError } from './workflow';
import type { Prisma } from '@prisma/client';

const DAY = 24 * 60 * 60 * 1000;
export const emailSummarySelect = {
  id: true,
  kind: true,
  status: true,
  attempts: true,
  acceptedAt: true,
  lastError: true,
  retryAt: true,
  createdAt: true,
} satisfies Prisma.EmailDeliverySelect;

function reviewEmail(
  email: string,
  projectName: string,
  versionNumber: number,
  token: string
) {
  return {
    recipient: email,
    subject: `Review requested: ${projectName} — v${versionNumber}`,
    body: `Please review version ${versionNumber} of ${projectName}.\n\n${getBaseUrl()}/signoff/${token}\n\nThis link is tied to this exact version and expires after 7 days. If a new file replaces it, a new review is required.`,
  };
}

export async function createClientSignOff(input: {
  projectId: string;
  versionId: string;
  email: string;
  requesterEmail: string;
  userId: string;
}) {
  requireEmailConfiguration();
  return prisma.$transaction(async (tx) => {
    await lockProject(tx, input.projectId);
    const version = await requireCurrentVersion(
      tx,
      input.versionId,
      input.projectId
    );
    const project = await tx.project.findUniqueOrThrow({
      where: { id: input.projectId },
      include: { client: true },
    });
    const email = input.email.trim().toLowerCase();
    const duplicate = await tx.clientSignOff.findFirst({
      where: { versionId: version.id, email, cancelledAt: null },
    });
    if (duplicate) {
      if (!duplicate.usedAt && duplicate.expiresAt <= new Date()) {
        await tx.clientSignOff.update({
          where: { id: duplicate.id },
          data: { cancelledAt: new Date() },
        });
        await tx.emailDelivery.updateMany({
          where: {
            signOffId: duplicate.id,
            status: { in: ['pending', 'failed'] },
          },
          data: { status: 'cancelled' },
        });
      } else {
        throw new WorkflowError(
          'This client already has a review request for this version. Use its reminder or retry action.'
        );
      }
    }
    const signOff = await tx.clientSignOff.create({
      data: {
        projectId: input.projectId,
        versionId: version.id,
        email,
        token: nanoid(32),
        expiresAt: new Date(Date.now() + 7 * DAY),
        requestedByEmail: input.requesterEmail,
      },
    });
    const message = reviewEmail(
      email,
      project.name,
      version.versionNumber,
      signOff.token
    );
    await tx.emailDelivery.createMany({
      data: [
        {
          ...message,
          signOffId: signOff.id,
          kind: 'invitation',
          dedupeKey: `invitation:${signOff.id}`,
        },
        {
          ...message,
          subject: `Reminder: ${message.subject}`,
          signOffId: signOff.id,
          kind: 'reminder',
          dedupeKey: `reminder:${signOff.id}`,
          retryAt: new Date(Date.now() + DAY),
        },
      ],
    });
    await appendEvent(
      project.client.workspaceId,
      'signoff.requested',
      'signoff',
      signOff.id,
      { email, versionId: version.id },
      input.userId,
      tx
    );
    return signOff;
  });
}

export async function getClientReview(token: string) {
  const review = await prisma.clientSignOff.findUnique({
    where: { token },
    include: {
      version: true,
      project: {
        include: {
          client: true,
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            select: { id: true },
          },
        },
      },
      emails: { where: { kind: 'decision' }, select: emailSummarySelect },
    },
  });
  if (!review) throw new WorkflowError('Sign-off not found', 404);
  // Do not guess which file an old, project-wide approval referred to.
  if (!review.version || review.version.projectId !== review.projectId) {
    throw new WorkflowError(
      'This legacy link is not tied to a specific file. Ask the agency for a new review link.',
      410
    );
  }
  const superseded = review.project.versions[0]?.id !== review.version.id;
  const expired = review.expiresAt <= new Date();
  return {
    review,
    superseded,
    expired,
    canSubmit: !review.usedAt && !review.cancelledAt && !superseded && !expired,
  };
}

export async function completeClientReview(
  token: string,
  input: {
    decision: 'approved' | 'changes-requested';
    signerName: string;
    comment?: string;
  }
) {
  return prisma.$transaction(async (tx) => {
    const found = await tx.clientSignOff.findUnique({ where: { token } });
    if (!found) throw new WorkflowError('Sign-off not found', 404);
    await lockProject(tx, found.projectId);
    const review = await tx.clientSignOff.findUniqueOrThrow({
      where: { id: found.id },
      include: { project: { include: { client: true } } },
    });
    if (review.usedAt)
      throw new WorkflowError(
        'This decision has already been recorded. Reload to view it.'
      );
    if (review.cancelledAt || review.expiresAt <= new Date())
      throw new WorkflowError(
        'This review link is no longer available. Ask the agency for a new link.',
        410
      );
    if (!review.versionId)
      throw new WorkflowError('This link is not tied to a specific file.', 410);
    const version = await requireCurrentVersion(
      tx,
      review.versionId,
      review.projectId
    );
    const signOff = await tx.clientSignOff.update({
      where: { id: review.id },
      data: { ...input, usedAt: new Date() },
    });
    await tx.emailDelivery.updateMany({
      where: {
        signOffId: review.id,
        kind: { in: ['invitation', 'reminder'] },
        status: { in: ['pending', 'failed'] },
      },
      data: { status: 'cancelled' },
    });
    let notificationQueued = false;
    if (review.requestedByEmail) {
      await tx.emailDelivery.create({
        data: {
          signOffId: review.id,
          kind: 'decision',
          dedupeKey: `decision:${review.id}`,
          recipient: review.requestedByEmail,
          subject: `${input.decision === 'approved' ? 'Client approved' : 'Changes requested'}: ${review.project.name} — v${version.versionNumber}`,
          body: `${input.signerName} submitted “${input.decision}” for version ${version.versionNumber} of ${review.project.name}.\n\n${input.comment || 'No comment supplied.'}\n\nOpen the project record: ${getBaseUrl()}/dashboard/projects/${review.projectId}/versions/${version.id}\n\nThis is a workflow decision from the holder of the review link, not independently verified identity.`,
        },
      });
      notificationQueued = true;
    }
    await appendEvent(
      review.project.client.workspaceId,
      'signoff.completed',
      'signoff',
      review.id,
      { ...input, email: review.email, versionId: version.id },
      undefined,
      tx
    );
    return { signOff, notificationQueued };
  });
}

// Called only after the route verifies workspace membership.
export async function remindClientReview(id: string, userId: string) {
  requireEmailConfiguration();
  return prisma.$transaction(async (tx) => {
    const found = await tx.clientSignOff.findUnique({ where: { id } });
    if (!found) throw new WorkflowError('Sign-off not found', 404);
    await lockProject(tx, found.projectId);
    const review = await tx.clientSignOff.findUniqueOrThrow({
      where: { id },
      include: { project: { include: { client: true } } },
    });
    if (
      !review.versionId ||
      review.usedAt ||
      review.cancelledAt ||
      review.expiresAt <= new Date()
    ) {
      throw new WorkflowError(
        'Only an active, incomplete review can be reminded.'
      );
    }
    const version = await requireCurrentVersion(
      tx,
      review.versionId,
      review.projectId
    );
    const emails = await tx.emailDelivery.findMany({
      where: { signOffId: id, kind: { in: ['invitation', 'reminder'] } },
    });
    const failed = emails.find((e) => e.status === 'failed');
    if (failed) {
      await tx.emailDelivery.update({
        where: { id: failed.id },
        data: {
          status: 'pending',
          attempts: 0,
          lastError: null,
          retryAt: new Date(),
        },
      });
      return { message: 'Failed email queued for retry.' };
    }
    if (
      emails.some(
        (e) =>
          e.status === 'sending' ||
          (e.status === 'pending' && e.retryAt <= new Date())
      )
    ) {
      throw new WorkflowError('An email is already queued or being sent.');
    }
    const lastContact = Math.max(
      review.createdAt.getTime(),
      review.lastReminderAt?.getTime() || 0
    );
    if (Date.now() - lastContact < DAY)
      throw new WorkflowError('Reminders are limited to once every 24 hours.');
    const scheduled = emails.find(
      (e) => e.kind === 'reminder' && e.status === 'pending'
    );
    if (scheduled) {
      await tx.emailDelivery.update({
        where: { id: scheduled.id },
        data: { retryAt: new Date() },
      });
    } else {
      const message = reviewEmail(
        review.email,
        review.project.name,
        version.versionNumber,
        review.token
      );
      await tx.emailDelivery.create({
        data: {
          ...message,
          subject: `Reminder: ${message.subject}`,
          signOffId: id,
          kind: 'reminder',
          dedupeKey: `reminder:${id}:${nanoid()}`,
        },
      });
    }
    // Reserve the cooldown immediately to prevent duplicate manual reminders.
    await tx.clientSignOff.update({
      where: { id },
      data: { lastReminderAt: new Date() },
    });
    await appendEvent(
      review.project.client.workspaceId,
      'signoff.reminded',
      'signoff',
      id,
      { versionId: version.id },
      userId,
      tx
    );
    return { message: 'Reminder queued.' };
  });
}
