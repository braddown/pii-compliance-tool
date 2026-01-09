-- @conversr/compliance Migration 002: Audit Logs Table
-- Description: Immutable audit log for system actions and data changes
-- Compatible with: PostgreSQL 14+, Supabase

-- =====================================================
-- AUDIT LOGS TABLE (IMMUTABLE)
-- =====================================================

CREATE TABLE IF NOT EXISTS compliance_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Tenant isolation (references your tenants table)
    tenant_id UUID NOT NULL,

    -- User/actor who performed the action
    user_id UUID,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'api', 'workflow')),

    -- Action details
    action TEXT NOT NULL, -- e.g., 'customer.created', 'data_access', 'consent_updated'
    resource_type TEXT NOT NULL, -- e.g., 'customer', 'consent_record', 'gdpr_request'
    resource_id UUID,

    -- Change tracking (JSONB for flexibility)
    old_values JSONB,
    new_values JSONB,

    -- Request context
    ip_address INET,
    user_agent TEXT,

    -- Additional metadata
    -- Example: {"correlation_id": "abc123", "gdprRelevant": true, "riskLevel": "high"}
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Timestamp (immutable - no updated_at)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_compliance_audit_logs_tenant_created
    ON compliance_audit_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_logs_resource
    ON compliance_audit_logs(resource_type, resource_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_logs_action
    ON compliance_audit_logs(tenant_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_logs_user_id
    ON compliance_audit_logs(user_id, created_at DESC)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_audit_logs_actor_type
    ON compliance_audit_logs(tenant_id, actor_type, created_at DESC);

-- GDPR-relevant logs (partial index for efficiency)
CREATE INDEX IF NOT EXISTS idx_compliance_audit_logs_gdpr_relevant
    ON compliance_audit_logs(tenant_id, created_at DESC)
    WHERE (metadata->>'gdprRelevant')::boolean = true;

-- =====================================================
-- IMMUTABILITY TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS prevent_compliance_audit_logs_update ON compliance_audit_logs;
CREATE TRIGGER prevent_compliance_audit_logs_update
    BEFORE UPDATE ON compliance_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION compliance_protect_immutable_records();

DROP TRIGGER IF EXISTS prevent_compliance_audit_logs_delete ON compliance_audit_logs;
CREATE TRIGGER prevent_compliance_audit_logs_delete
    BEFORE DELETE ON compliance_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION compliance_protect_immutable_records();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE compliance_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can only read their own audit logs
DROP POLICY IF EXISTS compliance_audit_logs_tenant_read ON compliance_audit_logs;
CREATE POLICY compliance_audit_logs_tenant_read ON compliance_audit_logs
    FOR SELECT
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Policy: Allow inserts with matching tenant_id
DROP POLICY IF EXISTS compliance_audit_logs_tenant_insert ON compliance_audit_logs;
CREATE POLICY compliance_audit_logs_tenant_insert ON compliance_audit_logs
    FOR INSERT
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- =====================================================
-- HELPER FUNCTION
-- =====================================================

-- Function to create an audit log entry
CREATE OR REPLACE FUNCTION compliance_create_audit_log(
    p_tenant_id UUID,
    p_user_id UUID,
    p_actor_type TEXT,
    p_action TEXT,
    p_resource_type TEXT,
    p_resource_id UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    -- Set tenant context for RLS
    PERFORM set_compliance_tenant_context(p_tenant_id);

    INSERT INTO compliance_audit_logs (
        tenant_id,
        user_id,
        actor_type,
        action,
        resource_type,
        resource_id,
        old_values,
        new_values,
        ip_address,
        user_agent,
        metadata
    ) VALUES (
        p_tenant_id,
        p_user_id,
        p_actor_type,
        p_action,
        p_resource_type,
        p_resource_id,
        p_old_values,
        p_new_values,
        p_ip_address,
        p_user_agent,
        p_metadata
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION compliance_create_audit_log IS 'Helper function to create audit log entries with automatic tenant context';

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE compliance_audit_logs IS 'Immutable audit log for all system actions and data changes';
COMMENT ON COLUMN compliance_audit_logs.old_values IS 'JSONB snapshot of data before the action';
COMMENT ON COLUMN compliance_audit_logs.new_values IS 'JSONB snapshot of data after the action';
COMMENT ON COLUMN compliance_audit_logs.metadata IS 'Additional context including gdprRelevant flag and riskLevel';
