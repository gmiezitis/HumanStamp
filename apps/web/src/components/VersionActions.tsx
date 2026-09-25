'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function VersionActions({ versionId }: { versionId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleApprove = async () => {
    if (!confirm('Approve this version?')) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/versions/${versionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approverRole: 'Creative Director',
          company: 'Demo Agency',
          approverName: 'Alice Johnson',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Approval failed');
      }

      router.refresh();
      alert('Version approved successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBurnLabel = async () => {
    if (!confirm('Burn AI label into video? This will queue a background job.')) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/versions/${versionId}/burn-label`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Burn label failed');
      }

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
      
      <button
        onClick={handleApprove}
        disabled={loading}
        className="w-full bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 text-sm disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Approve This Version'}
      </button>
      
      <button
        onClick={handleBurnLabel}
        disabled={loading}
        className="w-full bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800 text-sm disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Burn AI Label'}
      </button>

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
