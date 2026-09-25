'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function VerifyPage() {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setError('Missing token');
      return;
    }

    fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Verification failed');
        }
        setStatus('success');
        setTimeout(() => router.push('/dashboard'), 1500);
      })
      .catch((err) => {
        setStatus('error');
        setError(err.message);
      });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white shadow-sm border border-stone-200 rounded-lg p-8 w-full max-w-md text-center">
        {status === 'verifying' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-stone-900 mx-auto mb-4"></div>
            <p className="text-stone-600">Verifying your magic link...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-green-600 text-5xl mb-4">✓</div>
            <p className="text-stone-900 font-semibold mb-2">Success!</p>
            <p className="text-stone-600 text-sm">Redirecting to dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-red-600 text-5xl mb-4">✗</div>
            <p className="text-stone-900 font-semibold mb-2">Verification failed</p>
            <p className="text-stone-600 text-sm mb-4">{error}</p>
            <a
              href="/auth/signin"
              className="inline-block bg-stone-900 text-white py-2 px-4 rounded-md hover:bg-stone-800"
            >
              Try again
            </a>
          </>
        )}
      </div>
    </div>
  );
}
