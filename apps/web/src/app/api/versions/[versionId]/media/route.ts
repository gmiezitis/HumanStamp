import { prisma } from '@/lib/prisma';
import { requireSession, requireWorkspaceAccess } from '@/lib/session';
import { serveVideo } from '@/lib/media';
import { WorkflowError } from '@/lib/workflow';
import { apiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const session = await requireSession();
    const { versionId } = await params;
    const version = await prisma.version.findUnique({
      where: { id: versionId },
      include: { project: { include: { client: true } } },
    });
    if (!version) throw new WorkflowError('Version not found', 404);
    await requireWorkspaceAccess(
      session.userId,
      version.project.client.workspaceId
    );
    return await serveVideo(req, version);
  } catch (error) {
    return apiError(error);
  }
}
export const HEAD = GET;
