-- @conversr/compliance Migration 003: Consent Records Table
-- Description: Immutable consent tracking for GDPR/CCPA/APP compliance
-- Compatible with: PostgreSQL 14+, Supabase

-- =====================================================
-- CONSENT RECORDS TABLE (IMMUTABLE)
-- =====================================================

CREATE TABLE IF NOT EXISTS compliance_consent_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Tenant and customer relationship
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL, -- References your customers table

    -- Consent details
    consent_type TEXT NOT NULL,
    -- Common types: 'sms_marketing', 'sms_transactional', 'email_marketing',
    -- 'data_processing', 'data_sharing', 'analytics', 'functional_cookies', 'advertising_cookies'

    consent_granted BOOLEAN NOT NULL,

    -- Timestamps
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,

    -- Consent capture context
    ip_address INET,
    user_agent TEXT,
    method TEXT NOT NULL,
    -- Common methods: 'web_form', 'mobile_app', 'api', 'sms_reply', 'phone_call', 'in_person', 'import'

    -- Legal basis (GDPR Article 6)
    legal_basis TEXT,
    -- Values: 'consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests'

    -- Retention configuration
    retention_days INTEGER,

    -- Additional metadata
    -- Example: {"form_version": "1.2", "campaign_id": "abc123", "consentText": "..."}
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Timestamp (immutable - no updated_at)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_consent_state CHECK (
        (consent_granted = true AND granted_at IS NOT NULL) OR
        (consent_granted = false AND (revoked_at IS NOT NULL OR granted_at IS NULL))
    )
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_compliance_consent_tenant_customer
    ON compliance_consent_records(tenant_id, customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_consent_type
    ON compliance_consent_records(tenant_id, consent_type, consent_granted, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_consent_customer
    ON compliance_consent_records(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_consent_granted
    ON compliance_consent_records(tenant_id, consent_granted, created_at DESC);

-- Index for finding latest consent per customer+type
CREATE INDEX IF NOT EXISTS idx_compliance_consent_latest
    ON compliance_consent_records(customer_id, consent_type, created_at DESC);

-- =====================================================
-- IMMUTABILITY TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS prevent_compliance_consent_update ON compliance_consent_records;
CREATE TRIGGER prevent_compliance_consent_update
    BEFORE UPDATE ON compliance_consent_records
    FOR EACH ROW
    EXECUTE FUNCTION compliance_protect_immutable_records();

DROP TRIGGER IF EXISTS prevent_compliance_consent_delete ON compliance_consent_records;
CREATE TRIGGER prevent_compliance_consent_delete
    BEFORE DELETE ON compliance_consent_records
    FOR EACH ROW
    EXECUTE FUNCTION compliance_protect_immutable_records();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE compliance_consent_records ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can only read their own consent records
DROP POLICY IF EXISTS compliance_consent_tenant_read ON compliance_consent_records;
CREATE POLICY compliance_consent_tenant_read ON compliance_consent_records
    FOR SELECT
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Policy: Allow inserts with matching tenant_id
DROP POLICY IF EXISTS compliance_consent_tenant_insert ON compliance_consent_records;
CREATE POLICY compliance_consent_tenant_insert ON compliance_consent_records
    FOR INSERT
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to check if customer has valid consent
CREATE OR REPLACE FUNCTION compliance_has_consent(
    p_tenant_id UUID,
    p_customer_id UUID,
    p_consent_type TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_consent BOOLEAN;
BEGIN
    -- Set tenant context
    PERFORM set_compliance_tenant_context(p_tenant_id);

    -- Get the latest consent record for this type
    SELECT consent_granted INTO v_has_consent
    FROM compliance_consent_records
    WHERE customer_id = p_customer_id
      AND consent_type = p_consent_type
    ORDER BY created_at DESC
    LIMIT 1;

    RETURN COALESCE(v_has_consent, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION compliance_has_consent IS 'Check if a customer has valid consent for a specific type';

-- Function to grant consent
CREATE OR REPLACE FUNCTION compliance_grant_consent(
    p_tenant_id UUID,
    p_customer_id UUID,
    p_consent_type TEXT,
    p_method TEXT DEFAULT 'api',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_legal_basis TEXT DEFAULT 'consent',
    p_retention_days INTEGER DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_record_id UUID;
BEGIN
    -- Set tenant context
    PERFORM set_compliance_tenant_context(p_tenant_id);

    INSERT INTO compliance_consent_records (
        tenant_id,
        customer_id,
        consent_type,
        consent_granted,
        granted_at,
        method,
        ip_address,
        user_agent,
        legal_basis,
        retention_days,
        metadata
    ) VALUES (
        p_tenant_id,
        p_customer_id,
        p_consent_type,
        true,
        NOW(),
        p_method,
        p_ip_address,
        p_user_agent,
        p_legal_basis,
        p_retention_days,
        p_metadata
    )
    RETURNING id INTO v_record_id;

    RETURN v_record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke consent
CREATE OR REPLACE FUNCTION compliance_revoke_consent(
    p_tenant_id UUID,
    p_customer_id UUID,
    p_consent_type TEXT,
    p_method TEXT DEFAULT 'api',
    p_ip_address INET DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_record_id UUID;
BEGIN
    -- Set tenant context
    PERFORM set_compliance_tenant_context(p_tenant_id);

    INSERT INTO compliance_consent_records (
        tenant_id,
        customer_id,
        consent_type,
        consent_granted,
        revoked_at,
        method,
        ip_address,
        metadata
    ) VALUES (
        p_tenant_id,
        p_customer_id,
        p_consent_type,
        false,
        NOW(),
        p_method,
        p_ip_address,
        CASE WHEN p_reason IS NOT NULL
            THEN jsonb_build_object('reason', p_reason)
            ELSE '{}'::jsonb
        END
    )
    RETURNING id INTO v_record_id;

    RETURN v_record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE compliance_consent_records IS 'Immutable record of all consent grants and revocations for GDPR/CCPA/APP compliance';
COMMENT ON COLUMN compliance_consent_records.method IS 'Method by which consent was captured';
COMMENT ON COLUMN compliance_consent_records.consent_granted IS 'True if consent was granted, false if explicitly denied or revoked';
COMMENT ON COLUMN compliance_consent_records.legal_basis IS 'Legal basis for processing under GDPR Article 6';
