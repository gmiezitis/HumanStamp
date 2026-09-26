import { ImageResponse } from 'next/og';
import { getReceipt } from '@/lib/receipt';
import QRCode from 'qrcode';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const receipt = await getReceipt(id);

    if (!receipt) {
      return new Response('Receipt not found', { status: 404 });
    }

    const payload = JSON.parse(receipt.receiptData);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const receiptUrl = `${baseUrl}/r/${id}`;

    const qrDataUrl = await QRCode.toDataURL(receiptUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    return new ImageResponse(
      (
        <div
          style={{
            width: '600px',
            height: '800px',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#fafaf9',
            padding: '40px',
            fontFamily: 'monospace',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              flex: 1,
            }}
          >
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1c1917' }}>
              Human Stamp Receipt
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '14px', color: '#78716c' }}>Project</div>
              <div style={{ fontSize: '18px', color: '#1c1917' }}>
                {`${payload.project.client.name} — ${payload.project.name}`}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '14px', color: '#78716c' }}>Version</div>
              <div style={{ fontSize: '18px', color: '#1c1917' }}>
                {`v${payload.versionNumber} • ${payload.filename}`}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '14px', color: '#78716c' }}>Claim</div>
              <div style={{ fontSize: '18px', color: '#1c1917' }}>{payload.aiClaim}</div>
            </div>

            {payload.approvals.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '14px', color: '#78716c' }}>Approved by</div>
                <div style={{ fontSize: '16px', color: '#1c1917' }}>
                  {`${payload.approvals[0].approverRole} at ${payload.approvals[0].company}`}
                </div>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                marginTop: 'auto',
              }}
            >
              <img src={qrDataUrl} width="200" height="200" alt="QR Code" />
              <div style={{ fontSize: '12px', color: '#78716c' }}>
                Scan to view full receipt
              </div>
            </div>

            <div
              style={{
                fontSize: '10px',
                color: '#a8a29e',
                textAlign: 'center',
                marginTop: '20px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div>This record documents approvals and disclosures.</div>
              <div>It is not legal advice or a certification of compliance.</div>
            </div>
          </div>
        </div>
      ),
      {
        width: 600,
        height: 800,
      }
    );
  } catch (error) {
    console.error('QR card error:', error);
    return new Response('Error generating QR card', { status: 500 });
  }
}
