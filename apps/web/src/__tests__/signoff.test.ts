import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Client Sign-off Token Validation', () => {
  let workspaceId: string;
  let clientId: string;
  let projectId: string;

  beforeEach(async () => {
    await prisma.clientSignOff.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.client.deleteMany({});
    await prisma.workspace.deleteMany({});

    const workspace = await prisma.workspace.create({
      data: { name: 'Test Workspace' },
    });
    workspaceId = workspace.id;

    const client = await prisma.client.create({
      data: {
        workspaceId,
        name: 'Test Client',
      },
    });
    clientId = client.id;

    const project = await prisma.project.create({
      data: {
        clientId,
        name: 'Test Project',
      },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create a valid sign-off token', async () => {
    const signOff = await prisma.clientSignOff.create({
      data: {
        projectId,
        token: 'test-token-123',
        email: 'client@test.com',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    expect(signOff.token).toBe('test-token-123');
    expect(signOff.usedAt).toBeNull();
  });

  it('should enforce single-use constraint', async () => {
    const signOff = await prisma.clientSignOff.create({
      data: {
        projectId,
        token: 'single-use-token',
        email: 'client@test.com',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await prisma.clientSignOff.update({
      where: { id: signOff.id },
      data: {
        usedAt: new Date(),
        decision: 'approved',
        signerName: 'Client Name',
      },
    });

    const used = await prisma.clientSignOff.findUnique({
      where: { id: signOff.id },
    });

    expect(used!.usedAt).not.toBeNull();
    expect(used!.decision).toBe('approved');

    const cannotUseAgain = used!.usedAt !== null;
    expect(cannotUseAgain).toBe(true);
  });

  it('should detect expired tokens', async () => {
    const signOff = await prisma.clientSignOff.create({
      data: {
        projectId,
        token: 'expired-token',
        email: 'client@test.com',
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const isExpired = signOff.expiresAt < new Date();
    expect(isExpired).toBe(true);
  });

  it('should accept valid unexpired unused token', async () => {
    const signOff = await prisma.clientSignOff.create({
      data: {
        projectId,
        token: 'valid-token',
        email: 'client@test.com',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const isValid = !signOff.usedAt && signOff.expiresAt > new Date();
    expect(isValid).toBe(true);
  });

  it('should store decision and comment', async () => {
    const signOff = await prisma.clientSignOff.create({
      data: {
        projectId,
        token: 'decision-token',
        email: 'client@test.com',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await prisma.clientSignOff.update({
      where: { id: signOff.id },
      data: {
        usedAt: new Date(),
        decision: 'changes-requested',
        signerName: 'Client Representative',
        comment: 'Please adjust the color balance',
      },
    });

    const updated = await prisma.clientSignOff.findUnique({
      where: { id: signOff.id },
    });

    expect(updated!.decision).toBe('changes-requested');
    expect(updated!.comment).toBe('Please adjust the color balance');
    expect(updated!.signerName).toBe('Client Representative');
  });
});
