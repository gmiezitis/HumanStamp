import { NextRequest, NextResponse } from 'next/server';
import { getReceipt } from '@/lib/receipt';
import { generateReceiptPdf } from '@/lib/export';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import archiver from 'archiver';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  try {
    const { receiptId } = await params;
    const receipt = await getReceipt(receiptId);

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    }

    const payload = JSON.parse(receipt.receiptData);

    const version = await prisma.version.findFirst({
      where: {
        project: {
          name: payload.project.name,
        },
        versionNumber: payload.versionNumber,
      },
      include: {
        project: {
          include: {
            client: {
              include: { workspace: true },
            },
          },
        },
      },
    });

    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    const pdfBuffer = await generateReceiptPdf(receipt);
    archive.append(pdfBuffer, { name: `receipt-${receiptId}.pdf` });

    archive.append(receipt.receiptData, { name: `receipt-${receiptId}.json` });

    const { getEventLog } = await import('@/lib/event-log');
    const events = await getEventLog(
      version.project.client.workspaceId,
      'version',
      version.id
    );

    const labelEvent = events.find((e) => e.eventType === 'label.applied');
    if (labelEvent) {
      const eventData = JSON.parse(labelEvent.data);
      const labeledVersionId = eventData.labeledVersionId;

      if (labeledVersionId) {
        const labeledVersion = await prisma.version.findUnique({
          where: { id: labeledVersionId },
        });

        if (labeledVersion) {
          const storage = getStorage();
          const videoBuffer = await storage.get(labeledVersion.storageKey);
          archive.append(videoBuffer, { name: `labeled-${labeledVersion.filename}` });
        }
      }
    }

    await archive.finalize();

    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));

    await new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve());
      archive.on('error', (err: Error) => reject(err));
    });

    const zipBuffer = Buffer.concat(chunks);

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="evidence-pack-${receiptId}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Evidence pack error:', error);
    return NextResponse.json({ error: 'Failed to generate evidence pack' }, { status: 500 });
  }
}
