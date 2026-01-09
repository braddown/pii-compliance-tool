-- @conversr/compliance Migration 005: PII Locations and Action Tasks
-- Description: Registry of PII data locations and action task tracking for GDPR request execution
-- Compatible with: PostgreSQL 14+, Supabase

-- =====================================================
-- PII DATA LOCATIONS TABLE
-- =====================================================
-- Registry of all systems/locations where PII is stored

CREATE TABLE IF NOT EXISTS compliance_pii_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Tenant isolation
    tenant_id UUID NOT NULL,

    -- Location identification
    name TEXT NOT NULL,
    description TEXT,

    -- System classification
    system_type TEXT NOT NULL CHECK (system_type IN (
        'database',         -- Direct database access
        'api',              -- External API (SaaS, internal microservice)
        'manual',           -- Manual process (CRM without API, paper records)
        'file_storage',     -- S3, GCS, file systems
        'third_party'       -- Third-party vendor requiring coordination
    )),

    -- Execution type determines how actions are performed
    execution_type TEXT NOT NULL CHECK (execution_type IN (
        'automated',        -- Fully automated via API/webhook
        'semi_automated',   -- Automated execution with manual verification
        'manual'            -- Requires human action following instructions
    )),

    -- Which GDPR request types this location supports
    supported_request_types TEXT[] NOT NULL DEFAULT ARRAY['erasure', 'access', 'portability'],

    -- Priority order for execution (lower = execute first)
    priority_order INTEGER NOT NULL DEFAULT 100,

    -- Configuration for automated or manual actions (see action_config types)
    -- For automated: { endpoint: {...}, successCondition: {...} }
    -- For manual: { instructions: [...], verificationChecklist: [...] }
    action_config JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Ownership and responsibility
    owner_email TEXT,
    owner_team TEXT,

    -- PII data classification
    pii_fields TEXT[] DEFAULT ARRAY[]::TEXT[],  -- ['email', 'phone', 'name', 'address']
    data_categories TEXT[] DEFAULT ARRAY[]::TEXT[], -- ['contact_info', 'financial', 'behavioral']

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_verified_at TIMESTAMPTZ, -- When config was last verified working

    -- Metadata for extensibility
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique names per tenant
    UNIQUE(tenant_id, name)
);

-- =====================================================
-- ACTION TASKS TABLE
-- =====================================================
-- Tracks execution of a GDPR request against each PII location

CREATE TABLE IF NOT EXISTS compliance_action_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Tenant isolation
    tenant_id UUID NOT NULL,

    -- Relationships
    dsr_request_id UUID NOT NULL REFERENCES compliance_data_subject_requests(id) ON DELETE CASCADE,
    pii_location_id UUID NOT NULL REFERENCES compliance_pii_locations(id) ON DELETE RESTRICT,

    -- Task type (matches the GDPR request type)
    task_type TEXT NOT NULL CHECK (task_type IN (
        'access',
        'rectification',
        'erasure',
        'restriction',
        'portability',
        'objection'
    )),

    -- Execution status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',              -- Waiting to be started
        'in_progress',          -- Currently being executed
        'awaiting_callback',    -- Webhook sent, waiting for callback
        'manual_action',        -- Requires manual human action
        'verification',         -- Automated complete, awaiting verification
        'completed',            -- Successfully completed
        'failed',               -- Failed (retryable)
        'blocked',              -- Cannot proceed (dependency/issue)
        'skipped'               -- Explicitly skipped (not applicable)
    )),

    -- Assignment for manual tasks
    assigned_to UUID,
    assigned_at TIMESTAMPTZ,

    -- Execution timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Retry tracking
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_attempt_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,

    -- Execution results
    -- {
    --   "apiResponse": {...},
    --   "httpStatus": 200,
    --   "recordsAffected": 5,
    --   "errorMessage": null,
    --   "manualConfirmation": "Deleted from CRM by John at 2024-01-15",
    --   "checklistCompleted": {"Contact deleted": true, "Related records": true}
    -- }
    execution_result JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Human notes
    notes TEXT,

    -- Verification (for semi_automated or compliance review)
    verified_by UUID,
    verified_at TIMESTAMPTZ,
    verification_notes TEXT,

    -- Correlation ID for linking audit logs
    correlation_id UUID NOT NULL DEFAULT uuid_generate_v4(),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique task per request/location combination
    UNIQUE(dsr_request_id, pii_location_id)
);

-- =====================================================
-- INDEXES FOR PII LOCATIONS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_compliance_pii_locations_tenant_active
    ON compliance_pii_locations(tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_compliance_pii_locations_system_type
    ON compliance_pii_locations(tenant_id, system_type)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_compliance_pii_locations_execution_type
    ON compliance_pii_locations(tenant_id, execution_type)
    WHERE is_active = true;

-- GIN index for array contains queries on supported_request_types
CREATE INDEX IF NOT EXISTS idx_compliance_pii_locations_request_types
    ON compliance_pii_locations USING GIN(supported_request_types);

CREATE INDEX IF NOT EXISTS idx_compliance_pii_locations_owner_team
    ON compliance_pii_locations(tenant_id, owner_team)
    WHERE owner_team IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_pii_locations_priority
    ON compliance_pii_locations(tenant_id, priority_order, is_active);

-- =====================================================
-- INDEXES FOR ACTION TASKS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_compliance_action_tasks_dsr
    ON compliance_action_tasks(dsr_request_id, status);

CREATE INDEX IF NOT EXISTS idx_compliance_action_tasks_location
    ON compliance_action_tasks(pii_location_id, status);

CREATE INDEX IF NOT EXISTS idx_compliance_action_tasks_tenant_status
    ON compliance_action_tasks(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_action_tasks_assigned
    ON compliance_action_tasks(assigned_to, status)
    WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_action_tasks_correlation
    ON compliance_action_tasks(correlation_id);

-- Index for finding tasks that need retry
CREATE INDEX IF NOT EXISTS idx_compliance_action_tasks_retry
    ON compliance_action_tasks(next_retry_at)
    WHERE status = 'failed' AND attempt_count < max_attempts;

-- Index for tasks awaiting callbacks
CREATE INDEX IF NOT EXISTS idx_compliance_action_tasks_callback
    ON compliance_action_tasks(tenant_id, status)
    WHERE status = 'awaiting_callback';

-- Index for manual action tasks
CREATE INDEX IF NOT EXISTS idx_compliance_action_tasks_manual
    ON compliance_action_tasks(tenant_id, status, assigned_to)
    WHERE status = 'manual_action';

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Updated_at trigger for PII locations
DROP TRIGGER IF EXISTS compliance_pii_locations_updated_at ON compliance_pii_locations;
CREATE TRIGGER compliance_pii_locations_updated_at
    BEFORE UPDATE ON compliance_pii_locations
    FOR EACH ROW
    EXECUTE FUNCTION compliance_update_updated_at();

-- Updated_at trigger for action tasks
DROP TRIGGER IF EXISTS compliance_action_tasks_updated_at ON compliance_action_tasks;
CREATE TRIGGER compliance_action_tasks_updated_at
    BEFORE UPDATE ON compliance_action_tasks
    FOR EACH ROW
    EXECUTE FUNCTION compliance_update_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY - PII LOCATIONS
-- =====================================================

ALTER TABLE compliance_pii_locations ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can read their own locations
DROP POLICY IF EXISTS compliance_pii_locations_tenant_read ON compliance_pii_locations;
CREATE POLICY compliance_pii_locations_tenant_read ON compliance_pii_locations
    FOR SELECT
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Policy: Tenants can insert their own locations
DROP POLICY IF EXISTS compliance_pii_locations_tenant_insert ON compliance_pii_locations;
CREATE POLICY compliance_pii_locations_tenant_insert ON compliance_pii_locations
    FOR INSERT
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Policy: Tenants can update their own locations
DROP POLICY IF EXISTS compliance_pii_locations_tenant_update ON compliance_pii_locations;
CREATE POLICY compliance_pii_locations_tenant_update ON compliance_pii_locations
    FOR UPDATE
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Policy: Tenants can delete their own locations
DROP POLICY IF EXISTS compliance_pii_locations_tenant_delete ON compliance_pii_locations;
CREATE POLICY compliance_pii_locations_tenant_delete ON compliance_pii_locations
    FOR DELETE
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- =====================================================
-- ROW LEVEL SECURITY - ACTION TASKS
-- =====================================================

ALTER TABLE compliance_action_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can read their own tasks
DROP POLICY IF EXISTS compliance_action_tasks_tenant_read ON compliance_action_tasks;
CREATE POLICY compliance_action_tasks_tenant_read ON compliance_action_tasks
    FOR SELECT
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Policy: Tenants can insert their own tasks
DROP POLICY IF EXISTS compliance_action_tasks_tenant_insert ON compliance_action_tasks;
CREATE POLICY compliance_action_tasks_tenant_insert ON compliance_action_tasks
    FOR INSERT
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Policy: Tenants can update their own tasks
DROP POLICY IF EXISTS compliance_action_tasks_tenant_update ON compliance_action_tasks;
CREATE POLICY compliance_action_tasks_tenant_update ON compliance_action_tasks
    FOR UPDATE
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to create action tasks for a GDPR request
CREATE OR REPLACE FUNCTION compliance_create_action_tasks(
    p_tenant_id UUID,
    p_dsr_request_id UUID,
    p_task_type TEXT
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Set tenant context
    PERFORM set_compliance_tenant_context(p_tenant_id);

    -- Insert tasks for all active locations that support this request type
    INSERT INTO compliance_action_tasks (
        tenant_id,
        dsr_request_id,
        pii_location_id,
        task_type,
        status
    )
    SELECT
        p_tenant_id,
        p_dsr_request_id,
        loc.id,
        p_task_type,
        CASE
            WHEN loc.execution_type = 'manual' THEN 'manual_action'
            ELSE 'pending'
        END
    FROM compliance_pii_locations loc
    WHERE loc.tenant_id = p_tenant_id
      AND loc.is_active = true
      AND p_task_type = ANY(loc.supported_request_types)
    ORDER BY loc.priority_order ASC;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get action task summary for a GDPR request
CREATE OR REPLACE FUNCTION compliance_get_action_task_summary(
    p_tenant_id UUID,
    p_dsr_request_id UUID
)
RETURNS TABLE (
    total INTEGER,
    pending INTEGER,
    in_progress INTEGER,
    manual_action INTEGER,
    completed INTEGER,
    failed INTEGER,
    skipped INTEGER,
    all_completed BOOLEAN
) AS $$
BEGIN
    -- Set tenant context
    PERFORM set_compliance_tenant_context(p_tenant_id);

    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total,
        COUNT(*) FILTER (WHERE status = 'pending')::INTEGER as pending,
        COUNT(*) FILTER (WHERE status IN ('in_progress', 'awaiting_callback'))::INTEGER as in_progress,
        COUNT(*) FILTER (WHERE status = 'manual_action')::INTEGER as manual_action,
        COUNT(*) FILTER (WHERE status = 'completed')::INTEGER as completed,
        COUNT(*) FILTER (WHERE status IN ('failed', 'blocked'))::INTEGER as failed,
        COUNT(*) FILTER (WHERE status = 'skipped')::INTEGER as skipped,
        (COUNT(*) FILTER (WHERE status IN ('completed', 'skipped')) = COUNT(*))::BOOLEAN as all_completed
    FROM compliance_action_tasks
    WHERE tenant_id = p_tenant_id
      AND dsr_request_id = p_dsr_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update task status with automatic timestamp handling
CREATE OR REPLACE FUNCTION compliance_update_action_task_status(
    p_tenant_id UUID,
    p_task_id UUID,
    p_status TEXT,
    p_execution_result JSONB DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Set tenant context
    PERFORM set_compliance_tenant_context(p_tenant_id);

    UPDATE compliance_action_tasks
    SET
        status = p_status,
        execution_result = COALESCE(p_execution_result, execution_result),
        notes = COALESCE(p_notes, notes),
        started_at = CASE
            WHEN p_status = 'in_progress' AND started_at IS NULL THEN NOW()
            ELSE started_at
        END,
        completed_at = CASE
            WHEN p_status IN ('completed', 'failed', 'skipped', 'blocked') THEN NOW()
            ELSE completed_at
        END,
        attempt_count = CASE
            WHEN p_status = 'in_progress' THEN attempt_count + 1
            ELSE attempt_count
        END,
        last_attempt_at = CASE
            WHEN p_status = 'in_progress' THEN NOW()
            ELSE last_attempt_at
        END
    WHERE id = p_task_id
      AND tenant_id = p_tenant_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE compliance_pii_locations IS 'Registry of systems/locations where PII is stored for GDPR compliance actions';
COMMENT ON COLUMN compliance_pii_locations.system_type IS 'Classification of the data storage system: database, api, manual, file_storage, or third_party';
COMMENT ON COLUMN compliance_pii_locations.execution_type IS 'How actions are executed: automated (API), semi_automated (API + verification), or manual (human instructions)';
COMMENT ON COLUMN compliance_pii_locations.action_config IS 'JSON configuration for automated API calls or manual instruction steps';
COMMENT ON COLUMN compliance_pii_locations.priority_order IS 'Execution order - lower numbers execute first';

COMMENT ON TABLE compliance_action_tasks IS 'Tracks execution of GDPR requests against each PII data location';
COMMENT ON COLUMN compliance_action_tasks.status IS 'Execution status: pending, in_progress, awaiting_callback, manual_action, verification, completed, failed, blocked, or skipped';
COMMENT ON COLUMN compliance_action_tasks.correlation_id IS 'UUID for linking related audit log entries';
COMMENT ON COLUMN compliance_action_tasks.execution_result IS 'JSON containing API responses, affected record counts, or manual confirmation details';
