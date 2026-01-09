# @conversr/compliance

A comprehensive GDPR/CCPA/APP compliance toolkit for Next.js applications. Provides React components, API route handlers, and database migrations for managing data subject requests, consent tracking, and audit logging.

## Features

- **GDPR Request Management** - Track and manage data subject access, erasure, portability, and rectification requests
- **Consent Tracking** - Immutable consent records with full history and legal basis tracking
- **Audit Logging** - Comprehensive, immutable audit trail for all data operations
- **Privacy Dashboard** - Metrics and analytics for compliance monitoring
- **Multi-tenant Support** - Row Level Security (RLS) based tenant isolation
- **Next.js Integration** - Ready-to-use API route handlers and React components

## Installation

```bash
npm install @conversr/compliance
# or
yarn add @conversr/compliance
# or
pnpm add @conversr/compliance
```

### Peer Dependencies

```bash
npm install @supabase/supabase-js react react-dom next
```

## Quick Start

### 1. Run Database Migrations

Apply the SQL migrations to your PostgreSQL/Supabase database:

```bash
# Copy to your Supabase migrations folder
cp node_modules/@conversr/compliance/migrations/*.sql supabase/migrations/

# Apply migrations
supabase db push
```

### 2. Mount API Routes

Create a catch-all route in your Next.js app:

```typescript
// app/api/compliance/[...path]/route.ts
import { createComplianceRouter } from '@conversr/compliance/api';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';

const router = createComplianceRouter({
  supabase: createClient(),
  getTenantId: async (request) => {
    const session = await getServerSession();
    return session?.user?.tenantId;
  },
  auditLog: async (event) => {
    // Optional: custom audit logging
    console.log('Compliance event:', event);
  },
});

export const GET = router.handleRequest;
export const POST = router.handleRequest;
export const PUT = router.handleRequest;
export const PATCH = router.handleRequest;
```

### 3. Add the Dashboard

```tsx
// app/compliance/page.tsx
import { ComplianceProvider, ComplianceDashboard } from '@conversr/compliance';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from 'next-auth';

export default async function CompliancePage() {
  const supabase = createClient();
  const session = await getServerSession();

  return (
    <ComplianceProvider
      config={{
        supabase,
        tenantId: session.user.tenantId,
        userId: session.user.id,
      }}
    >
      <ComplianceDashboard />
    </ComplianceProvider>
  );
}
```

## Configuration

### ComplianceConfig

```typescript
interface ComplianceConfig {
  // Required
  supabase: SupabaseClient;
  tenantId: string;

  // Optional
  userId?: string;
  apiBasePath?: string;           // Default: '/api/compliance'
  tablePrefix?: string;           // Default: 'compliance_'
  singleTenantMode?: boolean;     // Default: false

  features?: {
    auditLogs?: boolean;          // Default: true
    gdprRequests?: boolean;       // Default: true
    consentManagement?: boolean;  // Default: true
    reports?: boolean;            // Default: true
    privacyDashboard?: boolean;   // Default: true
  };

  theme?: 'light' | 'dark' | 'system';
  classNames?: Partial<ComplianceClassNames>;
  onError?: (error: Error) => void;
  onAuditEvent?: (event: AuditEventCallback) => Promise<void>;
}
```

## Using Individual Hooks

For custom UI implementations, use the provided hooks:

```tsx
import {
  useAuditLogs,
  useGDPRRequests,
  useConsent,
  useComplianceMetrics,
} from '@conversr/compliance/hooks';

function MyCustomDashboard() {
  const { logs, loading, filters, setFilters } = useAuditLogs({
    initialFilters: { gdprRelevant: true },
    pageSize: 20,
  });

  const { requests, createRequest, updateRequest } = useGDPRRequests({
    initialFilters: { status: ['pending', 'in_progress'] },
    includeMetrics: true,
  });

  const { grantConsent, revokeConsent, hasConsent } = useConsent();

  const { metrics } = useComplianceMetrics({
    refreshInterval: 60000, // Refresh every minute
  });

  // Build your custom UI...
}
```

## API Endpoints

When mounted at `/api/compliance`, the following endpoints are available:

### Audit Logs
- `GET /api/compliance/audit-logs` - Query audit logs
- `POST /api/compliance/audit-logs` - Create audit log entry

### GDPR Requests
- `GET /api/compliance/gdpr-requests` - List requests
- `GET /api/compliance/gdpr-requests/:id` - Get single request
- `POST /api/compliance/gdpr-requests` - Create request
- `PUT /api/compliance/gdpr-requests/:id` - Update request

### Consent
- `GET /api/compliance/consent` - Query consent records
- `GET /api/compliance/consent/customer/:id` - Get customer consent summary
- `GET /api/compliance/consent/check?customerId=...&consentType=...` - Check consent
- `POST /api/compliance/consent` - Grant consent
- `POST /api/compliance/consent/revoke` - Revoke consent

### Metrics
- `GET /api/compliance/metrics` - Get all metrics
- `GET /api/compliance/metrics/gdpr` - GDPR metrics only
- `GET /api/compliance/metrics/consent` - Consent metrics only
- `GET /api/compliance/metrics/audit` - Audit metrics only

## Database Tables

The package creates three tables (with `compliance_` prefix by default):

### compliance_audit_logs
Immutable audit trail for all system actions. Protected by triggers that prevent UPDATE/DELETE.

### compliance_consent_records
Immutable consent history. Each grant/revoke creates a new record.

### compliance_data_subject_requests
GDPR request tracking with status workflow, due dates, and assignment.

## TypeScript Types

```typescript
import type {
  // Audit
  AuditLog,
  CreateAuditLogInput,
  AuditLogFilters,

  // Consent
  ConsentRecord,
  CreateConsentInput,
  RevokeConsentInput,
  CustomerConsentSummary,
  ConsentMetrics,

  // GDPR
  GDPRRequest,
  CreateGDPRRequestInput,
  UpdateGDPRRequestInput,
  GDPRRequestMetrics,

  // Config
  ComplianceConfig,
  ComplianceFeatures,
} from '@conversr/compliance/types';
```

## Direct Repository Access

For server-side operations, use repositories directly:

```typescript
import {
  AuditLogRepository,
  ConsentRecordRepository,
  DataSubjectRequestRepository,
} from '@conversr/compliance';

const auditRepo = new AuditLogRepository(supabase, tenantId);
const consentRepo = new ConsentRecordRepository(supabase, tenantId);
const dsrRepo = new DataSubjectRequestRepository(supabase, tenantId);

// Create GDPR request
const request = await dsrRepo.create({
  customerId: 'customer-uuid',
  requestType: 'access',
  requesterEmail: 'user@example.com',
});

// Grant consent
await consentRepo.grantConsent({
  customerId: 'customer-uuid',
  consentType: 'sms_marketing',
  method: 'web_form',
  legalBasis: 'consent',
});

// Check consent
const hasConsent = await consentRepo.hasConsent('customer-uuid', 'sms_marketing');

// Create audit log
await auditRepo.create({
  action: 'customer.exported',
  resourceType: 'customer',
  resourceId: 'customer-uuid',
  actorType: 'user',
  metadata: { gdprRelevant: true },
});
```

## GDPR Compliance

This package helps you comply with GDPR requirements:

- **Article 12**: Response deadline tracking (30 days)
- **Article 15**: Right of access (data export)
- **Article 16**: Right to rectification
- **Article 17**: Right to erasure
- **Article 18**: Right to restriction
- **Article 20**: Right to data portability
- **Article 21**: Right to object

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
