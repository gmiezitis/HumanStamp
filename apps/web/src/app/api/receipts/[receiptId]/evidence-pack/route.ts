import { NextRequest, NextResponse } from 'next/server';
import { getReceipt } from '@/lib/receipt';
import { exportReceipt } from '@/lib/export';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

function createZipFile(files: Array<{ name: string; data: Buffer }>): Buffer {
  const crc32 = (buf: Buffer): number => {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crc ^ buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  };

  const entries: Buffer[] = [];
  const centralDir: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const filename = Buffer.from(file.name, 'utf8');
    const data = file.data;
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30 + filename.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(filename.length, 26);
    localHeader.writeUInt16LE(0, 28);
    filename.copy(localHeader, 30);

    entries.push(localHeader, data);

    const cdHeader = Buffer.alloc(46 + filename.length);
    cdHeader.writeUInt32LE(0x02014b50, 0);
    cdHeader.writeUInt16LE(20, 4);
    cdHeader.writeUInt16LE(20, 6);
    cdHeader.writeUInt16LE(0, 8);
    cdHeader.writeUInt16LE(0, 10);
    cdHeader.writeUInt16LE(0, 12);
    cdHeader.writeUInt16LE(0, 14);
    cdHeader.writeUInt32LE(crc, 16);
    cdHeader.writeUInt32LE(data.length, 20);
    cdHeader.writeUInt32LE(data.length, 24);
    cdHeader.writeUInt16LE(filename.length, 28);
    cdHeader.writeUInt16LE(0, 30);
    cdHeader.writeUInt16LE(0, 32);
    cdHeader.writeUInt16LE(0, 34);
    cdHeader.writeUInt16LE(0, 36);
    cdHeader.writeUInt32LE(0, 38);
    cdHeader.writeUInt32LE(offset, 42);
    filename.copy(cdHeader, 46);

    centralDir.push(cdHeader);
    offset += localHeader.length + data.length;
  }

  const cdSize = centralDir.reduce((sum, buf) => sum + buf.length, 0);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...entries, ...centralDir, eocd]);
}

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

    const files: Array<{ name: string; data: Buffer }> = [];

    const exportData = await exportReceipt(receiptId);
    files.push({
      name: `receipt-${receiptId}.pdf`,
      data: exportData.pdf,
    });

    files.push({
      name: `receipt-${receiptId}.json`,
      data: Buffer.from(JSON.stringify(exportData.json, null, 2), 'utf8'),
    });

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
          try {
            const storage = getStorage();
            const videoBuffer = await storage.get(labeledVersion.storageKey);
            files.push({
              name: `labeled-${labeledVersion.filename}`,
              data: videoBuffer,
            });
          } catch (e) {
            console.error('Failed to fetch labeled video:', e);
          }
        }
      }
    }

    const zipBuffer = createZipFile(files);

    return new NextResponse(zipBuffer as unknown as BodyInit, {
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
