import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { checkWorkspaceAccess } from '../lib/session';

const prisma = new PrismaClient();

describe('Permission Checks', () => {
  let workspace1Id: string;
  let workspace2Id: string;
  let user1Id: string;
  let user2Id: string;

  beforeEach(async () => {
    await prisma.workspaceMembership.deleteMany({});
    await prisma.workspace.deleteMany({});
    await prisma.user.deleteMany({});

    const user1 = await prisma.user.create({
      data: {
        email: 'user1@test.com',
        name: 'User 1',
      },
    });
    user1Id = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: 'user2@test.com',
        name: 'User 2',
      },
    });
    user2Id = user2.id;

    const workspace1 = await prisma.workspace.create({
      data: {
        name: 'Workspace 1',
        memberships: {
          create: {
            userId: user1Id,
            role: 'owner',
          },
        },
      },
    });
    workspace1Id = workspace1.id;

    const workspace2 = await prisma.workspace.create({
      data: {
        name: 'Workspace 2',
        memberships: {
          create: {
            userId: user2Id,
            role: 'owner',
          },
        },
      },
    });
    workspace2Id = workspace2.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should allow access to own workspace', async () => {
    const hasAccess = await checkWorkspaceAccess(user1Id, workspace1Id);
    expect(hasAccess).toBe(true);
  });

  it('should deny access to other workspace', async () => {
    const hasAccess = await checkWorkspaceAccess(user1Id, workspace2Id);
    expect(hasAccess).toBe(false);
  });

  it('should allow access after adding membership', async () => {
    const hasAccessBefore = await checkWorkspaceAccess(user2Id, workspace1Id);
    expect(hasAccessBefore).toBe(false);

    await prisma.workspaceMembership.create({
      data: {
        workspaceId: workspace1Id,
        userId: user2Id,
        role: 'member',
      },
    });

    const hasAccessAfter = await checkWorkspaceAccess(user2Id, workspace1Id);
    expect(hasAccessAfter).toBe(true);
  });

  it('should prevent access to non-existent workspace', async () => {
    const hasAccess = await checkWorkspaceAccess(user1Id, 'non-existent-workspace-id');
    expect(hasAccess).toBe(false);
  });

  it('should prevent data leakage between workspaces', async () => {
    const client1 = await prisma.client.create({
      data: {
        workspaceId: workspace1Id,
        name: 'Client in Workspace 1',
      },
    });

    const client2 = await prisma.client.create({
      data: {
        workspaceId: workspace2Id,
        name: 'Client in Workspace 2',
      },
    });

    const user1CanAccessWorkspace1 = await checkWorkspaceAccess(user1Id, workspace1Id);
    const user1CanAccessWorkspace2 = await checkWorkspaceAccess(user1Id, workspace2Id);

    expect(user1CanAccessWorkspace1).toBe(true);
    expect(user1CanAccessWorkspace2).toBe(false);

    const workspace1Clients = await prisma.client.findMany({
      where: { workspaceId: workspace1Id },
    });

    expect(workspace1Clients.length).toBe(1);
    expect(workspace1Clients[0].id).toBe(client1.id);
  });
});
