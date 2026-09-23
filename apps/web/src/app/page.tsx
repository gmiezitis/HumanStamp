export default function HomePage() {
  return (
    <div style={{ 
      maxWidth: '600px', 
      margin: '100px auto', 
      padding: '40px', 
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ fontSize: '32px', marginBottom: '16px' }}>Human Stamp</h1>
      <p style={{ fontSize: '16px', color: '#666', lineHeight: '1.6' }}>
        Seal short videos with human-approval receipts that survive platform metadata stripping.
      </p>
      <div style={{ marginTop: '32px', padding: '20px', background: '#f9fafb', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Getting Started</h2>
        <p style={{ fontSize: '14px', color: '#666' }}>
          Use the <code style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: '4px' }}>stamp</code> CLI 
          to seal a video file.
        </p>
      </div>
    </div>
  );
}
