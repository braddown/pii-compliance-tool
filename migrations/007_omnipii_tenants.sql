-- Migration: 007_omnipii_tenants
-- Description: Tenant management for Omnipii Cloud SaaS
-- Creates tables for tenant registration, API keys, usage tracking, and subscriptions

-- ===========================================
-- Tenants Table
-- ===========================================
CREATE TABLE IF NOT EXISTS omnipii_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Organization info
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,

    -- Billing info
    billing_email VARCHAR(255),
    company_name VARCHAR(255),
    country_code CHAR(2),

    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled', 'pending')),

    -- Settings
    settings JSONB DEFAULT '{}',

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_omnipii_tenants_email ON omnipii_tenants(email);
CREATE INDEX IF NOT EXISTS idx_omnipii_tenants_status ON omnipii_tenants(status);
CREATE INDEX IF NOT EXISTS idx_omnipii_tenants_created_at ON omnipii_tenants(created_at);

-- ===========================================
-- API Keys Table
-- ===========================================
CREATE TABLE IF NOT EXISTS omnipii_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES omnipii_tenants(id) ON DELETE CASCADE,

    -- Key info
    name VARCHAR(100) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL, -- e.g., 'op_live_abc123'
    key_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of full key

    -- Mode
    mode VARCHAR(10) DEFAULT 'live' CHECK (mode IN ('live', 'test')),

    -- Permissions
    scopes TEXT[] DEFAULT ARRAY['read', 'write'],

    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    usage_count BIGINT DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    revoked_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_omnipii_api_keys_tenant ON omnipii_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_omnipii_api_keys_prefix ON omnipii_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_omnipii_api_keys_hash ON omnipii_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_omnipii_api_keys_active ON omnipii_api_keys(is_active) WHERE is_active = true;

-- ===========================================
-- Subscriptions Table
-- ===========================================
CREATE TABLE IF NOT EXISTS omnipii_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES omnipii_tenants(id) ON DELETE CASCADE,

    -- Plan info
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('free', 'starter', 'pro', 'enterprise')),

    -- Billing
    billing_cycle VARCHAR(10) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
    price_cents INTEGER DEFAULT 0,
    currency CHAR(3) DEFAULT 'USD',

    -- External billing
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100),

    -- Period
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
    cancel_at_period_end BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_omnipii_subscriptions_tenant ON omnipii_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_omnipii_subscriptions_tier ON omnipii_subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_omnipii_subscriptions_status ON omnipii_subscriptions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_omnipii_subscriptions_active ON omnipii_subscriptions(tenant_id) WHERE status = 'active';

-- ===========================================
-- Usage Tracking Table
-- ===========================================
CREATE TABLE IF NOT EXISTS omnipii_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES omnipii_tenants(id) ON DELETE CASCADE,

    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Usage counts
    dsr_count INTEGER DEFAULT 0,
    activity_count INTEGER DEFAULT 0,
    pii_location_count INTEGER DEFAULT 0,
    audit_log_count INTEGER DEFAULT 0,
    consent_count INTEGER DEFAULT 0,

    -- API usage
    api_request_count BIGINT DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

    -- Unique constraint per tenant per period
    UNIQUE(tenant_id, period_start)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_omnipii_usage_tenant ON omnipii_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_omnipii_usage_period ON omnipii_usage(period_start, period_end);

-- ===========================================
-- Usage Events Table (for detailed tracking)
-- ===========================================
CREATE TABLE IF NOT EXISTS omnipii_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES omnipii_tenants(id) ON DELETE CASCADE,

    -- Event info
    resource_type VARCHAR(50) NOT NULL, -- 'dsr', 'activity', 'pii_location', etc.
    operation VARCHAR(20) NOT NULL, -- 'insert', 'update', 'delete'
    count INTEGER DEFAULT 1,

    -- Context
    table_name VARCHAR(100),
    api_key_id UUID REFERENCES omnipii_api_keys(id),

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_omnipii_usage_events_tenant ON omnipii_usage_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_omnipii_usage_events_created ON omnipii_usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_omnipii_usage_events_resource ON omnipii_usage_events(resource_type);

-- Partition by month for large-scale usage (optional, commented out)
-- CREATE TABLE omnipii_usage_events (
--     ...
-- ) PARTITION BY RANGE (created_at);

-- ===========================================
-- Functions
-- ===========================================

-- Function to validate API key and return tenant info
CREATE OR REPLACE FUNCTION omnipii_validate_api_key(p_key_hash VARCHAR)
RETURNS TABLE (
    tenant_id UUID,
    tenant_name VARCHAR,
    tier VARCHAR,
    scopes TEXT[],
    is_valid BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id as tenant_id,
        t.name as tenant_name,
        COALESCE(s.tier, 'free'::VARCHAR) as tier,
        k.scopes,
        (k.is_active AND t.status = 'active' AND (k.expires_at IS NULL OR k.expires_at > now())) as is_valid
    FROM omnipii_api_keys k
    JOIN omnipii_tenants t ON t.id = k.tenant_id
    LEFT JOIN omnipii_subscriptions s ON s.tenant_id = t.id AND s.status = 'active'
    WHERE k.key_hash = p_key_hash
    LIMIT 1;

    -- Update last used
    UPDATE omnipii_api_keys
    SET last_used_at = now(), usage_count = usage_count + 1
    WHERE key_hash = p_key_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current usage for a tenant
CREATE OR REPLACE FUNCTION omnipii_get_current_usage(p_tenant_id UUID)
RETURNS TABLE (
    dsr_count INTEGER,
    activity_count INTEGER,
    pii_location_count INTEGER,
    audit_log_count INTEGER,
    consent_count INTEGER,
    period_start DATE,
    period_end DATE
) AS $$
DECLARE
    v_period_start DATE;
    v_period_end DATE;
BEGIN
    -- Calculate current billing period (monthly)
    v_period_start := date_trunc('month', now())::DATE;
    v_period_end := (date_trunc('month', now()) + interval '1 month' - interval '1 day')::DATE;

    RETURN QUERY
    SELECT
        COALESCE(u.dsr_count, 0),
        COALESCE(u.activity_count, 0),
        COALESCE(u.pii_location_count, 0),
        COALESCE(u.audit_log_count, 0),
        COALESCE(u.consent_count, 0),
        v_period_start,
        v_period_end
    FROM omnipii_usage u
    WHERE u.tenant_id = p_tenant_id
      AND u.period_start = v_period_start
    LIMIT 1;

    -- If no record exists, return zeros
    IF NOT FOUND THEN
        RETURN QUERY SELECT 0, 0, 0, 0, 0, v_period_start, v_period_end;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record usage
CREATE OR REPLACE FUNCTION omnipii_record_usage(
    p_tenant_id UUID,
    p_resource_type VARCHAR,
    p_count INTEGER DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
    v_period_start DATE;
    v_period_end DATE;
BEGIN
    -- Calculate current billing period
    v_period_start := date_trunc('month', now())::DATE;
    v_period_end := (date_trunc('month', now()) + interval '1 month' - interval '1 day')::DATE;

    -- Upsert usage record
    INSERT INTO omnipii_usage (tenant_id, period_start, period_end)
    VALUES (p_tenant_id, v_period_start, v_period_end)
    ON CONFLICT (tenant_id, period_start) DO NOTHING;

    -- Update the appropriate counter
    EXECUTE format(
        'UPDATE omnipii_usage SET %I = %I + $1, updated_at = now()
         WHERE tenant_id = $2 AND period_start = $3',
        p_resource_type || '_count',
        p_resource_type || '_count'
    ) USING p_count, p_tenant_id, v_period_start;

    -- Record the event for detailed tracking
    INSERT INTO omnipii_usage_events (tenant_id, resource_type, operation, count)
    VALUES (p_tenant_id, p_resource_type, 'insert', p_count);

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the operation
        RAISE NOTICE 'Usage recording failed: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if within limits
CREATE OR REPLACE FUNCTION omnipii_check_limit(
    p_tenant_id UUID,
    p_resource_type VARCHAR,
    p_increment INTEGER DEFAULT 1
)
RETURNS TABLE (
    allowed BOOLEAN,
    current_count INTEGER,
    limit_count INTEGER,
    tier VARCHAR
) AS $$
DECLARE
    v_tier VARCHAR;
    v_current INTEGER;
    v_limit INTEGER;
    v_limits JSONB;
BEGIN
    -- Get tenant's tier
    SELECT COALESCE(s.tier, 'free')
    INTO v_tier
    FROM omnipii_tenants t
    LEFT JOIN omnipii_subscriptions s ON s.tenant_id = t.id AND s.status = 'active'
    WHERE t.id = p_tenant_id;

    -- Define limits per tier
    v_limits := jsonb_build_object(
        'free', jsonb_build_object('dsr', 50, 'activity', 250, 'pii_location', 5, 'audit_log', 1000, 'consent', 100),
        'starter', jsonb_build_object('dsr', 500, 'activity', 2500, 'pii_location', 20, 'audit_log', 10000, 'consent', 1000),
        'pro', jsonb_build_object('dsr', 5000, 'activity', 25000, 'pii_location', 100, 'audit_log', 100000, 'consent', 10000),
        'enterprise', jsonb_build_object('dsr', 999999999, 'activity', 999999999, 'pii_location', 999999999, 'audit_log', 999999999, 'consent', 999999999)
    );

    -- Get limit for this tier and resource
    v_limit := (v_limits -> v_tier ->> p_resource_type)::INTEGER;

    -- Get current usage
    SELECT COALESCE(
        CASE p_resource_type
            WHEN 'dsr' THEN u.dsr_count
            WHEN 'activity' THEN u.activity_count
            WHEN 'pii_location' THEN u.pii_location_count
            WHEN 'audit_log' THEN u.audit_log_count
            WHEN 'consent' THEN u.consent_count
            ELSE 0
        END, 0
    )
    INTO v_current
    FROM omnipii_usage u
    WHERE u.tenant_id = p_tenant_id
      AND u.period_start = date_trunc('month', now())::DATE;

    IF v_current IS NULL THEN
        v_current := 0;
    END IF;

    RETURN QUERY SELECT
        (v_current + p_increment <= v_limit) as allowed,
        v_current as current_count,
        v_limit as limit_count,
        v_tier as tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- Triggers
-- ===========================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION omnipii_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_omnipii_tenants_updated
    BEFORE UPDATE ON omnipii_tenants
    FOR EACH ROW EXECUTE FUNCTION omnipii_update_timestamp();

CREATE TRIGGER tr_omnipii_subscriptions_updated
    BEFORE UPDATE ON omnipii_subscriptions
    FOR EACH ROW EXECUTE FUNCTION omnipii_update_timestamp();

CREATE TRIGGER tr_omnipii_usage_updated
    BEFORE UPDATE ON omnipii_usage
    FOR EACH ROW EXECUTE FUNCTION omnipii_update_timestamp();

-- ===========================================
-- RLS Policies (optional, for multi-tenant access)
-- ===========================================

-- Enable RLS on tenant-specific tables
ALTER TABLE omnipii_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE omnipii_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE omnipii_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE omnipii_usage_events ENABLE ROW LEVEL SECURITY;

-- Note: Policies would be added based on your auth strategy
-- Example: Allow access only to own tenant's data
-- CREATE POLICY tenant_isolation ON omnipii_api_keys
--     USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
