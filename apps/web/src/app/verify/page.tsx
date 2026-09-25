'use client';

import { useState } from 'react';

export default function VerifyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/verify', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        return;
      }

      setResult(data);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow-sm border border-stone-200 rounded-lg p-8">
          <h1 className="text-3xl font-bold text-stone-900 mb-2">
            Verify Video
          </h1>
          <p className="text-stone-600 mb-6">
            Upload a video to find its matching record
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Video File
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-stone-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-stone-900 file:text-white
                  hover:file:bg-stone-800"
              />
            </div>

            <button
              type="submit"
              disabled={!file || loading}
              className="w-full bg-stone-900 text-white py-2 px-4 rounded-md
                hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-4">
              {result.matchType === 'exact' && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-green-600">✓</span>
                    <span className="font-semibold text-green-900">Exact Match Found</span>
                  </div>
                  <p className="text-sm text-green-800">
                    This file exactly matches a recorded version.
                  </p>
                </div>
              )}

              {result.matchType === 'fingerprint' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-blue-600">≈</span>
                    <span className="font-semibold text-blue-900">
                      Fingerprint Match ({(result.similarity * 100).toFixed(1)}% similar)
                    </span>
                  </div>
                  <p className="text-sm text-blue-800 mb-2">
                    This file matches a recorded version, but has been re-encoded or edited.
                  </p>
                  {result.changedSpans && result.changedSpans.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-blue-900 mb-1">
                        Changed time spans:
                      </p>
                      <ul className="text-xs text-blue-800">
                        {result.changedSpans.map((span: any, i: number) => (
                          <li key={i}>
                            {span.start.toFixed(1)}s - {span.end.toFixed(1)}s
                          </li>
                        ))}
                      </ul>
                      {result.afterApproval && (
                        <p className="mt-2 text-xs font-semibold text-amber-900">
                          ⚠️ Changed after approval
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {result.matchType === 'none' && (
                <div className="p-4 bg-stone-100 border border-stone-300 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-stone-600">○</span>
                    <span className="font-semibold text-stone-900">No Match Found</span>
                  </div>
                  <p className="text-sm text-stone-700">
                    No matching record found for this video.
                  </p>
                </div>
              )}

              {result.receipt && (
                <div className="mt-4">
                  <a
                    href={`/r/${result.receipt.id}`}
                    className="inline-block bg-stone-900 text-white py-2 px-4 rounded-md hover:bg-stone-800"
                  >
                    View Receipt
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-md">
          <p className="text-xs text-amber-800">
            <strong>Note:</strong> Verification matches uploaded files against recorded versions.
            A match shows the file corresponds to a specific record, not that the content is authentic.
          </p>
        </div>
      </div>
    </div>
  );
}
