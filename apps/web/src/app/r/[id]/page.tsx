/* eslint-disable react/no-unescaped-entities */
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
        <div className="mb-8 flex justify-center">
          <div className="bg-white shadow-lg border-2 border-stone-300 rounded-lg p-6 inline-block">
            <img
              src={`/r/${id}/qr`}
              alt="Receipt QR Card"
              className="w-80 h-80 object-contain"
            />
            <p className="text-center text-xs text-stone-500 mt-3">
              Scan to verify this record
            </p>
          </div>
        </div>

        <div className="bg-white shadow-sm border border-stone-200 rounded-lg p-8">
          <div className="border-b border-stone-200 pb-6 mb-6">
            <h1 className="text-3xl font-bold text-stone-900 mb-3">
              Record of Approval and Disclosure
            </h1>
            <div className="text-sm text-stone-600 space-y-1">
              <p><strong>Project:</strong> {payload.project.name}</p>
              <p><strong>Client:</strong> {payload.project.client.name}</p>
            </div>
          </div>

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
              <h2 className="text-lg font-semibold text-stone-800 mb-3">
                Version & AI Disclosure
              </h2>
              <div className="bg-stone-50 rounded p-4 space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-600">Version:</span>
                  <span className="text-stone-900 font-semibold">v{payload.versionNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Filename:</span>
                  <span className="text-stone-900 text-xs">{payload.filename}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">AI Claim:</span>
                  <span className="text-stone-900 font-semibold">{payload.aiClaim}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">C2PA Credentials:</span>
                  <span className="text-stone-900">
                    {payload.c2paPresent ? '✓ Present' : 'Not found'}
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

          <div className="mt-8 space-y-4">
            <div className="flex justify-center gap-4">
              <a
                href={`/api/receipts/${id}/export?format=pdf`}
                download
                className="bg-stone-900 text-white px-6 py-2 rounded hover:bg-stone-800 text-sm"
              >
                Download PDF
              </a>
              <a
                href={`/api/receipts/${id}/export?format=json`}
                download
                className="bg-stone-700 text-white px-6 py-2 rounded hover:bg-stone-800 text-sm"
              >
                Download JSON
              </a>
              <a
                href="/verify"
                className="border border-stone-300 text-stone-900 px-6 py-2 rounded hover:bg-stone-50 text-sm"
              >
                Verify a Video
              </a>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
              <h3 className="font-semibold text-amber-900 mb-2 text-sm">
                Legal Disclaimer
              </h3>
              <p className="text-xs text-amber-800">
                This record documents approvals and disclosures. It is not legal advice or a 
                certification of compliance. The signature verifies the integrity of this record 
                only&mdash;not the truth or authenticity of the media content.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
