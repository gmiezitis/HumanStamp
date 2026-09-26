'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function VersionActions({ versionId, projectId }: { versionId: string; projectId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [approverRole, setApproverRole] = useState('');
  const [company, setCompany] = useState('');
  const [showSignOffForm, setShowSignOffForm] = useState(false);
  const [signOffEmail, setSignOffEmail] = useState('');
  const [signOffUrl, setSignOffUrl] = useState<string | null>(null);
  const [showBurnLabelForm, setShowBurnLabelForm] = useState(false);
  const [labelText, setLabelText] = useState('AI-generated content');
  const [labelCorner, setLabelCorner] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('bottom-right');
  const router = useRouter();

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
      alert('Label burn queued! Check back in a few minutes.');
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
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
          {error}
        </div>
      )}
      
      {showApprovalForm ? (
        <form onSubmit={handleApprove} className="space-y-3 p-4 bg-stone-50 border border-stone-200 rounded">
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
              disabled={loading}
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
          disabled={loading}
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
                  disabled={loading}
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
          disabled={loading}
          className="w-full bg-amber-700 text-white px-4 py-2 rounded hover:bg-amber-800 text-sm disabled:opacity-50"
        >
          Create Client Sign-off
        </button>
      )}

      {showBurnLabelForm ? (
        <form onSubmit={handleBurnLabel} className="space-y-3 p-4 bg-stone-50 border border-stone-200 rounded">
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
              Default suggestions: &apos;AI-generated content&apos; or &apos;Contains AI-generated content&apos;
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
              disabled={loading}
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
          disabled={loading}
          className="w-full bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800 text-sm disabled:opacity-50"
        >
          Burn AI Label
        </button>
      )}

      <button
        onClick={handleGenerateReceipt}
        disabled={loading}
        className="w-full bg-stone-900 text-white px-4 py-2 rounded hover:bg-stone-800 text-sm disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Generate Receipt'}
      </button>
    </div>
  );
}
