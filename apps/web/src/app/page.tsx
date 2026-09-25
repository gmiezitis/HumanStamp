export default function HomePage() {
  return (
    <div style={{ 
      maxWidth: '600px', 
      margin: '100px auto', 
      padding: '40px', 
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ fontSize: '32px', marginBottom: '16px' }}>Human Stamp</h1>
      <p style={{ fontSize: '16px', color: '#666', lineHeight: '1.6', marginBottom: '24px' }}>
        Seal short videos with human-approval receipts that survive platform metadata stripping.
      </p>
      
      <div style={{ marginBottom: '24px' }}>
        <a 
          href="/verify"
          style={{
            display: 'inline-block',
            background: '#3b82f6',
            color: 'white',
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: '500',
            textDecoration: 'none',
            borderRadius: '8px',
          }}
        >
          Verify Video by Upload →
        </a>
      </div>

      <div style={{ marginTop: '32px', padding: '20px', background: '#f9fafb', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Getting Started</h2>
        <p style={{ fontSize: '14px', color: '#666' }}>
          Use the <code style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: '4px' }}>stamp</code> CLI 
          to seal a video file. Soft-bind fingerprinting survives platform metadata stripping.
        </p>
      </div>
    </div>
  );
}
