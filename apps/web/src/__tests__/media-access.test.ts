import { randomUUID } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma';
import { GET as agencyVideo } from '../app/api/versions/[versionId]/media/route';
import { GET as clientVideo } from '../app/api/signoffs/[token]/media/route';

const current = vi.hoisted(() => ({
  userId: '',
  email: 'agency@example.test',
}));
vi.mock('../lib/session', async (original) => ({
  ...(await original<typeof import('../lib/session')>()),
  requireSession: async () => {
    if (!current.userId) throw new Error('Unauthorized');
    return current;
  },
}));
const opened = vi.hoisted(() => vi.fn());
vi.mock('../lib/storage', () => ({
  getStorage: () => ({
    size: async () => 10,
    stream: async (key: string, range?: { start: number; end: number }) => {
      opened(key);
      const bytes = new TextEncoder().encode(
        key === 'original-cut' ? 'original01' : 'replace002'
      );
      return new ReadableStream({
        start(controller) {
          controller.enqueue(
            range ? bytes.slice(range.start, range.end + 1) : bytes
          );
          controller.close();
        },
      });
    },
  }),
}));

let workspaceId = '',
  userId = '',
  versionId = '',
  projectId = '',
  token = '';
beforeEach(async () => {
  opened.mockClear();
  token = randomUUID();
  const user = await prisma.user.create({
    data: { email: `media-${randomUUID()}@example.test` },
  });
  userId = current.userId = user.id;
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Private agency',
      memberships: { create: { userId, role: 'owner' } },
      clients: {
        create: {
          name: 'Private client',
          projects: { create: { name: 'Private campaign' } },
        },
      },
    },
    include: { clients: { include: { projects: true } } },
  });
  workspaceId = workspace.id;
  projectId = workspace.clients[0].projects[0].id;
  const version = await prisma.version.create({
    data: {
      projectId,
      versionNumber: 1,
      sha256: 'original',
      storageKey: 'original-cut',
      filename: 'private.mp4',
      fileSize: 10,
      aiClaim: 'human',
    },
  });
  versionId = version.id;
  await prisma.clientSignOff.create({
    data: {
      projectId,
      versionId,
      token,
      email: 'client@example.test',
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
});
afterEach(async () => {
  if (workspaceId)
    await prisma.workspace.delete({ where: { id: workspaceId } });
  if (userId) await prisma.user.delete({ where: { id: userId } });
  current.userId = '';
});
const req = () =>
  new Request('http://test/media', { headers: { Range: 'bytes=0-3' } });
const client = (value = token) =>
  clientVideo(req(), { params: Promise.resolve({ token: value }) });
const agency = () =>
  agencyVideo(req(), { params: Promise.resolve({ versionId }) });

describe('private exact-version video access', () => {
  it('authenticated workspace members can seek their cut', async () => {
    const response = await agency();
    expect(response.status).toBe(206);
    expect(await response.text()).toBe('orig');
  });
  it('no session cannot preview any agency file', async () => {
    current.userId = '';
    expect((await agency()).status).toBe(401);
    expect(opened).not.toHaveBeenCalled();
  });
  it('another workspace cannot preview a guessed version ID', async () => {
    current.userId = 'another-workspace-user';
    expect((await agency()).status).toBe(403);
    expect(opened).not.toHaveBeenCalled();
  });
  it('invalid client tokens cannot read storage', async () => {
    expect((await client('invalid-token')).status).toBe(404);
    expect(opened).not.toHaveBeenCalled();
  });
  it('active account-free links serve only their bound file', async () => {
    const response = await client();
    expect(response.status).toBe(206);
    expect(await response.text()).toBe('orig');
    expect(opened).toHaveBeenCalledWith('original-cut');
  });
  it('expired incomplete reviews lose video access', async () => {
    await prisma.clientSignOff.update({
      where: { token },
      data: { expiresAt: new Date(0) },
    });
    expect((await client()).status).toBe(410);
    expect(opened).not.toHaveBeenCalled();
  });
  it('cancelled incomplete reviews lose video access', async () => {
    await prisma.clientSignOff.update({
      where: { token },
      data: { cancelledAt: new Date() },
    });
    expect((await client()).status).toBe(410);
    expect(opened).not.toHaveBeenCalled();
  });
  it('completed links reopen the original video after expiry and replacement', async () => {
    await prisma.clientSignOff.update({
      where: { token },
      data: {
        usedAt: new Date(),
        expiresAt: new Date(0),
        decision: 'approved',
        signerName: 'Reviewer',
      },
    });
    await prisma.version.create({
      data: {
        projectId,
        versionNumber: 2,
        sha256: 'replacement',
        storageKey: 'replacement-cut',
        filename: 'new.mp4',
        fileSize: 10,
        aiClaim: 'human',
      },
    });
    const response = await client();
    expect(response.status).toBe(206);
    expect(await response.text()).toBe('orig');
    expect(opened).toHaveBeenCalledWith('original-cut');
  });
  it('legacy links with no version do not expose a guessed current video', async () => {
    await prisma.clientSignOff.update({
      where: { token },
      data: { versionId: null },
    });
    expect((await client()).status).toBe(410);
    expect(opened).not.toHaveBeenCalled();
  });
});
