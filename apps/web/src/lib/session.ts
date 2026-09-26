import { cookies } from 'next/headers';
import { prisma } from './prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const SESSION_COOKIE_NAME = 'humanstamp_session';

export interface SessionData {
  userId: string;
  email: string;
}

export function createSessionToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifySessionToken(token: string): SessionData | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as SessionData;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

export async function requireSession(): Promise<SessionData> {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function getUserWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMembership.findMany({
    where: { userId },
    include: {
      workspace: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return memberships.map((m) => ({
    ...m.workspace,
    role: m.role,
  }));
}

export async function checkWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
  });

  return !!membership;
}

export async function requireWorkspaceAccess(userId: string, workspaceId: string): Promise<void> {
  const hasAccess = await checkWorkspaceAccess(userId, workspaceId);
  if (!hasAccess) {
    throw new Error('Forbidden: No access to workspace');
  }
}
