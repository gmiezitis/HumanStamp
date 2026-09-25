import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { findMatchingVersion } from '@/lib/segment-fingerprint';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    let version = await prisma.version.findFirst({
      where: { sha256 },
      include: {
        receipts: true,
        approvals: true,
      },
    });

    let matchType: 'exact' | 'fingerprint' | 'none' = 'none';
    let similarity: number | undefined;
    let changedSpans: any[] = [];
    let afterApproval = false;

    if (version) {
      matchType = 'exact';
    } else {
      const versions = await prisma.version.findMany({
        where: { fingerprint: { not: null } },
        take: 100,
        orderBy: { createdAt: 'desc' },
      });

      const match = await findMatchingVersion(buffer, versions);

      if (match) {
        version = await prisma.version.findUnique({
          where: { id: match.versionId },
          include: {
            receipts: true,
            approvals: true,
          },
        });

        if (version && version.fingerprint) {
          matchType = 'fingerprint';
          similarity = match.similarity;

          const { compareVersionFingerprints, generateSegmentFingerprint } = await import('@/lib/segment-fingerprint');
          
          const uploadedFp = await generateSegmentFingerprint(buffer);
          const storedFp = JSON.parse(version.fingerprint);
          const diff = compareVersionFingerprints(storedFp, uploadedFp);

          changedSpans = diff.changedSpans;
          afterApproval = version.approvals.length > 0 && changedSpans.length > 0;
        }
      }
    }

    if (!version) {
      return NextResponse.json({
        valid: false,
        receipt: null,
        matchType: 'none',
      });
    }

    const receipt = version.receipts[0];

    return NextResponse.json({
      valid: true,
      receipt: receipt ? {
        id: receipt.id,
        versionId: version.id,
        versionNumber: version.versionNumber,
      } : null,
      matchType,
      similarity,
      changedSpans,
      afterApproval,
    });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
