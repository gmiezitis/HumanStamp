import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { POST } from '../app/api/onboarding/project/route';
import { verifyEventChain } from '../lib/event-log';
import { aiClaimLabel } from '../lib/ai-claim';

const session = vi.hoisted(() => ({ userId: '', email: '' }));
vi.mock('../lib/session', async (original) => ({
  ...(await original<typeof import('../lib/session')>()),
  requireSession: async () => {
    if (!session.userId) throw new Error('Unauthorized');
    return session;
  },
}));
let userId = '';
const workspaces: string[] = [];
beforeEach(async () => {
  const user = await prisma.user.create({
    data: { email: `onboarding-${randomUUID()}@example.test` },
  });
  userId = session.userId = user.id;
  session.email = user.email;
});
afterEach(async () => {
  for (const id of workspaces.splice(0))
    await prisma.workspace.delete({ where: { id } });
  await prisma.user.delete({ where: { id: userId } });
  session.userId = '';
});
const input = {
  workspaceName: 'Test agency',
  clientName: 'Test brand',
  projectName: 'Final cut',
};
const create = (body: unknown) =>
  POST(
    new NextRequest('http://test/api/onboarding/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );

describe('one-form agency activation', () => {
  it('creates owned workspace, client and project atomically with audit history', async () => {
    const response = await create(input);
    expect(response.status).toBe(201);
    const data = await response.json();
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: data.project.id },
      include: {
        client: { include: { workspace: { include: { memberships: true } } } },
      },
    });
    const workspace = project.client.workspace;
    workspaces.push(workspace.id);
    expect(workspace.memberships[0]).toMatchObject({ userId, role: 'owner' });
    expect(project.name).toBe('Final cut');
    expect(data.url).toBe(`/dashboard/projects/${project.id}`);
    expect((await verifyEventChain(workspace.id)).valid).toBe(true);
    expect(
      await prisma.emailDelivery.count({
        where: { signOff: { projectId: project.id } },
      })
    ).toBe(0);
    expect(
      await prisma.version.count({ where: { projectId: project.id } })
    ).toBe(0);
  });
  it('can use an accessible existing workspace without creating another one', async () => {
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Existing agency',
        memberships: { create: { userId, role: 'owner' } },
      },
    });
    workspaces.push(workspace.id);
    const response = await create({
      workspaceId: workspace.id,
      clientName: 'New brand',
      projectName: 'New cut',
    });
    expect(response.status).toBe(201);
    expect(
      await prisma.workspace.count({
        where: { memberships: { some: { userId } } },
      })
    ).toBe(1);
    expect(
      await prisma.client.count({ where: { workspaceId: workspace.id } })
    ).toBe(1);
  });
  it('cannot put a campaign into another agency workspace', async () => {
    const workspace = await prisma.workspace.create({
      data: { name: 'Other agency' },
    });
    workspaces.push(workspace.id);
    expect((await create({ ...input, workspaceId: workspace.id })).status).toBe(
      403
    );
    expect(
      await prisma.client.count({ where: { workspaceId: workspace.id } })
    ).toBe(0);
  });
  it('requires an authenticated account', async () => {
    session.userId = '';
    expect((await create(input)).status).toBe(401);
  });
  it.each([
    { ...input, workspaceName: ' ' },
    { ...input, clientName: ' ' },
    { ...input, projectName: '' },
  ])('rejects incomplete setup without creating anything', async (body) => {
    expect((await create(body)).status).toBe(400);
    expect(
      await prisma.workspace.count({
        where: { memberships: { some: { userId } } },
      })
    ).toBe(0);
  });
  it('uses clear disclosure labels without turning unknown claims into human-made', () => {
    expect(aiClaimLabel('human+ai')).toBe('Human + AI tools');
    expect(aiClaimLabel('ai-assisted')).toBe('Human + AI tools');
    expect(aiClaimLabel('unknown')).toContain('Unrecognized');
  });
});
