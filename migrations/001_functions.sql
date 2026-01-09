-- @conversr/compliance Migration 001: Utility Functions
-- Description: Functions for tenant context and record protection
-- Compatible with: PostgreSQL 14+, Supabase

-- Ensure uuid-ossp extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TENANT CONTEXT FUNCTION
-- =====================================================

-- Function to set tenant context for RLS
CREATE OR REPLACE FUNCTION set_compliance_tenant_context(tenant_id UUID)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', tenant_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_compliance_tenant_context IS 'Sets the current tenant context for RLS policies';

-- Generic session variable setter (if not exists)
CREATE OR REPLACE FUNCTION set_session_variable(variable_name TEXT, variable_value TEXT)
RETURNS void AS $$
BEGIN
    PERFORM set_config(variable_name, variable_value, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_session_variable IS 'Generic function to set session variables';

-- Alias for compatibility with existing set_tenant_context calls
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id UUID)
RETURNS void AS $$
BEGIN
    PERFORM set_compliance_tenant_context(tenant_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- IMMUTABILITY PROTECTION FUNCTION
-- =====================================================

-- Function to prevent updates and deletes on immutable tables
CREATE OR REPLACE FUNCTION compliance_protect_immutable_records()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Records in % are immutable and cannot be modified or deleted', TG_TABLE_NAME
        USING HINT = 'Create a new record instead of modifying existing ones';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION compliance_protect_immutable_records IS 'Prevents modification of immutable compliance records';

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================================================

-- Function to automatically update updated_at column
CREATE OR REPLACE FUNCTION compliance_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION compliance_update_updated_at IS 'Automatically updates the updated_at timestamp';
