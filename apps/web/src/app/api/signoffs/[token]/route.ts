import { NextRequest, NextResponse } from 'next/server';
import { completeClientReview, getClientReview } from '@/lib/signoffs';
import { apiError } from '@/lib/api-error';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { review, superseded, expired, canSubmit } =
      await getClientReview(token);
    return NextResponse.json(
      {
        signOff: {
          id: review.id,
          email: review.email,
          expiresAt: review.expiresAt,
          usedAt: review.usedAt,
          decision: review.decision,
          signerName: review.signerName,
          comment: review.comment,
          superseded,
          expired,
          canSubmit,
          cancelled: Boolean(review.cancelledAt),
          notificationStatus: review.emails[0]?.status || null,
          project: {
            name: review.project.name,
            client: { name: review.project.client.name },
          },
          version: {
            id: review.version!.id,
            versionNumber: review.version!.versionNumber,
            filename: review.version!.filename,
            sha256: review.version!.sha256,
            aiClaim: review.version!.aiClaim,
          },
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return apiError(error);
  }
}

const schema = z.object({
  decision: z.enum(['approved', 'changes-requested']),
  signerName: z.string().trim().min(1).max(200),
  comment: z.string().trim().max(5000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await completeClientReview(
      token,
      schema.parse(await req.json())
    );
    return NextResponse.json({
      signOff: {
        usedAt: result.signOff.usedAt,
        decision: result.signOff.decision,
        signerName: result.signOff.signerName,
        comment: result.signOff.comment,
      },
      notificationQueued: result.notificationQueued,
    });
  } catch (error) {
    return apiError(error);
  }
}
