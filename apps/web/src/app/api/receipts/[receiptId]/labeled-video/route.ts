import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  try {
    const { receiptId } = await params;
    
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
    });

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    const payload = JSON.parse(receipt.receiptData);
    
    if (!payload.aiLabel || !payload.aiLabel.labeledVersionId) {
      return NextResponse.json({ error: 'No labeled video for this receipt' }, { status: 404 });
    }

    const labeledVersion = await prisma.version.findUnique({
      where: { id: payload.aiLabel.labeledVersionId },
    });

    if (!labeledVersion || !labeledVersion.storageKey) {
      return NextResponse.json({ error: 'Labeled video file not found' }, { status: 404 });
    }

    const storage = getStorage();
    const fileBuffer = await storage.read(labeledVersion.storageKey);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${labeledVersion.filename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error serving labeled video:', error);
    return NextResponse.json({ error: 'Failed to retrieve labeled video' }, { status: 500 });
  }
}
