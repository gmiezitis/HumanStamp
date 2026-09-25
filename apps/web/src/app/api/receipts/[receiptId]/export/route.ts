import { NextRequest, NextResponse } from 'next/server';
import { exportReceipt } from '@/lib/export';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  try {
    const { receiptId } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'pdf';

    const exported = await exportReceipt(receiptId);

    if (format === 'json') {
      return NextResponse.json(exported.json);
    }

    return new NextResponse(exported.pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="receipt-${receiptId}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
