import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { appendEvent, verifyEventChain } from '../lib/event-log';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

describe('Event Log and Chain Verification', () => {
  let workspaceId: string;

  beforeEach(async () => {
    await prisma.eventLog.deleteMany({});
    await prisma.workspace.deleteMany({});

    const workspace = await prisma.workspace.create({
      data: { name: 'Test Workspace' },
    });
    workspaceId = workspace.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create a valid event chain', async () => {
    await appendEvent(workspaceId, 'workspace.created', 'workspace', workspaceId, { name: 'Test' });
    await appendEvent(workspaceId, 'client.created', 'client', 'client-1', { name: 'Client' });
    await appendEvent(workspaceId, 'project.created', 'project', 'project-1', { name: 'Project' });

    const result = await verifyEventChain(workspaceId);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should detect tampered event data', async () => {
    await appendEvent(workspaceId, 'workspace.created', 'workspace', workspaceId, { name: 'Original' });
    await appendEvent(workspaceId, 'client.created', 'client', 'client-1', { name: 'Client' });

    const event = await prisma.eventLog.findFirst({
      where: { workspaceId, eventType: 'client.created' },
    });

    await prisma.eventLog.update({
      where: { id: event!.id },
      data: { data: JSON.stringify({ name: 'Tampered' }) },
    });

    const result = await verifyEventChain(workspaceId);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Hash mismatch');
  });

  it('should detect broken chain link', async () => {
    await appendEvent(workspaceId, 'workspace.created', 'workspace', workspaceId, { name: 'Test' });
    await appendEvent(workspaceId, 'client.created', 'client', 'client-1', { name: 'Client' });
    await appendEvent(workspaceId, 'project.created', 'project', 'project-1', { name: 'Project' });

    const secondEvent = await prisma.eventLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      skip: 1,
      take: 1,
    });

    await prisma.eventLog.update({
      where: { id: secondEvent[0].id },
      data: { previousHash: 'tampered-hash' },
    });

    const result = await verifyEventChain(workspaceId);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Chain broken');
  });

  it('should handle empty event chain', async () => {
    const result = await verifyEventChain(workspaceId);
    expect(result.valid).toBe(true);
  });

  it('should correctly link events in sequence', async () => {
    await appendEvent(workspaceId, 'workspace.created', 'workspace', workspaceId, { name: 'Test' });
    
    const events = await prisma.eventLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });

    expect(events[0].previousHash).toBeNull();

    await appendEvent(workspaceId, 'client.created', 'client', 'client-1', { name: 'Client' });

    const updatedEvents = await prisma.eventLog.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });

    expect(updatedEvents[1].previousHash).toBe(updatedEvents[0].eventHash);
  });
});
