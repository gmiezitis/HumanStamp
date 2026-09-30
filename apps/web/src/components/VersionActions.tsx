'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkflowStatus } from '@/lib/workflow';

interface ReviewSummary {
  id: string;
  email: string;
  decision: string | null;
  signerName: string | null;
  comment: string | null;
  usedAt: string | null;
  cancelledAt: string | null;
  expiresAt: string;
  emails: Array<{
    id: string;
    kind: string;
    status: string;
    attempts: number;
    acceptedAt: string | null;
    retryAt: string;
    createdAt: string;
    lastError: string | null;
  }>;
}

export function VersionActions({
  versionId,
  projectId,
  workflowStatus,
  signOffs,
}: {
  versionId: string;
  projectId: string;
  workflowStatus: WorkflowStatus;
  signOffs: ReviewSummary[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [approverRole, setApproverRole] = useState('');
  const [company, setCompany] = useState('');
  const [showSignOffForm, setShowSignOffForm] = useState(false);
  const [signOffEmail, setSignOffEmail] = useState('');
  const [signOffUrl, setSignOffUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showBurnLabelForm, setShowBurnLabelForm] = useState(false);
  const [labelText, setLabelText] = useState('AI-generated content');
  const [labelCorner, setLabelCorner] = useState<
    'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  >('bottom-right');
  const router = useRouter();
  const inactive = loading || workflowStatus === 'superseded';
  const pendingEmail = signOffs.some((s) =>
    s.emails.some(
      (e) =>
        e.status === 'sending' ||
        (e.status === 'pending' && new Date(e.retryAt).getTime() <= Date.now())
    )
  );
  useEffect(() => {
    if (!pendingEmail) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [pendingEmail, router]);

  const handleReminder = async (id: string) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/signoffs/${id}/remind`, { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Unable to queue reminder');
      setNotice(result.message);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to queue reminder');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (id: string) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/emails/${id}/retry`, { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Unable to retry email');
      setNotice(result.message);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to retry email');
    } finally {
      setLoading(false);
    }
  };

  const handleRenew = async (email: string) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/signoffs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, versionId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Unable to renew review');
      setNotice(
        'New review link and invitation queued. The expired link remains inactive.'
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to renew review');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/versions/${versionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approverRole,
          company,
          approverName: approverName || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Approval failed');
      }

      setShowApprovalForm(false);
      setApproverName('');
      setApproverRole('');
      setCompany('');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSignOff = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/signoffs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signOffEmail,
          versionId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create sign-off');
      }

      const data = await res.json();
      setSignOffUrl(data.signOffUrl);
      setNotice(data.message);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBurnLabel = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/versions/${versionId}/burn-label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labelText,
          corner: labelCorner,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Burn label failed');
      }

      setShowBurnLabelForm(false);
      setNotice(
        'Label processing queued. The output will be a new draft requiring fresh approval.'
      );
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReceipt = async () => {
    if (!confirm('Generate receipt for this version?')) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/versions/${versionId}/receipt`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Receipt generation failed');
      }

      const data = await res.json();
      router.push(data.url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {workflowStatus === 'superseded' && (
        <p className="text-sm text-stone-600">
          This version is historical. Open the newest version to request
          approval.
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="p-3 rounded bg-blue-50 text-blue-900 text-sm"
        >
          {notice}
        </p>
      )}
      {signOffs.length > 0 && (
        <section className="space-y-3" aria-label="Client review requests">
          <h3 className="font-semibold text-stone-900">
            Client review requests
          </h3>
          <p className="text-xs text-stone-600">
            Email status reports queue activity and SMTP acceptance, not inbox
            delivery. One automatic reminder is scheduled after 24 hours.
          </p>
          {signOffs.map((s) => (
            <div
              key={s.id}
              className="border border-stone-200 rounded p-3 text-sm space-y-2"
            >
              <p className="font-medium break-all">{s.email}</p>
              <p>
                {s.decision === 'approved'
                  ? 'Client approved'
                  : s.decision === 'changes-requested'
                    ? 'Changes requested'
                    : s.cancelledAt
                      ? 'Request inactive'
                      : new Date(s.expiresAt) <= new Date()
                        ? 'Link expired'
                        : 'Awaiting client decision'}
              </p>
              {s.usedAt && (
                <p className="text-xs text-stone-600">
                  {s.signerName} · {new Date(s.usedAt).toLocaleString()}
                </p>
              )}
              {s.comment && <p className="text-stone-700">{s.comment}</p>}
              {s.emails.map((e) => (
                <p key={e.id} className="text-xs text-stone-600">
                  {e.kind === 'decision'
                    ? 'Agency notification'
                    : e.kind === 'reminder'
                      ? 'Reminder'
                      : 'Invitation'}
                  :{' '}
                  {e.status === 'accepted'
                    ? 'Accepted by email provider'
                    : e.status === 'sending'
                      ? 'Sending'
                      : e.status === 'failed'
                        ? 'Failed — retry available'
                        : e.status === 'cancelled'
                          ? 'Cancelled'
                          : new Date(e.retryAt) > new Date()
                            ? `Scheduled for ${new Date(e.retryAt).toLocaleString()}`
                            : 'Queued'}
                </p>
              ))}
              {s.emails
                .filter(
                  (e) =>
                    e.status === 'failed' &&
                    (e.kind === 'decision' ||
                      (!s.usedAt &&
                        !s.cancelledAt &&
                        new Date(s.expiresAt) > new Date()))
                )
                .map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    disabled={loading}
                    onClick={() => handleRetry(e.id)}
                    className="px-3 py-2 border rounded disabled:opacity-50"
                  >
                    Retry{' '}
                    {e.kind === 'decision' ? 'agency notification' : e.kind}
                  </button>
                ))}
              {!s.usedAt &&
                !s.cancelledAt &&
                new Date(s.expiresAt) <= new Date() && (
                  <button
                    type="button"
                    disabled={inactive}
                    onClick={() => handleRenew(s.email)}
                    className="px-3 py-2 border rounded disabled:opacity-50"
                  >
                    Send new review link
                  </button>
                )}
              {!s.usedAt &&
                !s.cancelledAt &&
                new Date(s.expiresAt) > new Date() && (
                  <button
                    type="button"
                    onClick={() => handleReminder(s.id)}
                    disabled={inactive}
                    className="px-3 py-2 border border-stone-300 rounded disabled:opacity-50"
                  >
                    Send reminder
                  </button>
                )}
            </div>
          ))}
        </section>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {showApprovalForm ? (
        <form
          onSubmit={handleApprove}
          className="space-y-3 p-4 bg-stone-50 border border-stone-200 rounded"
        >
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Your Name (optional)
            </label>
            <input
              type="text"
              value={approverName}
              onChange={(e) => setApproverName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded"
              placeholder="e.g. Alice Johnson"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Your Role *
            </label>
            <input
              type="text"
              value={approverRole}
              onChange={(e) => setApproverRole(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded"
              placeholder="e.g. Creative Director"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Company *
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded"
              placeholder="e.g. Demo Agency"
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={inactive}
              className="flex-1 bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 text-sm disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Approval'}
            </button>
            <button
              type="button"
              onClick={() => setShowApprovalForm(false)}
              disabled={loading}
              className="px-4 py-2 border border-stone-300 rounded hover:bg-stone-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowApprovalForm(true)}
          disabled={inactive}
          className="w-full bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 text-sm disabled:opacity-50"
        >
          Approve This Version
        </button>
      )}

      {showSignOffForm || signOffUrl ? (
        <div className="p-4 bg-stone-50 border border-stone-200 rounded space-y-3">
          {signOffUrl ? (
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-2">
                Sign-off Link Created
              </label>
              <div className="p-2 bg-white border border-stone-300 rounded font-mono text-xs break-all">
                {signOffUrl}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSignOffForm(false);
                  setSignOffUrl(null);
                  setSignOffEmail('');
                }}
                className="mt-2 w-full px-4 py-2 border border-stone-300 rounded hover:bg-stone-50 text-sm"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreateSignOff} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Client Email *
                </label>
                <input
                  type="email"
                  value={signOffEmail}
                  onChange={(e) => setSignOffEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded"
                  placeholder="client@example.com"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={inactive}
                  className="flex-1 bg-amber-700 text-white px-4 py-2 rounded hover:bg-amber-800 text-sm disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Sign-off Link'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSignOffForm(false)}
                  disabled={loading}
                  className="px-4 py-2 border border-stone-300 rounded hover:bg-stone-50 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowSignOffForm(true)}
          disabled={inactive}
          className="w-full bg-amber-700 text-white px-4 py-2 rounded hover:bg-amber-800 text-sm disabled:opacity-50"
        >
          Create Client Sign-off
        </button>
      )}

      {showBurnLabelForm ? (
        <form
          onSubmit={handleBurnLabel}
          className="space-y-3 p-4 bg-stone-50 border border-stone-200 rounded"
        >
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Label Text *
            </label>
            <input
              type="text"
              value={labelText}
              onChange={(e) => setLabelText(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded"
              placeholder="e.g. AI-generated content"
              required
            />
            <p className="text-xs text-stone-500 mt-1">
              Default suggestions: &apos;AI-generated content&apos; or
              &apos;Contains AI-generated content&apos;
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Corner Position *
            </label>
            <select
              value={labelCorner}
              onChange={(e) => setLabelCorner(e.target.value as any)}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded"
              required
            >
              <option value="top-left">Top Left</option>
              <option value="top-right">Top Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="bottom-right">Bottom Right</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={inactive}
              className="flex-1 bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800 text-sm disabled:opacity-50"
            >
              {loading ? 'Queuing...' : 'Burn Label'}
            </button>
            <button
              type="button"
              onClick={() => setShowBurnLabelForm(false)}
              disabled={loading}
              className="px-4 py-2 border border-stone-300 rounded hover:bg-stone-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowBurnLabelForm(true)}
          disabled={inactive}
          className="w-full bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800 text-sm disabled:opacity-50"
        >
          Burn AI Label
        </button>
      )}

      <button
        onClick={handleGenerateReceipt}
        disabled={inactive || workflowStatus !== 'approved'}
        className="w-full bg-stone-900 text-white px-4 py-2 rounded hover:bg-stone-800 text-sm disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Generate Receipt'}
      </button>
      {workflowStatus !== 'approved' && (
        <p className="text-xs text-stone-600">
          A final receipt is available after internal approval and all requested
          client reviews approve this exact version.
        </p>
      )}
    </div>
  );
}
