'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

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
      <div className="min-h-screen bg-stone-50 p-8 flex items-center justify-center">
        <div className="text-stone-600">Loading sign-off...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-stone-50 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white shadow-sm border border-stone-200 rounded-lg p-8">
            <h1 className="text-3xl font-bold text-stone-900 mb-4">Sign-off Not Available</h1>
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success || data?.signOff.usedAt) {
    return (
      <div className="min-h-screen bg-stone-50 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white shadow-sm border border-stone-200 rounded-lg p-8">
            <h1 className="text-3xl font-bold text-stone-900 mb-4">Sign-off Completed</h1>
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="font-semibold text-green-900">Thank you for your feedback</span>
              </div>
              <p className="text-sm text-green-800 mt-2">
                Your sign-off has been recorded.
              </p>
            </div>
            {data?.signOff.decision && (
              <div className="mt-4 space-y-2 text-sm text-stone-700">
                <div>
                  <strong>Decision:</strong> {data.signOff.decision}
                </div>
                {data.signOff.signerName && (
                  <div>
                    <strong>Signed by:</strong> {data.signOff.signerName}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow-sm border border-stone-200 rounded-lg p-8">
          <h1 className="text-3xl font-bold text-stone-900 mb-2">
            Client Sign-off
          </h1>
          <p className="text-stone-600 mb-6">
            {data?.signOff.project.client.name} — {data?.signOff.project.name}
          </p>

          {data?.signOff.project.versions[0] && (
            <div className="mb-6 p-4 bg-stone-50 border border-stone-200 rounded-md">
              <h2 className="font-semibold text-stone-900 mb-1">Version Details</h2>
              <div className="text-sm text-stone-700 space-y-1">
                <div>
                  <strong>Version:</strong> v{data.signOff.project.versions[0].versionNumber}
                </div>
                <div>
                  <strong>Filename:</strong> {data.signOff.project.versions[0].filename}
                </div>
                <div>
                  <strong>Recipient:</strong> {data.signOff.email}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Your Name *
              </label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-900"
                placeholder="Enter your full name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Decision *
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="decision"
                    value="approved"
                    checked={decision === 'approved'}
                    onChange={() => setDecision('approved')}
                    className="text-stone-900 focus:ring-stone-900"
                  />
                  <span className="text-stone-700">Approved</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="decision"
                    value="changes-requested"
                    checked={decision === 'changes-requested'}
                    onChange={() => setDecision('changes-requested')}
                    className="text-stone-900 focus:ring-stone-900"
                  />
                  <span className="text-stone-700">Changes Requested</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Comment (optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-stone-900"
                rows={4}
                placeholder="Add any feedback or notes..."
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !signerName.trim()}
              className="w-full bg-stone-900 text-white py-2 px-4 rounded-md hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Sign-off'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-md">
            <p className="text-xs text-amber-800">
              <strong>Note:</strong> This sign-off is for approval workflow purposes only. 
              It does not constitute a legal signature or binding contract.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
