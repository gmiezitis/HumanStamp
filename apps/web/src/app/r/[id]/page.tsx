import { prisma } from '@/lib/prisma';
import { verify, createReceiptPayload, truncateHash } from '@human-stamp/core';
import { notFound } from 'next/navigation';

interface PageProps {
  params: { id: string };
}

export default async function VerifyPage({ params }: PageProps) {
  const stamp = await prisma.stamp.findUnique({
    where: { id: params.id },
  });

  if (!stamp) {
    notFound();
  }

  const recipe = JSON.parse(stamp.recipeJson);

  const payload = createReceiptPayload(
    stamp.id,
    stamp.sha256,
    stamp.recipeJson,
    stamp.createdAtIso
  );

  const isValid = await verify(payload, stamp.signature, stamp.publicKey);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '600', marginBottom: '8px' }}>Human Stamp Receipt</h1>
        <p style={{ color: '#666', fontSize: '14px' }}>Receipt ID: {stamp.id}</p>
      </header>

      <div style={{ 
        background: isValid ? '#f0fdf4' : '#fef2f2', 
        border: `2px solid ${isValid ? '#22c55e' : '#ef4444'}`,
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>{isValid ? '✓' : '✗'}</span>
          <strong style={{ color: isValid ? '#15803d' : '#991b1b' }}>
            Signature {isValid ? 'Valid' : 'Invalid'}
          </strong>
        </div>
      </div>

      <section style={{ marginBottom: '32px', padding: '24px', background: '#f9fafb', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#111' }}>
          Human Approval
        </h2>
        <div style={{ display: 'grid', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Mode</div>
            <div style={{ fontSize: '16px', fontWeight: '500', marginTop: '4px' }}>{stamp.mode}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Approved By</div>
            <div style={{ fontSize: '16px', fontWeight: '500', marginTop: '4px' }}>{stamp.approver}</div>
          </div>
          {recipe.agentRoles && recipe.agentRoles.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Agent Roles</div>
              <div style={{ fontSize: '16px', marginTop: '4px' }}>{recipe.agentRoles.join(', ')}</div>
            </div>
          )}
        </div>
      </section>

      <section style={{ marginBottom: '32px', padding: '24px', background: '#fefce8', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#111' }}>
          Tools & Stack Claims
        </h2>
        {recipe.tools.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {recipe.tools.map((tool: string) => (
              <span
                key={tool}
                style={{
                  background: '#fef9c3',
                  border: '1px solid #fde047',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              >
                {tool}
              </span>
            ))}
          </div>
        ) : (
          <p style={{ color: '#78716c', fontSize: '14px' }}>No tools declared</p>
        )}
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Technical Details</h2>
        <div style={{ display: 'grid', gap: '12px', fontSize: '14px' }}>
          <div>
            <strong>SHA-256:</strong> {truncateHash(stamp.sha256, 16)}
          </div>
          {stamp.fingerprint && (
            <div>
              <strong>Fingerprint:</strong>{' '}
              <span style={{ 
                background: '#e0f2fe', 
                padding: '2px 8px', 
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}>
                {JSON.parse(stamp.fingerprint).length} frames (dHash)
              </span>
              {' '}
              <span style={{ color: '#64748b', fontSize: '13px' }}>
                — soft-bind for strip recovery
              </span>
            </div>
          )}
          <div>
            <strong>Sealed At:</strong> {new Date(stamp.createdAt).toLocaleString()}
          </div>
          <div style={{ wordBreak: 'break-all' }}>
            <strong>Public Key:</strong> <code style={{ fontSize: '12px' }}>{truncateHash(stamp.publicKey, 16)}</code>
          </div>
        </div>
      </section>

      <div style={{
        background: '#fef3c7',
        border: '2px solid #fbbf24',
        borderRadius: '8px',
        padding: '20px',
        marginTop: '32px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span> What This Stamp Does NOT Prove
        </h3>
        <p style={{ fontSize: '14px', lineHeight: '1.6', margin: 0, color: '#78350f' }}>
          This stamp verifies the <strong>signed assertions</strong> made at seal time. It does NOT verify the 
          authenticity or truth of the media content. The stamp proves that someone with access to the signing 
          key created this receipt, binding these metadata claims to a specific file hash.
        </p>
      </div>
    </div>
  );
}
