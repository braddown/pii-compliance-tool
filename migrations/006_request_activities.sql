-- @conversr/compliance Migration 006: Request Activities
-- Description: Activity log for DSR and action task processing
-- Compatible with: PostgreSQL 14+, Supabase

-- =====================================================
-- REQUEST ACTIVITIES TABLE
-- =====================================================
-- Immutable log of all actions taken on DSRs and their tasks
-- Provides audit trail and processing history

CREATE TABLE IF NOT EXISTS compliance_request_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Tenant isolation
    tenant_id UUID NOT NULL,

    -- Links to DSR (required)
    dsr_request_id UUID NOT NULL REFERENCES compliance_data_subject_requests(id) ON DELETE CASCADE,

    -- Links to specific action task (optional)
    action_task_id UUID REFERENCES compliance_action_tasks(id) ON DELETE SET NULL,

    -- Denormalized PII location name for display (avoids joins)
    pii_location_name TEXT,

    -- What happened
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        -- DSR lifecycle
        'request_created',
        'request_verified',
        'request_assigned',
        'request_status_changed',
        'request_completed',
        'request_rejected',
        -- Action task lifecycle
        'task_created',
        'task_started',
        'task_completed',
        'task_failed',
        'task_skipped',
        -- Notes
        'note_added'
    )),

    -- Human-readable description
    description TEXT NOT NULL,

    -- Who performed the action
    actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'automation')),
    actor_id UUID,
    actor_name TEXT, -- Denormalized for display

    -- Status tracking (for status change events)
    previous_status TEXT,
    new_status TEXT,

    -- Additional context as JSON
    details JSONB,

    -- Immutable timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Primary query pattern: activities for a specific DSR
CREATE INDEX IF NOT EXISTS idx_request_activities_dsr_request
    ON compliance_request_activities(dsr_request_id, created_at DESC);

-- Query by task
CREATE INDEX IF NOT EXISTS idx_request_activities_task
    ON compliance_request_activities(action_task_id)
    WHERE action_task_id IS NOT NULL;

-- Query by tenant and time (for recent activities view)
CREATE INDEX IF NOT EXISTS idx_request_activities_tenant_time
    ON compliance_request_activities(tenant_id, created_at DESC);

-- Query by activity type
CREATE INDEX IF NOT EXISTS idx_request_activities_type
    ON compliance_request_activities(tenant_id, activity_type);

-- Query by actor
CREATE INDEX IF NOT EXISTS idx_request_activities_actor
    ON compliance_request_activities(actor_id)
    WHERE actor_id IS NOT NULL;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE compliance_request_activities ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY tenant_isolation_request_activities ON compliance_request_activities
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE compliance_request_activities IS
    'Immutable activity log for DSR processing - records all actions taken on requests and tasks';

COMMENT ON COLUMN compliance_request_activities.pii_location_name IS
    'Denormalized location name to avoid joins when displaying activity feed';

COMMENT ON COLUMN compliance_request_activities.actor_name IS
    'Denormalized actor name/email for display - stored at time of action';

COMMENT ON COLUMN compliance_request_activities.details IS
    'Additional context: error messages, execution results, notes content, etc.';
