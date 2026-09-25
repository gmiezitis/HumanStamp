import { prisma } from './prisma';
import { createHash } from 'crypto';

export type EventType = 
  | 'workspace.created'
  | 'client.created'
  | 'project.created'
  | 'version.uploaded'
  | 'version.approved'
  | 'signoff.requested'
  | 'signoff.completed'
  | 'label.applied'
  | 'receipt.generated';

export interface EventData {
  [key: string]: any;
}

export async function appendEvent(
  workspaceId: string,
  eventType: EventType,
  entityType: string,
  entityId: string,
  data: EventData,
  actorId?: string
): Promise<void> {
  const lastEvent = await prisma.eventLog.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  });

  const previousHash = lastEvent?.eventHash || null;
  
  const eventPayload = {
    eventType,
    entityType,
    entityId,
    actorId: actorId || null,
    data: JSON.stringify(data),
    previousHash,
    timestamp: new Date().toISOString(),
  };

  const eventHash = createHash('sha256')
    .update(JSON.stringify(eventPayload))
    .digest('hex');

  await prisma.eventLog.create({
    data: {
      workspaceId,
      eventType,
      entityType,
      entityId,
      actorId: actorId || null,
      data: JSON.stringify(data),
      previousHash,
      eventHash,
    },
  });
}

export async function verifyEventChain(workspaceId: string): Promise<{ valid: boolean; error?: string }> {
  const events = await prisma.eventLog.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
  });

  if (events.length === 0) {
    return { valid: true };
  }

  let expectedPreviousHash: string | null = null;

  for (const event of events) {
    if (event.previousHash !== expectedPreviousHash) {
      return {
        valid: false,
        error: `Chain broken at event ${event.id}: expected previousHash ${expectedPreviousHash}, got ${event.previousHash}`,
      };
    }

    const eventPayload: {
      eventType: string;
      entityType: string;
      entityId: string;
      actorId: string | null;
      data: string;
      previousHash: string | null;
      timestamp: string;
    } = {
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      actorId: event.actorId,
      data: event.data,
      previousHash: event.previousHash,
      timestamp: event.createdAt.toISOString(),
    };

    const computedHash = createHash('sha256')
      .update(JSON.stringify(eventPayload))
      .digest('hex');

    if (computedHash !== event.eventHash) {
      return {
        valid: false,
        error: `Hash mismatch at event ${event.id}`,
      };
    }

    expectedPreviousHash = event.eventHash;
  }

  return { valid: true };
}

export async function getEventChainHead(workspaceId: string): Promise<string | null> {
  const lastEvent = await prisma.eventLog.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  });

  return lastEvent?.eventHash || null;
}
