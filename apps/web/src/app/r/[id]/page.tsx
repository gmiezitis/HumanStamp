import { getReceipt } from '@/lib/receipt';
import { notFound } from 'next/navigation';
import { verify } from '@human-stamp/core';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReceiptPage({ params }: PageProps) {
  const { id } = await params;
  const receipt = await getReceipt(id);

  if (!receipt) {
    notFound();
  }

  const payload = JSON.parse(receipt.receiptData);
  const isValid = await verify(
    receipt.receiptData,
    receipt.signature,
    receipt.publicKey
  );

  return (
    <div className="min-h-screen bg-stone-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <img
            src={`/r/${id}/qr`}
            alt="Receipt QR Card"
            className="max-w-sm mx-auto shadow-lg rounded-lg"
          />
        </div>

        <div className="bg-white shadow-sm border border-stone-200 rounded-lg p-8">
          <h1 className="text-3xl font-bold text-stone-900 mb-2">
            Record of Approval and Disclosure
          </h1>
          <p className="text-sm text-stone-500 mb-6">
            {payload.project.client.name} — {payload.project.name}
          </p>

          <div className="space-y-6">
            <div className="border-b border-stone-200 pb-4">
              <h2 className="text-lg font-semibold text-stone-800 mb-2">
                Signature Verification
              </h2>
              <div className="flex items-center gap-2">
                {isValid ? (
                  <>
                    <span className="text-green-600">✓</span>
                    <span className="text-stone-600">Valid signature</span>
                  </>
                ) : (
                  <>
                    <span className="text-red-600">✗</span>
                    <span className="text-stone-600">Invalid signature</span>
                  </>
                )}
              </div>
            </div>

            <div className="border-b border-stone-200 pb-4">
              <h2 className="text-lg font-semibold text-stone-800 mb-2">
                Version Details
              </h2>
              <div className="space-y-1 font-mono text-sm">
                <div>
                  <span className="text-stone-500">Version:</span>{' '}
                  <span className="text-stone-900">v{payload.versionNumber}</span>
                </div>
                <div>
                  <span className="text-stone-500">Filename:</span>{' '}
                  <span className="text-stone-900">{payload.filename}</span>
                </div>
                <div>
                  <span className="text-stone-500">Claim:</span>{' '}
                  <span className="text-stone-900">{payload.aiClaim}</span>
                </div>
                <div>
                  <span className="text-stone-500">C2PA:</span>{' '}
                  <span className="text-stone-900">
                    {payload.c2paPresent ? 'Present' : 'Not found'}
                  </span>
                </div>
              </div>
            </div>

            {payload.approvals.length > 0 && (
              <div className="border-b border-stone-200 pb-4">
                <h2 className="text-lg font-semibold text-stone-800 mb-2">
                  Internal Approvals
                </h2>
                {payload.approvals.map((approval: any, i: number) => (
                  <div key={i} className="font-mono text-sm mb-2">
                    <div>
                      {approval.approverName && `${approval.approverName}, `}
                      {approval.approverRole} at {approval.company}
                    </div>
                    <div className="text-stone-500 text-xs">
                      {new Date(approval.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {payload.clientSignOffs.length > 0 && (
              <div className="border-b border-stone-200 pb-4">
                <h2 className="text-lg font-semibold text-stone-800 mb-2">
                  Client Sign-offs
                </h2>
                {payload.clientSignOffs.map((signoff: any, i: number) => (
                  <div key={i} className="font-mono text-sm mb-2">
                    <div>
                      {signoff.signerName} ({signoff.email}) — {signoff.decision}
                    </div>
                    <div className="text-stone-500 text-xs">
                      {new Date(signoff.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-b border-stone-200 pb-4">
              <h2 className="text-lg font-semibold text-stone-800 mb-2">
                File Hash (SHA-256)
              </h2>
              <div className="font-mono text-xs text-stone-600 break-all">
                {payload.sha256}
              </div>
            </div>

            {payload.eventChainHead && (
              <div className="border-b border-stone-200 pb-4">
                <h2 className="text-lg font-semibold text-stone-800 mb-2">
                  Event Chain Head
                </h2>
                <div className="font-mono text-xs text-stone-600 break-all">
                  {payload.eventChainHead}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-lg font-semibold text-stone-800 mb-2">
                Created At
              </h2>
              <div className="text-stone-600 text-sm">
                {new Date(payload.createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-md">
            <h3 className="font-semibold text-amber-900 mb-2 text-sm">
              Legal Disclaimer
            </h3>
            <p className="text-xs text-amber-800">
              This record documents approvals and disclosures. It is not legal advice or a 
              certification of compliance. The signature verifies the integrity of this record 
              only—not the truth or authenticity of the media content.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
