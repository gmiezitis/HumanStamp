'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface VerifyResult {
  found: boolean;
  matchType: 'exact' | 'fingerprint' | 'none';
  similarity?: number;
  receipt?: {
    id: string;
    sha256: string;
    recipe: any;
    createdAt: string;
  };
  signatureValid?: boolean;
  error?: string;
}

export default function VerifyUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleVerify = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/verify', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Verify error:', error);
      setResult({
        found: false,
        matchType: 'none',
        error: 'Failed to verify file',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '600', marginBottom: '8px' }}>Verify Video by Upload</h1>
        <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6' }}>
          Upload a video to check if it has been sealed with Human Stamp. Works even after platform metadata stripping via perceptual fingerprinting.
        </p>
      </header>

      <section style={{
        background: '#f9fafb',
        border: '2px dashed #d1d5db',
        borderRadius: '8px',
        padding: '32px',
        marginBottom: '32px',
        textAlign: 'center'
      }}>
        <input
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          style={{
            display: 'block',
            width: '100%',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '14px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            background: 'white'
          }}
        />
        
        {file && (
          <div style={{ marginBottom: '16px', color: '#374151', fontSize: '14px' }}>
            Selected: <strong>{file.name}</strong> ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </div>
        )}

        <button
          onClick={handleVerify}
          disabled={!file || loading}
          style={{
            background: file && !loading ? '#3b82f6' : '#9ca3af',
            color: 'white',
            padding: '12px 32px',
            fontSize: '16px',
            fontWeight: '500',
            border: 'none',
            borderRadius: '8px',
            cursor: file && !loading ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? 'Verifying...' : 'Verify Video'}
        </button>
      </section>

      {result && (
        <section>
          {result.found ? (
            <div style={{
              background: '#f0fdf4',
              border: '2px solid #22c55e',
              borderRadius: '8px',
              padding: '24px',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '32px' }}>✓</span>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#15803d', margin: 0 }}>
                    Receipt Found
                  </h2>
                  <p style={{ fontSize: '14px', color: '#166534', margin: '4px 0 0 0' }}>
                    {result.matchType === 'exact' && 'Exact SHA-256 match'}
                    {result.matchType === 'fingerprint' && `Recovered via fingerprint (${Math.round((result.similarity || 0) * 100)}% similar)`}
                  </p>
                </div>
              </div>

              {result.matchType === 'fingerprint' && (
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #fbbf24',
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '16px',
                  fontSize: '13px',
                  color: '#78350f'
                }}>
                  <strong>Soft-bind match:</strong> The exact file bytes differ (likely due to re-encoding or metadata stripping), 
                  but the perceptual fingerprint matched a sealed video.
                </div>
              )}

              {result.receipt && (
                <>
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#166534', marginBottom: '4px' }}>Receipt ID</div>
                    <div style={{ fontSize: '16px', fontWeight: '500' }}>{result.receipt.id}</div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#166534', marginBottom: '4px' }}>Sealed By</div>
                    <div style={{ fontSize: '16px', fontWeight: '500' }}>{result.receipt.recipe.approver}</div>
                  </div>

                  <button
                    onClick={() => router.push(`/r/${result.receipt?.id}`)}
                    style={{
                      background: '#15803d',
                      color: 'white',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: '500',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    View Full Receipt →
                  </button>
                </>
              )}
            </div>
          ) : (
            <div style={{
              background: '#fef2f2',
              border: '2px solid #ef4444',
              borderRadius: '8px',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <span style={{ fontSize: '32px' }}>✗</span>
                <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#991b1b', margin: 0 }}>
                  No Receipt Found
                </h2>
              </div>
              <p style={{ fontSize: '14px', color: '#7f1d1d', margin: 0 }}>
                {result.error || 'This video has not been sealed with Human Stamp, or the content has changed significantly.'}
              </p>
            </div>
          )}
        </section>
      )}

      <section style={{
        marginTop: '48px',
        padding: '24px',
        background: '#f9fafb',
        borderRadius: '8px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>How It Works</h3>
        <ol style={{ fontSize: '14px', lineHeight: '1.8', color: '#374151', paddingLeft: '20px' }}>
          <li>First, we check if the exact file (SHA-256) matches a sealed receipt</li>
          <li>If not, we extract ~8 frames and compute perceptual hashes (dHash)</li>
          <li>We compare against fingerprints of all sealed videos</li>
          <li>If similarity ≥ 85%, we return the matching receipt</li>
        </ol>
        <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '16px', marginBottom: 0 }}>
          <strong>Why dHash?</strong> Difference hash (dHash) is resilient to re-encoding, minor compression, 
          and metadata stripping while remaining fast and deterministic. It computes horizontal gradient differences 
          per frame, making it robust to platform processing.
        </p>
      </section>
    </div>
  );
}
