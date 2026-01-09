/**
 * Mock Supabase client for UI development and testing
 *
 * This provides realistic mock data without requiring a real database connection.
 * Replace with a real Supabase client in production.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// Generate UUIDs for seed data
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Seed data - use consistent IDs for relationships
const TENANT_ID = 'demo-tenant-001';
const CUSTOMER_IDS = [uuid(), uuid(), uuid(), uuid(), uuid()];
const USER_IDS = [uuid(), uuid(), uuid()];

const seedAuditLogs = [
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    action: 'gdpr_request.created',
    resource_type: 'gdpr_request',
    resource_id: uuid(),
    actor_type: 'user',
    user_id: USER_IDS[0],
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    metadata: { request_type: 'access' },
    is_gdpr_relevant: true,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    action: 'consent.granted',
    resource_type: 'consent',
    resource_id: uuid(),
    actor_type: 'user',
    user_id: USER_IDS[1],
    ip_address: '10.0.0.55',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    metadata: { consent_type: 'marketing' },
    is_gdpr_relevant: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    action: 'data.exported',
    resource_type: 'user_data',
    resource_id: uuid(),
    actor_type: 'system',
    user_id: null,
    ip_address: null,
    user_agent: null,
    metadata: { format: 'json', size_bytes: 45231 },
    is_gdpr_relevant: true,
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    action: 'user.login',
    resource_type: 'session',
    resource_id: uuid(),
    actor_type: 'user',
    user_id: USER_IDS[2],
    ip_address: '172.16.0.22',
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
    metadata: { method: 'oauth', provider: 'google' },
    is_gdpr_relevant: false,
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    action: 'gdpr_request.completed',
    resource_type: 'gdpr_request',
    resource_id: uuid(),
    actor_type: 'admin',
    user_id: USER_IDS[0],
    ip_address: '192.168.1.50',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    metadata: { request_type: 'erasure', processing_time_hours: 48 },
    is_gdpr_relevant: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
];

const seedGdprRequests = [
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    request_type: 'access',
    status: 'pending',
    priority: 'high',
    requester_email: 'john.doe@example.com',
    requester_name: 'John Doe',
    customer_id: CUSTOMER_IDS[0],
    assigned_to: null,
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 25).toISOString(),
    completed_at: null,
    notes: 'User requested all personal data',
    metadata: {},
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    request_type: 'erasure',
    status: 'in_progress',
    priority: 'urgent',
    requester_email: 'jane.smith@example.com',
    requester_name: 'Jane Smith',
    customer_id: CUSTOMER_IDS[1],
    assigned_to: USER_IDS[0],
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(),
    completed_at: null,
    notes: 'Complete data deletion requested per GDPR Art. 17',
    metadata: {},
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    request_type: 'portability',
    status: 'completed',
    priority: 'medium',
    requester_email: 'alice.johnson@example.com',
    requester_name: 'Alice Johnson',
    customer_id: CUSTOMER_IDS[2],
    assigned_to: USER_IDS[1],
    due_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    completed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    notes: 'Data exported in JSON format',
    metadata: {},
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 28).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    request_type: 'rectification',
    status: 'review',
    priority: 'low',
    requester_email: 'bob.wilson@example.com',
    requester_name: 'Bob Wilson',
    customer_id: CUSTOMER_IDS[3],
    assigned_to: null,
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20).toISOString(),
    completed_at: null,
    notes: 'Address correction requested',
    metadata: {},
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    request_type: 'access',
    status: 'pending',
    priority: 'medium',
    requester_email: 'emma.davis@example.com',
    requester_name: 'Emma Davis',
    customer_id: CUSTOMER_IDS[4],
    assigned_to: null,
    due_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // Overdue
    completed_at: null,
    notes: 'Requesting copy of all stored data',
    metadata: {},
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 35).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 35).toISOString(),
  },
];

// PII location IDs for relationships
const PII_LOCATION_IDS = [uuid(), uuid(), uuid(), uuid(), uuid()];

const seedPiiLocations = [
  {
    id: PII_LOCATION_IDS[0],
    tenant_id: TENANT_ID,
    name: 'PostgreSQL Users Database',
    description: 'Primary user accounts and profile data',
    system_type: 'database',
    execution_type: 'automated',
    supported_request_types: ['access', 'erasure', 'rectification', 'portability'],
    priority_order: 10,
    action_config: {
      endpoint: {
        url: 'https://api.internal/users/{customer_id}',
        method: 'DELETE',
        authType: 'bearer',
        authConfig: { secretRef: 'vault:db_api_token' },
      },
      successCondition: { httpStatus: [200, 204] },
    },
    owner_email: 'backend-team@example.com',
    owner_team: 'Backend Engineering',
    pii_fields: ['email', 'name', 'phone', 'address'],
    data_categories: ['identification', 'contact'],
    consent_fields: ['email_marketing', 'sms_marketing', 'analytics'],
    consent_query_config: {
      queryType: 'database',
      query: 'SELECT email_marketing_consent, sms_opt_in, analytics_consent, consent_updated_at FROM users WHERE id = {{customerId}}',
      responseMapping: {
        consentField: 'email_marketing_consent',
        grantedAtField: 'consent_updated_at',
      },
    },
    is_active: true,
    last_verified_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    metadata: {},
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
  },
  {
    id: PII_LOCATION_IDS[1],
    tenant_id: TENANT_ID,
    name: 'Salesforce CRM',
    description: 'Customer relationship management system',
    system_type: 'third_party',
    execution_type: 'manual',
    supported_request_types: ['access', 'erasure', 'rectification'],
    priority_order: 20,
    action_config: {
      instructions: [
        { step: 1, title: 'Log into Salesforce', description: 'Navigate to salesforce.com and log in with admin credentials' },
        { step: 2, title: 'Search for contact', description: 'Use global search to find the customer by email' },
        { step: 3, title: 'Delete contact record', description: 'Select Actions > Delete and confirm', warning: 'This action cannot be undone' },
        { step: 4, title: 'Clear from recycle bin', description: 'Empty the recycle bin to permanently delete' },
      ],
      estimatedMinutes: 15,
      requiredRole: 'Salesforce Admin',
      verificationChecklist: ['Contact deleted', 'Related opportunities removed', 'Recycle bin cleared'],
    },
    owner_email: 'sales-ops@example.com',
    owner_team: 'Sales Operations',
    pii_fields: ['email', 'name', 'phone', 'company'],
    data_categories: ['identification', 'contact', 'professional'],
    consent_fields: ['email_marketing'],
    consent_query_config: {
      queryType: 'manual',
      instructions: 'Navigate to Contact > Details > Marketing Preferences to view consent status',
    },
    is_active: true,
    last_verified_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
    metadata: {},
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
  },
  {
    id: PII_LOCATION_IDS[2],
    tenant_id: TENANT_ID,
    name: 'Stripe Payment Gateway',
    description: 'Payment processing and billing data',
    system_type: 'api',
    execution_type: 'automated',
    supported_request_types: ['access', 'erasure'],
    priority_order: 30,
    action_config: {
      endpoint: {
        url: 'https://api.stripe.com/v1/customers/{stripe_customer_id}',
        method: 'DELETE',
        authType: 'bearer',
        authConfig: { secretRef: 'vault:stripe_secret_key' },
      },
      successCondition: { httpStatus: [200] },
    },
    owner_email: 'finance@example.com',
    owner_team: 'Finance',
    pii_fields: ['email', 'name', 'payment_method'],
    data_categories: ['financial', 'identification'],
    consent_fields: [],
    consent_query_config: null,
    is_active: true,
    last_verified_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    metadata: {},
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 75).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
  {
    id: PII_LOCATION_IDS[3],
    tenant_id: TENANT_ID,
    name: 'AWS S3 User Documents',
    description: 'User-uploaded files and documents',
    system_type: 'file_storage',
    execution_type: 'semi_automated',
    supported_request_types: ['access', 'erasure', 'portability'],
    priority_order: 40,
    action_config: {
      endpoint: {
        url: 'https://api.internal/storage/users/{customer_id}/delete',
        method: 'POST',
        authType: 'api_key',
        authConfig: { headerName: 'X-API-Key', secretRef: 'vault:storage_api_key' },
      },
      successCondition: { httpStatus: [200, 202] },
    },
    owner_email: 'platform@example.com',
    owner_team: 'Platform Engineering',
    pii_fields: ['documents', 'photos'],
    data_categories: ['user_content'],
    consent_fields: [],
    consent_query_config: null,
    is_active: true,
    last_verified_at: null,
    metadata: {},
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  },
  {
    id: PII_LOCATION_IDS[4],
    tenant_id: TENANT_ID,
    name: 'Legacy ERP System',
    description: 'On-premise enterprise resource planning (read-only access)',
    system_type: 'manual',
    execution_type: 'manual',
    supported_request_types: ['access'],
    priority_order: 100,
    action_config: {
      instructions: [
        { step: 1, title: 'Contact IT Support', description: 'Open a ticket with IT requesting data export from ERP' },
        { step: 2, title: 'Provide customer details', description: 'Include customer ID and email in the ticket' },
        { step: 3, title: 'Wait for export', description: 'IT will process within 3-5 business days', expectedResult: 'CSV file with customer data' },
      ],
      estimatedMinutes: 30,
      requiredRole: 'IT Admin',
      documentationUrl: 'https://wiki.internal/erp-data-export',
    },
    owner_email: 'it-support@example.com',
    owner_team: 'IT Operations',
    pii_fields: ['email', 'name', 'employee_id', 'department'],
    data_categories: ['identification', 'professional'],
    consent_fields: [],
    consent_query_config: null,
    is_active: true,
    last_verified_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    metadata: { note: 'Legacy system - erasure not supported' },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
  },
];

// Action task seed data - linked to second GDPR request (erasure in_progress)
const seedActionTasks = [
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    dsr_request_id: seedGdprRequests[1].id, // Jane Smith's erasure request
    pii_location_id: PII_LOCATION_IDS[0],
    task_type: 'erasure',
    status: 'completed',
    assigned_to: USER_IDS[0],
    assigned_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    started_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    completed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    attempt_count: 1,
    max_attempts: 3,
    last_attempt_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    next_retry_at: null,
    execution_result: { recordsAffected: 1, httpStatus: 204 },
    notes: 'User record deleted successfully',
    verified_by: null,
    verified_at: null,
    verification_notes: null,
    correlation_id: uuid(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    dsr_request_id: seedGdprRequests[1].id,
    pii_location_id: PII_LOCATION_IDS[1],
    task_type: 'erasure',
    status: 'manual_action',
    assigned_to: null,
    assigned_at: null,
    started_at: null,
    completed_at: null,
    attempt_count: 0,
    max_attempts: 3,
    last_attempt_at: null,
    next_retry_at: null,
    execution_result: {},
    notes: null,
    verified_by: null,
    verified_at: null,
    verification_notes: null,
    correlation_id: uuid(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    dsr_request_id: seedGdprRequests[1].id,
    pii_location_id: PII_LOCATION_IDS[2],
    task_type: 'erasure',
    status: 'in_progress',
    assigned_to: USER_IDS[0],
    assigned_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    started_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    completed_at: null,
    attempt_count: 1,
    max_attempts: 3,
    last_attempt_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    next_retry_at: null,
    execution_result: {},
    notes: 'Processing Stripe deletion',
    verified_by: null,
    verified_at: null,
    verification_notes: null,
    correlation_id: uuid(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    dsr_request_id: seedGdprRequests[1].id,
    pii_location_id: PII_LOCATION_IDS[3],
    task_type: 'erasure',
    status: 'pending',
    assigned_to: null,
    assigned_at: null,
    started_at: null,
    completed_at: null,
    attempt_count: 0,
    max_attempts: 3,
    last_attempt_at: null,
    next_retry_at: null,
    execution_result: {},
    notes: null,
    verified_by: null,
    verified_at: null,
    verification_notes: null,
    correlation_id: uuid(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
];

const seedConsentRecords = [
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    customer_id: CUSTOMER_IDS[0],
    consent_type: 'marketing',
    consent_granted: true,
    granted_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    revoked_at: null,
    method: 'web_form',
    legal_basis: 'consent',
    retention_days: 365,
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    metadata: { source: 'signup_page' },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    customer_id: CUSTOMER_IDS[1],
    consent_type: 'analytics',
    consent_granted: true,
    granted_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
    revoked_at: null,
    method: 'cookie_banner',
    legal_basis: 'consent',
    retention_days: 180,
    ip_address: '10.0.0.55',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    metadata: { source: 'homepage' },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    customer_id: CUSTOMER_IDS[2],
    consent_type: 'marketing',
    consent_granted: false, // Revoked
    granted_at: null,
    revoked_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    method: 'preference_center',
    legal_basis: null,
    retention_days: null,
    ip_address: '172.16.0.22',
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
    metadata: { reason: 'User requested removal from mailing list' },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    customer_id: CUSTOMER_IDS[3],
    consent_type: 'third_party_sharing',
    consent_granted: true,
    granted_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    revoked_at: null,
    method: 'api',
    legal_basis: 'consent',
    retention_days: null,
    ip_address: '203.0.113.45',
    user_agent: 'MyApp/3.2.1 (iOS)',
    metadata: { source: 'mobile_app' },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    customer_id: CUSTOMER_IDS[4],
    consent_type: 'profiling',
    consent_granted: true,
    granted_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    revoked_at: null,
    method: 'web_form',
    legal_basis: 'legitimate_interest',
    retention_days: 90,
    ip_address: '198.51.100.20',
    user_agent: 'Mozilla/5.0 (Linux; Android 13)',
    metadata: { source: 'checkout_page' },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
  },
];

/**
 * Shared mutable data store - singleton that persists across all API route instances
 * Uses globalThis to ensure the same store is used across hot reloads in development
 */
// Seed request activities
const seedRequestActivities = [
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    dsr_request_id: seedGdprRequests[0].id,
    action_task_id: null,
    pii_location_name: null,
    activity_type: 'request_created',
    description: 'Access request submitted for customer data',
    actor_type: 'user',
    actor_id: USER_IDS[0],
    actor_name: 'john.smith@example.com',
    previous_status: null,
    new_status: 'pending',
    details: { requestType: 'access' },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    dsr_request_id: seedGdprRequests[0].id,
    action_task_id: null,
    pii_location_name: null,
    activity_type: 'request_status_changed',
    description: 'Request moved to in progress',
    actor_type: 'user',
    actor_id: USER_IDS[1],
    actor_name: 'jane.doe@example.com',
    previous_status: 'pending',
    new_status: 'in_progress',
    details: {},
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    dsr_request_id: seedGdprRequests[1].id,
    action_task_id: null,
    pii_location_name: null,
    activity_type: 'request_created',
    description: 'Erasure request submitted - right to be forgotten',
    actor_type: 'system',
    actor_id: null,
    actor_name: null,
    previous_status: null,
    new_status: 'pending',
    details: { requestType: 'erasure', source: 'public_api' },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    dsr_request_id: seedGdprRequests[1].id,
    action_task_id: seedActionTasks[0]?.id,
    pii_location_name: 'PostgreSQL Users DB',
    activity_type: 'task_completed',
    description: 'User data deleted from primary database',
    actor_type: 'automation',
    actor_id: null,
    actor_name: null,
    previous_status: 'in_progress',
    new_status: 'completed',
    details: { recordsAffected: 1, executionTimeMs: 245 },
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
  },
  {
    id: uuid(),
    tenant_id: TENANT_ID,
    dsr_request_id: seedGdprRequests[1].id,
    action_task_id: seedActionTasks[1]?.id,
    pii_location_name: 'Salesforce CRM',
    activity_type: 'task_started',
    description: 'Manual deletion task assigned to sales-ops@example.com',
    actor_type: 'user',
    actor_id: USER_IDS[0],
    actor_name: 'john.smith@example.com',
    previous_status: 'pending',
    new_status: 'in_progress',
    details: {},
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
];

const globalStore = globalThis as unknown as {
  __mockDataStore?: {
    audit_logs: Record<string, unknown>[];
    data_subject_requests: Record<string, unknown>[];
    consent_records: Record<string, unknown>[];
    pii_locations: Record<string, unknown>[];
    action_tasks: Record<string, unknown>[];
    request_activities: Record<string, unknown>[];
  };
};

if (!globalStore.__mockDataStore) {
  globalStore.__mockDataStore = {
    audit_logs: [...seedAuditLogs],
    data_subject_requests: [...seedGdprRequests],
    consent_records: [...seedConsentRecords],
    pii_locations: [...seedPiiLocations],
    action_tasks: [...seedActionTasks],
    request_activities: [...seedRequestActivities],
  };
}

const dataStore = globalStore.__mockDataStore;

function getTableData(tableName: string): Record<string, unknown>[] {
  if (tableName.includes('request_activit')) {
    return dataStore.request_activities;
  } else if (tableName.includes('audit_log')) {
    return dataStore.audit_logs;
  } else if (tableName.includes('data_subject_request')) {
    return dataStore.data_subject_requests;
  } else if (tableName.includes('consent')) {
    return dataStore.consent_records;
  } else if (tableName.includes('pii_location')) {
    return dataStore.pii_locations;
  } else if (tableName.includes('action_task')) {
    return dataStore.action_tasks;
  }
  return [];
}

// Mock query builder - returns snake_case data (repositories do their own mapping)
class MockQueryBuilder {
  private tableName: string;
  private data: Record<string, unknown>[];
  private filters: Array<(item: Record<string, unknown>) => boolean> = [];
  private orderByColumn: string | null = null;
  private orderAsc = true;
  private limitCount: number | null = null;
  private offsetCount = 0;
  private isSingle = false;
  private shouldReturnCount = false;

  constructor(tableName: string, options?: { count?: string }) {
    this.tableName = tableName;
    this.shouldReturnCount = options?.count === 'exact';
    // Use shared data store - returns reference to the actual array
    this.data = [...getTableData(tableName)];
  }

  select(_columns?: string, options?: { count?: string }) {
    if (options?.count === 'exact') {
      this.shouldReturnCount = true;
    }
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((item) => item[column] === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push((item) => item[column] !== value);
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push((item) => {
      const itemVal = item[column];
      if (typeof itemVal === 'string' && typeof value === 'string') {
        return itemVal > value;
      }
      return (itemVal as number) > (value as number);
    });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push((item) => {
      const itemVal = item[column];
      if (typeof itemVal === 'string' && typeof value === 'string') {
        return itemVal >= value;
      }
      return (itemVal as number) >= (value as number);
    });
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push((item) => {
      const itemVal = item[column];
      if (typeof itemVal === 'string' && typeof value === 'string') {
        return itemVal < value;
      }
      return (itemVal as number) < (value as number);
    });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push((item) => {
      const itemVal = item[column];
      if (typeof itemVal === 'string' && typeof value === 'string') {
        return itemVal <= value;
      }
      return (itemVal as number) <= (value as number);
    });
    return this;
  }

  like(column: string, pattern: string) {
    const regex = new RegExp(pattern.replace(/%/g, '.*'), 'i');
    this.filters.push((item) => regex.test(String(item[column])));
    return this;
  }

  ilike(column: string, pattern: string) {
    return this.like(column, pattern);
  }

  in(column: string, values: unknown[]) {
    this.filters.push((item) => values.includes(item[column]));
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push((item) => item[column] === value);
    return this;
  }

  contains(column: string, value: unknown[]) {
    // Check if array column contains all values
    this.filters.push((item) => {
      const arr = item[column] as unknown[];
      if (!Array.isArray(arr)) return false;
      return value.every((v) => arr.includes(v));
    });
    return this;
  }

  or(conditions: string) {
    // Parse simple OR conditions like "name.ilike.%search%,description.ilike.%search%"
    const parts = conditions.split(',');
    this.filters.push((item) => {
      return parts.some((part) => {
        const match = part.match(/^(\w+)\.(\w+)\.(.+)$/);
        if (!match) return false;
        const [, col, op, val] = match;
        const itemVal = String(item[col] || '');
        if (op === 'ilike') {
          const pattern = val.replace(/%/g, '.*');
          return new RegExp(pattern, 'i').test(itemVal);
        }
        return false;
      });
    });
    return this;
  }

  not(column: string, op: string, value: unknown) {
    if (op === 'is') {
      this.filters.push((item) => item[column] !== value);
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderByColumn = column;
    this.orderAsc = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.offsetCount = from;
    this.limitCount = to - from + 1;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this;
  }

  async then<T>(
    resolve: (value: { data: T; error: null; count: number | null }) => void
  ) {
    // Apply filters
    let result = this.data.filter((item) => this.filters.every((fn) => fn(item)));

    // Apply ordering
    if (this.orderByColumn) {
      const col = this.orderByColumn;
      result.sort((a, b) => {
        const aVal = a[col];
        const bVal = b[col];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return this.orderAsc ? 1 : -1;
        if (bVal == null) return this.orderAsc ? -1 : 1;
        if (aVal < bVal) return this.orderAsc ? -1 : 1;
        if (aVal > bVal) return this.orderAsc ? 1 : -1;
        return 0;
      });
    }

    const totalCount = result.length;

    // Apply offset and limit
    if (this.offsetCount > 0) {
      result = result.slice(this.offsetCount);
    }
    if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount);
    }

    // Return snake_case data - repositories handle their own mapping
    if (this.isSingle) {
      resolve({
        data: (result[0] || null) as T,
        error: null,
        count: this.shouldReturnCount ? totalCount : null,
      });
    } else {
      resolve({
        data: result as T,
        error: null,
        count: this.shouldReturnCount ? totalCount : null,
      });
    }
  }
}

// Mock insert builder
class MockInsertBuilder {
  private tableName: string;
  private insertData: Record<string, unknown> | Record<string, unknown>[];
  private shouldSelect = false;
  private isSingle = false;

  constructor(tableName: string, data: Record<string, unknown> | Record<string, unknown>[]) {
    this.tableName = tableName;
    this.insertData = data;
  }

  select() {
    this.shouldSelect = true;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  async then<T>(
    resolve: (value: { data: T; error: null }) => void
  ) {
    const now = new Date().toISOString();
    const tableData = getTableData(this.tableName);

    if (Array.isArray(this.insertData)) {
      const results = this.insertData.map((item) => {
        const newItem = { ...item, id: item.id || uuid(), created_at: now, updated_at: now };
        tableData.push(newItem);
        return newItem;
      });
      resolve({
        data: (this.isSingle ? results[0] : results) as T,
        error: null,
      });
    } else {
      const newItem = { ...this.insertData, id: this.insertData.id || uuid(), created_at: now, updated_at: now };
      tableData.push(newItem);
      resolve({
        data: newItem as T,
        error: null,
      });
    }
  }
}

// Mock update builder
class MockUpdateBuilder {
  private tableName: string;
  private updateData: Record<string, unknown>;
  private filters: Array<(item: Record<string, unknown>) => boolean> = [];
  private shouldSelect = false;
  private isSingle = false;

  constructor(tableName: string, data: Record<string, unknown>) {
    this.tableName = tableName;
    this.updateData = data;
  }

  eq(column: string, value: unknown) {
    this.filters.push((item) => item[column] === value);
    return this;
  }

  select() {
    this.shouldSelect = true;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  async then<T>(
    resolve: (value: { data: T; error: null }) => void
  ) {
    const tableData = getTableData(this.tableName);
    const now = new Date().toISOString();
    const updatedItems: Record<string, unknown>[] = [];

    // Find and update matching items in the store
    for (let i = 0; i < tableData.length; i++) {
      const item = tableData[i];
      const matches = this.filters.length === 0 || this.filters.every((f) => f(item));
      if (matches) {
        // Update in place
        Object.assign(item, this.updateData, { updated_at: now });
        updatedItems.push(item);
      }
    }

    resolve({
      data: (this.isSingle ? updatedItems[0] : updatedItems) as T,
      error: null,
    });
  }
}

// Mock RPC builder for function calls (like set_tenant_context)
class MockRpcBuilder {
  private fnName: string;
  private params: Record<string, unknown>;

  constructor(fnName: string, params: Record<string, unknown>) {
    this.fnName = fnName;
    this.params = params;
  }

  async then<T>(
    resolve: (value: { data: T; error: null }) => void
  ) {
    // Return null for tenant context setting (it's just a side effect)
    if (this.fnName === 'set_tenant_context') {
      resolve({ data: null as T, error: null });
      return;
    }

    // Return mock metrics data for RPC calls
    if (this.fnName.includes('metrics') || this.fnName.includes('stats')) {
      resolve({
        data: {
          gdprRequests: {
            total: seedGdprRequests.length,
            pending: seedGdprRequests.filter((r) => r.status === 'pending').length,
            inProgress: seedGdprRequests.filter((r) => r.status === 'in_progress').length,
            completed: seedGdprRequests.filter((r) => r.status === 'completed').length,
            overdue: seedGdprRequests.filter((r) => new Date(r.due_date) < new Date() && r.status !== 'completed').length,
            avgResponseDays: 12,
            complianceRate: 85,
          },
          consent: {
            totalActive: seedConsentRecords.filter((c) => c.consent_granted).length,
            totalRevoked: seedConsentRecords.filter((c) => !c.consent_granted).length,
            consentRate: 80,
            recentWithdrawals: 1,
            byType: {
              marketing: 2,
              analytics: 1,
              third_party_sharing: 1,
              profiling: 1,
            },
          },
          audit: {
            totalEvents: seedAuditLogs.length,
            todayEvents: 3,
            gdprRelevantEvents: seedAuditLogs.filter((l) => l.is_gdpr_relevant).length,
            highRiskEvents: 0,
            byAction: {
              'gdpr_request.created': 1,
              'consent.granted': 1,
              'data.exported': 1,
            },
          },
        } as T,
        error: null,
      });
    } else {
      resolve({ data: null as T, error: null });
    }
  }
}

/**
 * Create a mock Supabase client for development
 */
export function createMockSupabaseClient(): SupabaseClient {
  const mockClient = {
    from: (table: string) => ({
      select: (columns?: string, options?: { count?: string }) => {
        const builder = new MockQueryBuilder(table, options);
        return builder.select(columns, options);
      },
      insert: (data: Record<string, unknown> | Record<string, unknown>[]) => {
        return new MockInsertBuilder(table, data);
      },
      update: (data: Record<string, unknown>) => {
        return new MockUpdateBuilder(table, data);
      },
      delete: () => ({
        eq: () => ({
          then: (resolve: (value: { error: null }) => void) => resolve({ error: null }),
        }),
      }),
    }),
    rpc: (fnName: string, params: Record<string, unknown> = {}) => {
      return new MockRpcBuilder(fnName, params);
    },
    auth: {
      getSession: async () => ({
        data: {
          session: {
            user: {
              id: 'mock-user-id',
              email: 'admin@example.com',
            },
          },
        },
        error: null,
      }),
      getUser: async () => ({
        data: {
          user: {
            id: 'mock-user-id',
            email: 'admin@example.com',
          },
        },
        error: null,
      }),
    },
  };

  return mockClient as unknown as SupabaseClient;
}

// Default tenant ID for the example app
export const MOCK_TENANT_ID = TENANT_ID;
export const MOCK_USER_ID = 'mock-admin-user-001';
