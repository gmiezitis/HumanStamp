'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle2, AlertCircle, FileCheck, Loader2 } from 'lucide-react';

interface SignOffData {
  signOff: {
    id: string;
    email: string;
    token: string;
    expiresAt: string;
    usedAt: string | null;
    decision: string | null;
    signerName: string | null;
    comment: string | null;
    project: {
      id: string;
      name: string;
      client: {
        name: string;
      };
      versions: Array<{
        id: string;
        versionNumber: number;
        filename: string;
      }>;
    };
  };
}

export default function SignOffPage() {
  const params = useParams();
  const token = params.token as string;
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<SignOffData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [decision, setDecision] = useState<'approved' | 'changes-requested'>('approved');
  const [signerName, setSignerName] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    async function fetchSignOff() {
      try {
        const res = await fetch(`/api/signoffs/${token}`);
        const result = await res.json();

        if (!res.ok) {
          setError(result.error || 'Failed to load sign-off');
          return;
        }

        setData(result);
      } catch (err) {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchSignOff();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/signoffs/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          signerName: signerName.trim(),
          comment: comment.trim() || undefined,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Failed to submit sign-off');
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-muted-foreground">Loading sign-off request...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl border-red-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <CardTitle>Sign-off Not Available</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success || data?.signOff.usedAt) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl border-green-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <CardTitle>Sign-off Completed</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-900">Thank you for your feedback</span>
              </div>
              <p className="text-sm text-green-800">
                Your sign-off has been recorded and the agency has been notified.
              </p>
            </div>
            {data?.signOff.decision && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium text-muted-foreground">Decision:</span>
                  <Badge variant={data.signOff.decision === 'approved' ? 'success' : 'warning'}>
                    {data.signOff.decision}
                  </Badge>
                </div>
                {data.signOff.signerName && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium text-muted-foreground">Signed by:</span>
                    <span className="text-sm font-semibold">{data.signOff.signerName}</span>
                  </div>
                )}
                {data.signOff.comment && (
                  <div className="p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium text-muted-foreground block mb-1">Comment:</span>
                    <p className="text-sm italic">&ldquo;{data.signOff.comment}&rdquo;</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Shield className="h-8 w-8" />
            <h1 className="text-3xl font-bold">Human Stamp</h1>
          </div>
          <p className="text-muted-foreground">Client Sign-off Request</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="border-b">
            <CardTitle className="text-2xl">Review & Sign-off</CardTitle>
            <CardDescription className="text-base">
              {data?.signOff.project.client.name} · {data?.signOff.project.name}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            {data?.signOff.project.versions[0] && (
              <Card className="mb-6 bg-muted">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5" />
                    <CardTitle className="text-base">Version Details</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Version:</span>
                    <Badge variant="outline">v{data.signOff.project.versions[0].versionNumber}</Badge>
                  </div>
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-muted-foreground flex-shrink-0">Filename:</span>
                    <span className="font-mono text-xs text-right break-all">
                      {data.signOff.project.versions[0].filename}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sent to:</span>
                    <span className="font-medium">{data.signOff.email}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Your Name *
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-3">
                  Decision *
                </label>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-accent transition-colors">
                    <input
                      type="radio"
                      name="decision"
                      value="approved"
                      checked={decision === 'approved'}
                      onChange={() => setDecision('approved')}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Approved
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        This version is approved and ready to proceed
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-accent transition-colors">
                    <input
                      type="radio"
                      name="decision"
                      value="changes-requested"
                      checked={decision === 'changes-requested'}
                      onChange={() => setDecision('changes-requested')}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        Changes Requested
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Revisions needed before final approval
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Comment (optional)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  rows={4}
                  placeholder="Add any feedback or notes..."
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || !signerName.trim()}
                className="w-full"
                size="lg"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Sign-off'
                )}
              </Button>
            </form>

            <Card className="mt-6 border-amber-200 bg-amber-50">
              <CardContent className="pt-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-amber-800">
                      <strong>Note:</strong> This sign-off is for approval workflow purposes only. 
                      It does not constitute a legal signature or binding contract.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
