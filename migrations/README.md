# @conversr/compliance Database Migrations

This directory contains SQL migrations for setting up the compliance module tables in your PostgreSQL/Supabase database.

## Prerequisites

- PostgreSQL 14+ or Supabase
- The `uuid-ossp` extension (for UUID generation)
- A `tenants` table with `id UUID PRIMARY KEY` (for multi-tenant setups)

## Migration Files

Run these migrations in order:

1. **001_functions.sql** - Utility functions for tenant context and audit protection
2. **002_audit_logs.sql** - Immutable audit log table with protection triggers
3. **003_consent_records.sql** - Immutable consent tracking table
4. **004_data_subject_requests.sql** - GDPR request management table

## Running Migrations

### With Supabase CLI

```bash
# Copy migrations to your supabase/migrations directory
cp migrations/*.sql ../supabase/migrations/

# Apply migrations
supabase db push
```

### With psql

```bash
psql -h localhost -U postgres -d your_database -f migrations/001_functions.sql
psql -h localhost -U postgres -d your_database -f migrations/002_audit_logs.sql
psql -h localhost -U postgres -d your_database -f migrations/003_consent_records.sql
psql -h localhost -U postgres -d your_database -f migrations/004_data_subject_requests.sql
```

### Programmatically

```typescript
import { runMigrations } from '@conversr/compliance';

await runMigrations({
  supabase: yourSupabaseClient,
  direction: 'up',
});
```

## Table Prefix

All tables are prefixed with `compliance_` by default:
- `compliance_audit_logs`
- `compliance_consent_records`
- `compliance_data_subject_requests`

This can be customized via the `tablePrefix` configuration option.

## Row Level Security (RLS)

All tables have RLS enabled with policies that use `app.current_tenant_id` session variable.

Before querying, set the tenant context:

```sql
SELECT set_compliance_tenant_context('your-tenant-uuid');
```

Or via the repository:

```typescript
const repo = new AuditLogRepository(supabase, tenantId);
// Tenant context is set automatically
```

## Rollback

To remove the compliance tables:

```sql
DROP TABLE IF EXISTS compliance_data_subject_requests CASCADE;
DROP TABLE IF EXISTS compliance_consent_records CASCADE;
DROP TABLE IF EXISTS compliance_audit_logs CASCADE;
DROP FUNCTION IF EXISTS compliance_protect_immutable_records CASCADE;
DROP FUNCTION IF EXISTS set_compliance_tenant_context CASCADE;
DROP FUNCTION IF EXISTS compliance_update_updated_at CASCADE;
```
