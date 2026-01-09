import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>PII Compliance Tool - Example App</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        This is a development environment for testing the pii-compliance-tool package.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Link
          href="/compliance"
          style={{
            display: 'block',
            padding: '1rem',
            backgroundColor: '#2563eb',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '0.5rem',
            textAlign: 'center',
          }}
        >
          Open Compliance Dashboard
        </Link>

        <div style={{ marginTop: '2rem' }}>
          <h2>Available Features</h2>
          <ul style={{ lineHeight: 1.8 }}>
            <li>Data Subject Requests management (GDPR, CCPA, APP)</li>
            <li>PII Location Registry with action tracking</li>
            <li>Consent tracking and history</li>
            <li>Immutable audit logging</li>
            <li>Compliance metrics and reporting</li>
            <li>Multi-tenant support (demo mode)</li>
          </ul>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h2>API Endpoints</h2>
          <ul style={{ lineHeight: 1.8, fontFamily: 'monospace', fontSize: '0.875rem' }}>
            <li>GET /api/compliance/audit-logs</li>
            <li>GET /api/compliance/data-subject-requests</li>
            <li>GET /api/compliance/pii-locations</li>
            <li>GET /api/compliance/action-tasks</li>
            <li>GET /api/compliance/consent</li>
            <li>GET /api/compliance/metrics</li>
          </ul>
        </div>

        <div
          style={{
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: '#fef3c7',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
          }}
        >
          <strong>Note:</strong> This example uses mock data. No real database connection is required.
        </div>
      </div>
    </main>
  );
}
