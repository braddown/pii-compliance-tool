'use client';

import { ComplianceProvider, ComplianceDashboard } from 'pii-compliance-tool';
import { createMockSupabaseClient, MOCK_TENANT_ID, MOCK_USER_ID } from '@/lib/mock-supabase';

// Create mock Supabase client
const supabase = createMockSupabaseClient();

export default function CompliancePage() {
  return (
    <ComplianceProvider
      config={{
        supabase,
        tenantId: MOCK_TENANT_ID,
        userId: MOCK_USER_ID,
        apiBasePath: '/api/compliance',
        features: {
          auditLogs: true,
          gdprRequests: true,
          consentManagement: true,
          reports: true,
          privacyDashboard: true,
        },
      }}
    >
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
        <header
          style={{
            backgroundColor: 'white',
            borderBottom: '1px solid #e5e7eb',
            padding: '1rem 2rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Compliance Dashboard</h1>
              <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                PII Compliance Tool - Demo Mode
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span
                style={{
                  padding: '0.25rem 0.75rem',
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                }}
              >
                Mock Data
              </span>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                Tenant: {MOCK_TENANT_ID}
              </span>
            </div>
          </div>
        </header>

        <main style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
          <ComplianceDashboard />
        </main>
      </div>
    </ComplianceProvider>
  );
}
