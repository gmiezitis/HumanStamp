import { NextRequest, NextResponse } from 'next/server';
import { requireSession, requireWorkspaceAccess } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { appendEvent } from '@/lib/event-log';
import { getStorage, generateStorageKey } from '@/lib/storage';
import { enqueueProcessVideo } from '@/lib/queue';
import { createHash } from 'crypto';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const session = await requireSession();

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: {
          include: { workspace: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await requireWorkspaceAccess(session.userId, project.client.workspaceId);

    const versions = await prisma.version.findMany({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
      include: {
        approvals: {
          include: { user: true },
        },
        _count: {
          select: { approvals: true },
        },
      },
    });

    return NextResponse.json({ versions });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Get versions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const session = await requireSession();

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: {
          include: { workspace: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await requireWorkspaceAccess(session.userId, project.client.workspaceId);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const aiClaim = formData.get('aiClaim') as string;

    if (!file || !aiClaim) {
      return NextResponse.json({ error: 'File and aiClaim required' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    const lastVersion = await prisma.version.findFirst({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
    });

    const versionNumber = (lastVersion?.versionNumber || 0) + 1;

    const storageKey = generateStorageKey(
      project.client.workspaceId,
      projectId,
      file.name
    );

    const storage = getStorage();
    await storage.put(storageKey, buffer, file.type);

    const version = await prisma.version.create({
      data: {
        projectId,
        versionNumber,
        sha256,
        storageKey,
        filename: file.name,
        fileSize: buffer.length,
        aiClaim,
      },
    });

    await appendEvent(
      project.client.workspaceId,
      'version.uploaded',
      'version',
      version.id,
      { versionNumber, filename: file.name, aiClaim },
      session.userId
    );

    await enqueueProcessVideo({
      versionId: version.id,
      workspaceId: project.client.workspaceId,
    });

    return NextResponse.json({ version });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Create version error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
