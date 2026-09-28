import { getReceipt } from '@/lib/receipt';
import { notFound } from 'next/navigation';
import { verify } from '@human-stamp/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle2, XCircle, Download, FileCheck, Users, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted print:bg-white">
      <div className="max-w-4xl mx-auto px-6 py-12 print:py-6">
        <div className="text-center mb-8 print:mb-4">
          <div className="inline-flex items-center gap-2 mb-4">
            <Shield className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Human Stamp</h1>
          </div>
          <p className="text-muted-foreground">Approval and Disclosure Record</p>
        </div>

        <div className="mb-8 flex justify-center print:hidden">
          <Card className="inline-block">
            <CardContent className="p-6">
              <img
                src={`/r/${id}/qr`}
                alt="Receipt QR Card"
                className="w-80 h-80 object-contain mx-auto"
              />
              <p className="text-center text-xs text-muted-foreground mt-3">
                Scan to verify this record
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-xl print:shadow-none">
          <CardHeader className="border-b bg-card">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">
                  Record of Approval and Disclosure
                </CardTitle>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Project:</span> <span className="font-semibold">{payload.project.name}</span></p>
                  <p><span className="text-muted-foreground">Client:</span> <span className="font-semibold">{payload.project.client.name}</span></p>
                </div>
              </div>
              <Badge variant={isValid ? "success" : "destructive"} className="text-sm">
                {isValid ? (
                  <><CheckCircle2 className="mr-1 h-4 w-4" /> Valid</>
                ) : (
                  <><XCircle className="mr-1 h-4 w-4" /> Invalid</>
                )}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Signature Verification
              </h2>
              <div className="flex items-center gap-2 p-4 rounded-lg bg-muted">
                {isValid ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Valid cryptographic signature</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="font-medium">Invalid signature — record may be tampered</span>
                  </>
                )}
              </div>
            </div>

            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Version & AI Disclosure
              </h2>
              <div className="bg-muted rounded-lg p-4 space-y-3 font-mono text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Version:</span>
                  <Badge variant="outline">v{payload.versionNumber}</Badge>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <span className="text-muted-foreground flex-shrink-0">Filename:</span>
                  <span className="text-right break-all text-xs">{payload.filename}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">AI Claim:</span>
                  <Badge>{payload.aiClaim}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">C2PA Credentials:</span>
                  <span>{payload.c2paPresent ? '✓ Present' : 'Not found'}</span>
                </div>
              </div>
            </div>

            {payload.approvals.length > 0 && (
              <div className="border-t pt-6">
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Internal Approvals
                </h2>
                <div className="space-y-3">
                  {payload.approvals.map((approval: any, i: number) => (
                    <div key={i} className="p-4 rounded-lg bg-muted">
                      <div className="font-semibold">
                        {approval.approverName && `${approval.approverName} · `}
                        {approval.approverRole}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {approval.company}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(approval.createdAt).toLocaleString('en-US', {
                          dateStyle: 'long',
                          timeStyle: 'short'
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {payload.clientSignOffs.length > 0 && (
              <div className="border-t pt-6">
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Client Sign-offs
                </h2>
                <div className="space-y-3">
                  {payload.clientSignOffs.map((signoff: any, i: number) => (
                    <div key={i} className="p-4 rounded-lg bg-muted">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold">{signoff.signerName}</div>
                        <Badge variant={signoff.decision === 'approved' ? 'success' : 'warning'}>
                          {signoff.decision}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{signoff.email}</div>
                      {signoff.comment && (
                        <div className="text-sm mt-2 italic">"{signoff.comment}"</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(signoff.createdAt).toLocaleString('en-US', {
                          dateStyle: 'long',
                          timeStyle: 'short'
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold mb-3">File Hash (SHA-256)</h2>
              <div className="p-3 rounded-lg bg-muted font-mono text-xs break-all">
                {payload.sha256}
              </div>
            </div>

            {payload.aiLabel && (
              <div className="border-t pt-6">
                <h2 className="text-lg font-semibold mb-3">AI Disclosure Label</h2>
                <div className="bg-muted rounded-lg p-4 space-y-3 font-mono text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Label Text:</span>
                    <span>{payload.aiLabel.labelText}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Position:</span>
                    <span>{payload.aiLabel.corner}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Applied:</span>
                    <span className="text-xs">
                      {new Date(payload.aiLabel.appliedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="border-t pt-3 mt-3">
                    <span className="text-muted-foreground text-xs block mb-1">Labelled File SHA-256:</span>
                    <span className="text-xs break-all block">
                      {payload.aiLabel.labeledFileSha256}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t pt-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Receipt Created:</span>
                <span className="font-medium">
                  {new Date(payload.createdAt).toLocaleString('en-US', {
                    dateStyle: 'long',
                    timeStyle: 'short'
                  })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 space-y-4 print:hidden">
          <div className="flex flex-wrap justify-center gap-3">
            <a href={`/api/receipts/${id}/evidence-pack`} download>
              <Button size="lg">
                <Download className="mr-2 h-5 w-5" />
                Download Evidence Pack
              </Button>
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <a href={`/api/receipts/${id}/export?format=pdf`} download>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                PDF Only
              </Button>
            </a>
            <a href={`/api/receipts/${id}/export?format=json`} download>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                JSON Only
              </Button>
            </a>
            <Link href="/verify">
              <Button variant="outline">
                Verify a Video
              </Button>
            </Link>
          </div>

          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-900 mb-1 text-sm">
                    Legal Disclaimer
                  </h3>
                  <p className="text-xs text-amber-800">
                    This record documents approvals and disclosures. It is not legal advice or a 
                    certification of compliance. The signature verifies the integrity of this record 
                    only—not the truth or authenticity of the media content.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
