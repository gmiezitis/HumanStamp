'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Review {
  id: string;
  email: string;
  usedAt: string | null;
  expiresAt: string;
  decision: string | null;
  signerName: string | null;
  comment: string | null;
  superseded: boolean;
  expired: boolean;
  cancelled: boolean;
  canSubmit: boolean;
  notificationStatus: string | null;
  project: { name: string; client: { name: string } };
  version: {
    id: string;
    versionNumber: number;
    filename: string;
    sha256: string;
  };
}

export default function SignOffPage() {
  const { token } = useParams<{ token: string }>();
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<
    'approved' | 'changes-requested' | ''
  >('');
  const [signerName, setSignerName] = useState('');
  const [comment, setComment] = useState('');

  const loadReview = useCallback(async () => {
    try {
      const res = await fetch(`/api/signoffs/${token}`, { cache: 'no-store' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Unable to load review');
      setReview(result.signOff);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load review');
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!decision || !signerName.trim()) return;
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
      if (!res.ok) throw new Error(result.error || 'Unable to record decision');
      // Display the committed decision immediately even if the refresh fails.
      setReview((current) =>
        current
          ? {
              ...current,
              ...result.signOff,
              canSubmit: false,
              notificationStatus: result.notificationQueued ? 'pending' : null,
            }
          : current
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Network error. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8">
      <div className="max-w-2xl mx-auto bg-white border border-stone-200 rounded-lg p-6 space-y-6">
        <h1 className="text-2xl font-bold text-stone-900">
          {review?.usedAt ? 'Your recorded decision' : 'Client review'}
        </h1>
        {loading && <p role="status">Loading review…</p>}
        {error && (
          <div role="alert" className="p-3 rounded bg-red-50 text-red-900">
            <p>{error}</p>
            <button
              type="button"
              className="underline mt-2"
              onClick={() => void loadReview()}
            >
              Reload review
            </button>
          </div>
        )}
        {review && (
          <>
            <p className="text-stone-600">
              {review.project.client.name} — {review.project.name}
            </p>
            <section className="bg-stone-50 rounded p-4 space-y-2 text-sm">
              <h2 className="font-semibold">Exact version for this review</h2>
              <p>Version: v{review.version.versionNumber}</p>
              <p className="break-all">Filename: {review.version.filename}</p>
              <p>Sent to: {review.email}</p>
              <p className="font-mono text-xs break-all">
                File identifier: {review.version.sha256}
              </p>
            </section>
            {(review.superseded || review.cancelled) && (
              <p
                role="status"
                className="bg-amber-50 text-amber-900 rounded p-3 text-sm"
              >
                {review.superseded
                  ? 'A newer file has replaced this version. Any decision below is historical and does not approve the replacement.'
                  : 'This review request has been replaced. Ask the agency for the current link; the file shown here has not changed.'}
              </p>
            )}
            {review.usedAt ? (
              <section className="space-y-3">
                <h2 className="font-semibold">Decision recorded</h2>
                <p>
                  {review.decision === 'approved'
                    ? 'Approved'
                    : 'Changes requested'}
                </p>
                <p>
                  {review.signerName} ·{' '}
                  {new Date(review.usedAt).toLocaleString()}
                </p>
                {review.comment && <p>{review.comment}</p>}
                <p className="text-sm text-stone-600">
                  {review.notificationStatus === 'accepted'
                    ? 'The agency notification was accepted by the email provider.'
                    : review.notificationStatus === 'failed'
                      ? 'The agency notification could not be sent. Your decision is still saved.'
                      : review.notificationStatus === 'pending' ||
                          review.notificationStatus === 'sending'
                        ? 'Agency notification queued. Your decision is saved.'
                        : 'Your decision is saved in the project record.'}
                </p>
                <button
                  type="button"
                  className="underline text-sm"
                  onClick={() => void loadReview()}
                >
                  Refresh notification status
                </button>
                <p className="text-xs text-stone-600">
                  You can reopen this link to view your decision.
                </p>
              </section>
            ) : review.canSubmit ? (
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <label
                    htmlFor="signer-name"
                    className="block text-sm font-medium mb-2"
                  >
                    Your name
                  </label>
                  <input
                    id="signer-name"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    required
                    maxLength={200}
                    autoComplete="name"
                    className="w-full border border-stone-300 rounded p-3"
                  />
                </div>
                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium mb-2">
                    Your decision for this exact file
                  </legend>
                  <label className="flex gap-3 p-3 border rounded">
                    <input
                      type="radio"
                      name="decision"
                      value="approved"
                      checked={decision === 'approved'}
                      onChange={() => setDecision('approved')}
                      required
                    />
                    Approve this version
                  </label>
                  <label className="flex gap-3 p-3 border rounded">
                    <input
                      type="radio"
                      name="decision"
                      value="changes-requested"
                      checked={decision === 'changes-requested'}
                      onChange={() => setDecision('changes-requested')}
                    />
                    Request changes
                  </label>
                </fieldset>
                <div>
                  <label
                    htmlFor="review-comment"
                    className="block text-sm font-medium mb-2"
                  >
                    Comment (optional)
                  </label>
                  <textarea
                    id="review-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={5000}
                    rows={4}
                    className="w-full border border-stone-300 rounded p-3"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting || !decision || !signerName.trim()}
                  className="w-full bg-stone-900 text-white rounded p-3 disabled:opacity-50"
                >
                  {submitting ? 'Saving decision…' : 'Submit decision'}
                </button>
              </form>
            ) : (
              <p className="text-sm text-stone-600">
                {review.expired
                  ? 'This review link has expired.'
                  : 'This review is no longer active.'}{' '}
                Ask the agency for a new review link.
              </p>
            )}
            <p className="text-xs text-stone-600">
              This records the decision submitted by the holder of this review
              link. It does not independently verify identity or media
              authenticity.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
