import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Feature flags for the compliance module
 */
export interface ComplianceFeatures {
  auditLogs?: boolean;
  gdprRequests?: boolean;
  consentManagement?: boolean;
  reports?: boolean;
  privacyDashboard?: boolean;
}

/**
 * Theme configuration
 */
export type ComplianceTheme = 'light' | 'dark' | 'system';

/**
 * CSS class name overrides for components
 */
export interface ComplianceClassNames {
  // Layout
  container?: string;
  card?: string;
  cardHeader?: string;
  cardContent?: string;

  // Tables
  table?: string;
  tableHeader?: string;
  tableRow?: string;
  tableCell?: string;

  // Forms
  input?: string;
  select?: string;
  button?: string;
  buttonPrimary?: string;
  buttonSecondary?: string;
  buttonDanger?: string;

  // Status badges
  badge?: string;
  badgeSuccess?: string;
  badgeWarning?: string;
  badgeDanger?: string;
  badgeInfo?: string;

  // Modals
  modal?: string;
  modalOverlay?: string;
  modalContent?: string;

  // Tabs
  tabList?: string;
  tab?: string;
  tabActive?: string;
  tabPanel?: string;
}

/**
 * Localization options
 */
export interface ComplianceLocale {
  locale: string;
  dateFormat?: string;
  timeFormat?: string;
  translations?: Partial<ComplianceTranslations>;
}

/**
 * Translatable strings
 */
export interface ComplianceTranslations {
  // Common
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  view: string;
  export: string;
  loading: string;
  noData: string;

  // Tabs
  tabOverview: string;
  tabGdprRequests: string;
  tabAuditLogs: string;
  tabConsent: string;
  tabReports: string;
  tabPrivacy: string;

  // GDPR Request types
  requestTypeAccess: string;
  requestTypeRectification: string;
  requestTypeErasure: string;
  requestTypeRestriction: string;
  requestTypePortability: string;
  requestTypeObjection: string;

  // Status
  statusPending: string;
  statusInProgress: string;
  statusReview: string;
  statusCompleted: string;
  statusRejected: string;
  statusCancelled: string;
}

/**
 * Error handler callback
 */
export type ComplianceErrorHandler = (error: Error, context?: Record<string, unknown>) => void;

/**
 * Audit event callback for custom logging
 */
export interface AuditEventCallback {
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Main configuration for ComplianceProvider
 */
export interface ComplianceConfig {
  /**
   * Supabase client instance from the host application
   */
  supabase: SupabaseClient;

  /**
   * Current tenant ID for multi-tenant isolation
   */
  tenantId: string;

  /**
   * Current user ID for audit logging (optional)
   */
  userId?: string;

  /**
   * Base path for API routes (default: '/api/compliance')
   */
  apiBasePath?: string;

  /**
   * Feature flags to enable/disable specific features
   */
  features?: ComplianceFeatures;

  /**
   * Theme configuration
   */
  theme?: ComplianceTheme;

  /**
   * CSS class name overrides
   */
  classNames?: Partial<ComplianceClassNames>;

  /**
   * Localization settings
   */
  locale?: ComplianceLocale;

  /**
   * Error handler for component/API errors
   */
  onError?: ComplianceErrorHandler;

  /**
   * Callback for custom audit event logging
   */
  onAuditEvent?: (event: AuditEventCallback) => Promise<void>;

  /**
   * Single tenant mode (disables tenant context checks)
   */
  singleTenantMode?: boolean;

  /**
   * Custom table prefix (default: 'compliance_')
   */
  tablePrefix?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Partial<ComplianceConfig> = {
  apiBasePath: '/api/compliance',
  features: {
    auditLogs: true,
    gdprRequests: true,
    consentManagement: true,
    reports: true,
    privacyDashboard: true,
  },
  theme: 'system',
  singleTenantMode: false,
  tablePrefix: 'compliance_',
};
