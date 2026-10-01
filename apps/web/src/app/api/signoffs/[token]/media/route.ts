import { getClientReview } from '@/lib/signoffs';
import { serveVideo } from '@/lib/media';
import { WorkflowError } from '@/lib/workflow';
import { apiError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { review, expired } = await getClientReview(token);
    if (!review.usedAt && (expired || review.cancelledAt))
      throw new WorkflowError(
        'This review link is no longer active. Ask for a new link.',
        410
      );
    return await serveVideo(req, review.version!);
  } catch (error) {
    return apiError(error);
  }
}
export const HEAD = GET;
