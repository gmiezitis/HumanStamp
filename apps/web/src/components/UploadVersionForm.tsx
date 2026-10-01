'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { aiClaimOptions } from '@/lib/ai-claim';

export function UploadVersionForm({ projectId }: { projectId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [aiClaim, setAiClaim] = useState('');
  const [uploadedVersionId, setUploadedVersionId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !aiClaim) return;

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

      const data = await res.json();
      setUploadedVersionId(data.version.id);
      setFile(null);
      setAiClaim('');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-stone-200 rounded-lg p-6 space-y-4"
    >
      <div>
        <label
          htmlFor="upload-video"
          className="block text-sm font-medium text-stone-700 mb-2"
        >
          Video File
        </label>
        <input
          type="file"
          id="upload-video"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-stone-900 file:text-white hover:file:bg-stone-800"
        />
      </div>

      <div>
        <label
          htmlFor="upload-ai-use"
          className="block text-sm font-medium text-stone-700 mb-2"
        >
          How was AI used in this cut?
        </label>
        <select
          id="upload-ai-use"
          required
          value={aiClaim}
          onChange={(e) => setAiClaim(e.target.value)}
          className="block w-full px-3 py-2 border border-stone-300 rounded-md"
        >
          <option value="" disabled>
            Select your declaration
          </option>
          {aiClaimOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-stone-500 mt-2">
          This is your declaration, not an AI-detection result. Use a
          browser-playable MP4 or WebM for the smoothest client review.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!file || !aiClaim || loading}
        className="bg-stone-900 text-white px-6 py-2 rounded-md hover:bg-stone-800 disabled:opacity-50"
      >
        {loading ? 'Uploading...' : 'Upload Version'}
      </button>
      {uploadedVersionId && (
        <div
          role="status"
          className="rounded-lg bg-green-50 p-4 text-sm text-green-900"
        >
          <p className="font-medium">
            Cut uploaded. Next: review and request approval.
          </p>
          <Link
            href={`/dashboard/projects/${projectId}/versions/${uploadedVersionId}`}
            className="inline-block mt-3 underline font-medium underline-offset-4"
          >
            Open this cut →
          </Link>
        </div>
      )}
    </form>
  );
}
