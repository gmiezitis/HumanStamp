'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export function UploadVersionForm({ projectId }: { projectId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [aiClaim, setAiClaim] = useState('human');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('aiClaim', aiClaim);

      const res = await fetch(`/api/projects/${projectId}/versions`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      setFile(null);
      setAiClaim('human');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-2">
          Video File
        </label>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-stone-900 file:text-white hover:file:bg-stone-800"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-2">
          AI Claim
        </label>
        <select
          value={aiClaim}
          onChange={(e) => setAiClaim(e.target.value)}
          className="block w-full px-3 py-2 border border-stone-300 rounded-md"
        >
          <option value="human">Human-made</option>
          <option value="human+ai">Human + AI tools</option>
          <option value="ai-generated">AI-generated</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!file || loading}
        className="bg-stone-900 text-white px-6 py-2 rounded-md hover:bg-stone-800 disabled:opacity-50"
      >
        {loading ? 'Uploading...' : 'Upload Version'}
      </button>
    </form>
  );
}
