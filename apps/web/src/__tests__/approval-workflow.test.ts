import { randomUUID } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '../lib/prisma';
import {
  createClientSignOff,
  completeClientReview,
  getClientReview,
  remindClientReview,
} from '../lib/signoffs';
import { getWorkflowStatus } from '../lib/workflow';
import { processEmailOutbox } from '../lib/email-outbox';
import { generateReceipt } from '../lib/receipt';
import { generateKeyPair } from '@human-stamp/core';
import { verifyEventChain } from '../lib/event-log';
import { POST as uploadVersion } from '../app/api/projects/[projectId]/versions/route';
import { POST as retryEmail } from '../app/api/emails/[deliveryId]/retry/route';
import { burnLabel } from '../worker';

const session = vi.hoisted(() => ({ userId: '', email: '' }));
vi.mock('../lib/session', async (original) => ({
  ...(await original<typeof import('../lib/session')>()),
  requireSession: vi.fn(async () => session),
}));
vi.mock('../lib/queue', () => ({
  enqueueProcessVideo: vi.fn(async () => 'test-job'),
  getQueue: vi.fn(),
}));
vi.mock('../lib/storage', () => ({
  getStorage: () => ({
    put: vi.fn(async () => {}),
    get: vi.fn(async () => Buffer.from('video')),
  }),
  generateStorageKey: () => 'test-only-storage',
}));
vi.mock('../lib/label-burner', () => ({
  burnLabel: vi.fn(async () => Buffer.from('labelled-output')),
}));
vi.mock('../lib/video-scan', () => ({
  scanVideo: vi.fn(),
  detectMismatch: vi.fn(),
}));

let workspaceId: string;
let projectId: string;
let versionId: string;

async function requestReview(email = 'client@example.test') {
  return createClientSignOff({
    projectId,
    versionId,
    email,
    userId: session.userId,
    requesterEmail: session.email,
  });
}
async function internallyApprove(id = versionId) {
  await prisma.approval.create({
    data: {
      versionId: id,
      userId: session.userId,
      company: 'Test Agency',
      approverRole: 'Producer',
    },
  });
}
async function status(id = versionId) {
  const version = await prisma.version.findUniqueOrThrow({
    where: { id },
    include: { approvals: true, signOffs: true },
  });
  const latest = await prisma.version.findFirstOrThrow({
    where: { projectId },
    orderBy: { versionNumber: 'desc' },
  });
  return getWorkflowStatus({
    versionNumber: version.versionNumber,
    latestVersionNumber: latest.versionNumber,
    approvalCount: version.approvals.length,
    signOffs: version.signOffs,
  });
}
async function addVersion(number: number) {
  return prisma.version.create({
    data: {
      projectId,
      versionNumber: number,
      sha256: `file-${number}`,
      storageKey: 'test',
      filename: `video-${number}.mp4`,
      fileSize: 10,
      aiClaim: 'ai-assisted',
    },
  });
}

beforeEach(async () => {
  workspaceId = '';
  session.userId = '';
  vi.stubEnv('SMTP_HOST', 'test-only.invalid');
  vi.stubEnv('SMTP_FROM', 'no-reply@example.test');
  vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000');
  const keys = await generateKeyPair();
  vi.stubEnv('SIGNING_PRIVATE_KEY', keys.privateKey);
  vi.stubEnv('SIGNING_PUBLIC_KEY', keys.publicKey);
  const user = await prisma.user.create({
    data: { email: `owner-${randomUUID()}@example.test` },
  });
  session.userId = user.id;
  session.email = user.email;
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Workflow test',
      memberships: { create: { userId: user.id, role: 'owner' } },
      clients: {
        create: {
          name: 'Test client',
          projects: { create: { name: 'Exact file test' } },
        },
      },
    },
    include: { clients: { include: { projects: true } } },
  });
  workspaceId = workspace.id;
  projectId = workspace.clients[0].projects[0].id;
  versionId = (await addVersion(1)).id;
});
afterEach(async () => {
  if (workspaceId)
    await prisma.workspace.delete({ where: { id: workspaceId } });
  if (session.userId)
    await prisma.user.delete({ where: { id: session.userId } });
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('Approval communication and version integrity', () => {
  it('atomically saves a fixed-version invitation and one scheduled reminder', async () => {
    const review = await requestReview();
    const messages = await prisma.emailDelivery.findMany({
      where: { signOffId: review.id },
      orderBy: { retryAt: 'asc' },
    });
    expect(review.versionId).toBe(versionId);
    expect(messages.map((m) => m.kind)).toEqual(['invitation', 'reminder']);
    expect(messages[0].body).toContain(`/signoff/${review.token}`);
    expect(messages[1].retryAt.getTime() - Date.now()).toBeGreaterThan(
      23 * 60 * 60 * 1000
    );
    expect(await status()).toBe('awaiting-review');
    expect((await verifyEventChain(workspaceId)).valid).toBe(true);
  });
  it('does not pretend an unconfigured email was sent', async () => {
    vi.stubEnv('SMTP_HOST', '');
    await expect(requestReview()).rejects.toThrow('EMAIL_NOT_CONFIGURED');
    expect(await prisma.clientSignOff.count({ where: { projectId } })).toBe(0);
  });
  it('rejects cross-project version IDs and duplicate recipients', async () => {
    await expect(
      createClientSignOff({
        projectId: 'other-project',
        versionId,
        email: 'client@example.test',
        requesterEmail: session.email,
        userId: session.userId,
      })
    ).rejects.toThrow('Version does not belong');
    await requestReview('CLIENT@example.test');
    await expect(requestReview()).rejects.toThrow('already has a review');
  });
  it('records approval once, queues the agency notification, and cancels reminders', async () => {
    const review = await requestReview();
    await internallyApprove();
    const results = await Promise.allSettled([
      completeClientReview(review.token, {
        decision: 'approved',
        signerName: 'Client',
      }),
      completeClientReview(review.token, {
        decision: 'changes-requested',
        signerName: 'Other',
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await prisma.emailDelivery.count({
        where: { signOffId: review.id, kind: 'decision' },
      })
    ).toBe(1);
    expect(
      await prisma.emailDelivery.count({
        where: { signOffId: review.id, kind: 'reminder', status: 'cancelled' },
      })
    ).toBe(1);
    const recorded = await getClientReview(review.token);
    expect(recorded.canSubmit).toBe(false);
    expect(recorded.review.usedAt).not.toBeNull();
    expect((await verifyEventChain(workspaceId)).valid).toBe(true);
  });
  it('requires every requested client plus internal approval for a final receipt', async () => {
    const first = await requestReview();
    const second = await requestReview('second@example.test');
    await completeClientReview(first.token, {
      decision: 'approved',
      signerName: 'First',
    });
    await internallyApprove();
    expect(await status()).toBe('awaiting-review');
    await expect(generateReceipt(versionId)).rejects.toThrow(
      'final receipt requires'
    );
    await completeClientReview(second.token, {
      decision: 'approved',
      signerName: 'Second',
    });
    expect(await status()).toBe('approved');
    expect(await generateReceipt(versionId)).toBeTruthy();
  });
  it('cannot override requested changes by adding an internal approval', async () => {
    const review = await requestReview();
    await completeClientReview(review.token, {
      decision: 'changes-requested',
      signerName: 'Client',
      comment: 'Fix audio',
    });
    await internallyApprove();
    expect(await status()).toBe('changes-requested');
    await expect(generateReceipt(versionId)).rejects.toThrow(
      'final receipt requires'
    );
  });
  it('a new upload is a draft, supersedes previous approvals and blocks old links', async () => {
    const review = await requestReview();
    await internallyApprove();
    const form = new FormData();
    form.set(
      'file',
      new File(['new video'], 'replacement.mp4', { type: 'video/mp4' })
    );
    form.set('aiClaim', 'ai-assisted');
    const response = await uploadVersion(
      new NextRequest('http://localhost/api/upload', {
        method: 'POST',
        body: form,
      }),
      { params: Promise.resolve({ projectId }) }
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(await status(body.version.id)).toBe('draft');
    expect(await status()).toBe('superseded');
    const original = await getClientReview(review.token);
    expect(original.review.version?.id).toBe(versionId);
    expect(original.canSubmit).toBe(false);
    await expect(
      completeClientReview(review.token, {
        decision: 'approved',
        signerName: 'Client',
      })
    ).rejects.toThrow('no longer available');
  });
  it('labelled output is a separate draft without copied decisions', async () => {
    const review = await requestReview();
    await internallyApprove();
    await completeClientReview(review.token, {
      decision: 'approved',
      signerName: 'Client',
    });
    expect(await status()).toBe('approved');
    await burnLabel({
      versionId,
      workspaceId,
      labelText: 'AI-generated',
      corner: 'top-left',
      duration: 0,
    });
    const latest = await prisma.version.findFirstOrThrow({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
    });
    expect(latest.id).not.toBe(versionId);
    expect(await status(latest.id)).toBe('draft');
    expect(await status()).toBe('superseded');
    expect((await getClientReview(review.token)).review.decision).toBe(
      'approved'
    );
    await expect(generateReceipt(latest.id)).rejects.toThrow(
      'final receipt requires'
    );
    const newReview = await createClientSignOff({
      projectId,
      versionId: latest.id,
      email: 'client@example.test',
      requesterEmail: session.email,
      userId: session.userId,
    });
    await internallyApprove(latest.id);
    await completeClientReview(newReview.token, {
      decision: 'approved',
      signerName: 'Fresh decision',
    });
    const receiptId = await generateReceipt(latest.id);
    const receipt = await prisma.receipt.findUniqueOrThrow({
      where: { id: receiptId },
    });
    expect(JSON.parse(receipt.receiptData).aiLabel.labeledFileSha256).toBe(
      latest.sha256
    );
  });
  it('receipts contain no decisions from other versions of the project', async () => {
    const old = await requestReview();
    await completeClientReview(old.token, {
      decision: 'approved',
      signerName: 'Old client',
    });
    versionId = (await addVersion(2)).id;
    const current = await requestReview('current@example.test');
    await internallyApprove();
    await completeClientReview(current.token, {
      decision: 'approved',
      signerName: 'Current client',
    });
    const id = await generateReceipt(versionId);
    const receipt = await prisma.receipt.findUniqueOrThrow({ where: { id } });
    const payload = JSON.parse(receipt.receiptData);
    expect(
      payload.clientSignOffs.map((s: { signerName: string }) => s.signerName)
    ).toEqual(['Current client']);
    expect(payload.workflowStatus).toBe('approved');
  });
  it('completed decisions can be reopened after expiry; unused expired links cannot submit', async () => {
    const review = await requestReview();
    await completeClientReview(review.token, {
      decision: 'approved',
      signerName: 'Client',
    });
    await prisma.clientSignOff.update({
      where: { id: review.id },
      data: { expiresAt: new Date(0) },
    });
    expect((await getClientReview(review.token)).review.decision).toBe(
      'approved'
    );
    const unused = await requestReview('other@example.test');
    await prisma.clientSignOff.update({
      where: { id: unused.id },
      data: { expiresAt: new Date(0) },
    });
    await expect(
      completeClientReview(unused.token, {
        decision: 'approved',
        signerName: 'Other',
      })
    ).rejects.toThrow('no longer available');
    const renewed = await requestReview('other@example.test');
    expect(renewed.token).not.toBe(unused.token);
    expect((await getClientReview(unused.token)).canSubmit).toBe(false);
  });
  it('legacy project-wide links fail closed instead of displaying the newest file', async () => {
    const legacy = await prisma.clientSignOff.create({
      data: {
        projectId,
        token: randomUUID(),
        email: 'legacy@example.test',
        expiresAt: new Date(Date.now() + 10000),
      },
    });
    await expect(getClientReview(legacy.token)).rejects.toThrow(
      'not tied to a specific file'
    );
  });
});

describe('Durable email outbox', () => {
  it('claims concurrent work once and reports SMTP acceptance, not delivery', async () => {
    await requestReview();
    const deliver = vi.fn(async () => 'smtp-id');
    await Promise.all([
      processEmailOutbox(10, deliver),
      processEmailOutbox(10, deliver),
    ]);
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(
      await prisma.emailDelivery.count({
        where: { signOff: { projectId }, status: 'accepted' },
      })
    ).toBe(1);
  });
  it('persists retry backoff and terminal failure without losing the review', async () => {
    const review = await requestReview();
    const deliver = vi.fn(async () => {
      throw new Error('SMTP timeout');
    });
    await processEmailOutbox(10, deliver);
    let message = await prisma.emailDelivery.findFirstOrThrow({
      where: { signOffId: review.id, kind: 'invitation' },
    });
    expect(message.status).toBe('pending');
    expect(message.attempts).toBe(1);
    expect(message.retryAt.getTime()).toBeGreaterThan(Date.now());
    await prisma.emailDelivery.update({
      where: { id: message.id },
      data: { retryAt: new Date(0), attempts: 4 },
    });
    await processEmailOutbox(10, deliver);
    message = await prisma.emailDelivery.findUniqueOrThrow({
      where: { id: message.id },
    });
    expect(message.status).toBe('failed');
    expect((await getClientReview(review.token)).canSubmit).toBe(true);
  });
  it('recovers abandoned leases after a worker restart', async () => {
    const review = await requestReview();
    await prisma.emailDelivery.updateMany({
      where: { signOffId: review.id, kind: 'invitation' },
      data: {
        status: 'sending',
        lockedUntil: new Date(0),
        leaseToken: 'dead-worker',
      },
    });
    const deliver = vi.fn(async () => 'smtp-id');
    await processEmailOutbox(10, deliver);
    expect(deliver).toHaveBeenCalledTimes(1);
  });
  it('does not send expired, completed or superseded reminders', async () => {
    const review = await requestReview();
    await addVersion(2);
    await prisma.emailDelivery.updateMany({
      where: { signOffId: review.id },
      data: { retryAt: new Date(0) },
    });
    const deliver = vi.fn(async () => 'smtp-id');
    await processEmailOutbox(10, deliver);
    expect(deliver).not.toHaveBeenCalled();
    expect(
      await prisma.emailDelivery.count({
        where: { signOffId: review.id, status: 'cancelled' },
      })
    ).toBe(2);
  });
  it('limits manual reminders and sends the automatic reminder only when due', async () => {
    const review = await requestReview();
    await processEmailOutbox(10, async () => 'smtp-id');
    await expect(remindClientReview(review.id, session.userId)).rejects.toThrow(
      '24 hours'
    );
    await prisma.clientSignOff.update({
      where: { id: review.id },
      data: { createdAt: new Date(Date.now() - 2 * 86400000) },
    });
    await remindClientReview(review.id, session.userId);
    const deliver = vi.fn(async () => 'reminder-id');
    await processEmailOutbox(10, deliver);
    expect(deliver).toHaveBeenCalledTimes(1);
    await expect(remindClientReview(review.id, session.userId)).rejects.toThrow(
      '24 hours'
    );
  });
  it('allows retrying a failed agency notification but rejects another workspace', async () => {
    const review = await requestReview();
    await completeClientReview(review.token, {
      decision: 'approved',
      signerName: 'Client',
    });
    const message = await prisma.emailDelivery.findFirstOrThrow({
      where: { signOffId: review.id, kind: 'decision' },
    });
    await prisma.emailDelivery.update({
      where: { id: message.id },
      data: { status: 'failed' },
    });
    const request = new NextRequest('http://localhost/api/retry', {
      method: 'POST',
    });
    const owner = session.userId;
    session.userId = 'outsider';
    expect(
      (
        await retryEmail(request, {
          params: Promise.resolve({ deliveryId: message.id }),
        })
      ).status
    ).toBe(403);
    session.userId = owner;
    expect(
      (
        await retryEmail(request, {
          params: Promise.resolve({ deliveryId: message.id }),
        })
      ).status
    ).toBe(200);
    expect(
      (
        await prisma.emailDelivery.findUniqueOrThrow({
          where: { id: message.id },
        })
      ).status
    ).toBe('pending');
  });
});
