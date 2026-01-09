-- @conversr/compliance Migration 004: Data Subject Requests Table
-- Description: GDPR data subject request tracking and management
-- Compatible with: PostgreSQL 14+, Supabase

-- =====================================================
-- DATA SUBJECT REQUESTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS compliance_data_subject_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Tenant and customer relationship
    tenant_id UUID NOT NULL,
    customer_id UUID, -- May be null after erasure or for anonymous requests

    -- Request details
    request_type TEXT NOT NULL CHECK (request_type IN (
        'access',           -- Article 15: Right of access
        'rectification',    -- Article 16: Right to rectification
        'erasure',          -- Article 17: Right to erasure (right to be forgotten)
        'restriction',      -- Article 18: Right to restriction of processing
        'portability',      -- Article 20: Right to data portability
        'objection'         -- Article 21: Right to object
    )),

    -- Request status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Awaiting processing
        'in_progress',  -- Currently being processed
        'review',       -- Awaiting review/approval
        'completed',    -- Request fulfilled
        'rejected',     -- Request denied
        'cancelled'     -- Withdrawn by requester
    )),

    -- Priority level
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN (
        'low',
        'medium',
        'high',
        'urgent'
    )),

    -- Requester information
    requester_email TEXT NOT NULL,
    requester_phone TEXT,

    -- Identity verification
    verification_method TEXT CHECK (verification_method IN (
        'email',
        'phone',
        'in_person',
        'verified_id',
        'two_factor'
    )),
    verified_at TIMESTAMPTZ,

    -- Processing details
    assigned_to UUID, -- User ID of person handling the request
    notes TEXT,

    -- Additional metadata
    -- Example: {
    --   "dataExportUrl": "...",
    --   "deletionScope": ["messages", "journeys"],
    --   "processingNotes": [{"timestamp": "...", "note": "...", "author": "..."}]
    -- }
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Timestamps
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'), -- GDPR Article 12 deadline
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_compliance_dsr_tenant_status
    ON compliance_data_subject_requests(tenant_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_dsr_customer
    ON compliance_data_subject_requests(customer_id, created_at DESC)
    WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_dsr_type
    ON compliance_data_subject_requests(tenant_id, request_type, status);

CREATE INDEX IF NOT EXISTS idx_compliance_dsr_assigned
    ON compliance_data_subject_requests(assigned_to, status)
    WHERE assigned_to IS NOT NULL;

-- Index for finding pending/overdue requests
CREATE INDEX IF NOT EXISTS idx_compliance_dsr_pending
    ON compliance_data_subject_requests(tenant_id, status, due_date)
    WHERE status IN ('pending', 'in_progress', 'review');

-- Index for due soon requests
CREATE INDEX IF NOT EXISTS idx_compliance_dsr_due_soon
    ON compliance_data_subject_requests(tenant_id, due_date, status)
    WHERE status IN ('pending', 'in_progress', 'review');

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Updated_at trigger
DROP TRIGGER IF EXISTS compliance_dsr_updated_at ON compliance_data_subject_requests;
CREATE TRIGGER compliance_dsr_updated_at
    BEFORE UPDATE ON compliance_data_subject_requests
    FOR EACH ROW
    EXECUTE FUNCTION compliance_update_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE compliance_data_subject_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can read their own requests
DROP POLICY IF EXISTS compliance_dsr_tenant_read ON compliance_data_subject_requests;
CREATE POLICY compliance_dsr_tenant_read ON compliance_data_subject_requests
    FOR SELECT
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Policy: Tenants can insert their own requests
DROP POLICY IF EXISTS compliance_dsr_tenant_insert ON compliance_data_subject_requests;
CREATE POLICY compliance_dsr_tenant_insert ON compliance_data_subject_requests
    FOR INSERT
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Policy: Tenants can update their own requests
DROP POLICY IF EXISTS compliance_dsr_tenant_update ON compliance_data_subject_requests;
CREATE POLICY compliance_dsr_tenant_update ON compliance_data_subject_requests
    FOR UPDATE
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to create a GDPR request
CREATE OR REPLACE FUNCTION compliance_create_dsr(
    p_tenant_id UUID,
    p_customer_id UUID,
    p_request_type TEXT,
    p_requester_email TEXT,
    p_requester_phone TEXT DEFAULT NULL,
    p_priority TEXT DEFAULT 'medium',
    p_notes TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_request_id UUID;
BEGIN
    -- Set tenant context
    PERFORM set_compliance_tenant_context(p_tenant_id);

    INSERT INTO compliance_data_subject_requests (
        tenant_id,
        customer_id,
        request_type,
        requester_email,
        requester_phone,
        priority,
        notes,
        metadata
    ) VALUES (
        p_tenant_id,
        p_customer_id,
        p_request_type,
        p_requester_email,
        p_requester_phone,
        p_priority,
        p_notes,
        p_metadata
    )
    RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update GDPR request status
CREATE OR REPLACE FUNCTION compliance_update_dsr_status(
    p_tenant_id UUID,
    p_request_id UUID,
    p_status TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Set tenant context
    PERFORM set_compliance_tenant_context(p_tenant_id);

    UPDATE compliance_data_subject_requests
    SET
        status = p_status,
        notes = COALESCE(p_notes, notes),
        completed_at = CASE WHEN p_status IN ('completed', 'rejected', 'cancelled') THEN NOW() ELSE completed_at END
    WHERE id = p_request_id
      AND tenant_id = p_tenant_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get overdue requests
CREATE OR REPLACE FUNCTION compliance_get_overdue_requests(p_tenant_id UUID)
RETURNS TABLE (
    id UUID,
    request_type TEXT,
    status TEXT,
    requester_email TEXT,
    due_date TIMESTAMPTZ,
    days_overdue INTEGER
) AS $$
BEGIN
    -- Set tenant context
    PERFORM set_compliance_tenant_context(p_tenant_id);

    RETURN QUERY
    SELECT
        dsr.id,
        dsr.request_type,
        dsr.status,
        dsr.requester_email,
        dsr.due_date,
        (CURRENT_DATE - dsr.due_date::date)::INTEGER as days_overdue
    FROM compliance_data_subject_requests dsr
    WHERE dsr.tenant_id = p_tenant_id
      AND dsr.status IN ('pending', 'in_progress', 'review')
      AND dsr.due_date < NOW()
    ORDER BY dsr.due_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE compliance_data_subject_requests IS 'GDPR data subject requests tracking and management';
COMMENT ON COLUMN compliance_data_subject_requests.request_type IS 'Type of GDPR request: access (Art 15), rectification (Art 16), erasure (Art 17), restriction (Art 18), portability (Art 20), or objection (Art 21)';
COMMENT ON COLUMN compliance_data_subject_requests.due_date IS 'GDPR Article 12 requires response within 30 days';
COMMENT ON COLUMN compliance_data_subject_requests.verification_method IS 'How the requester identity was verified';
