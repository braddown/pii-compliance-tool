/**
 * Types of consent that can be tracked
 */
export type ConsentType =
  | 'sms_marketing'
  | 'sms_transactional'
  | 'email_marketing'
  | 'email_transactional'
  | 'data_processing'
  | 'data_sharing'
  | 'analytics'
  | 'functional_cookies'
  | 'advertising_cookies'
  | string; // Allow custom consent types

/**
 * Legal basis for data processing (GDPR Article 6)
 */
export type LegalBasis =
  | 'consent'
  | 'contract'
  | 'legal_obligation'
  | 'vital_interests'
  | 'public_task'
  | 'legitimate_interests';

/**
 * Method used to capture consent
 */
export type ConsentMethod =
  | 'web_form'
  | 'mobile_app'
  | 'api'
  | 'sms_reply'
  | 'phone_call'
  | 'in_person'
  | 'import'
  | string;

/**
 * Consent record - immutable record of consent granted or revoked
 */
export interface ConsentRecord {
  id: string;
  tenantId: string;
  customerId: string;
  consentType: ConsentType;
  consentGranted: boolean;
  grantedAt: Date | null;
  revokedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
  method: ConsentMethod;
  legalBasis: LegalBasis | null;
  retentionDays: number | null;
  metadata: ConsentMetadata;
  createdAt: Date;
}

/**
 * Metadata attached to consent records
 */
export interface ConsentMetadata {
  formVersion?: string;
  campaignId?: string;
  source?: string;
  consentText?: string;
  witnessId?: string;
  [key: string]: unknown;
}

/**
 * Input for granting consent (used by grantConsent)
 */
export interface CreateConsentInput {
  customerId: string;
  consentType: ConsentType;
  ipAddress?: string;
  userAgent?: string;
  method: ConsentMethod;
  legalBasis?: LegalBasis;
  retentionDays?: number;
  metadata?: ConsentMetadata;
}

/**
 * Input for revoking consent
 */
export interface RevokeConsentInput {
  customerId: string;
  consentType: ConsentType;
  ipAddress?: string;
  userAgent?: string;
  method?: ConsentMethod;
  reason?: string;
}

/**
 * Filters for querying consent records
 */
export interface ConsentFilters {
  customerId?: string;
  consentType?: ConsentType | ConsentType[];
  consentGranted?: boolean;
  method?: ConsentMethod;
  legalBasis?: LegalBasis;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Query options for consent records
 */
export interface ConsentQueryOptions extends ConsentFilters {
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'grantedAt' | 'revokedAt';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Summary of consent status for a customer
 */
export interface CustomerConsentSummary {
  customerId: string;
  consents: {
    [consentType: string]: {
      granted: boolean;
      grantedAt: Date | null;
      revokedAt: Date | null;
      method: ConsentMethod;
      legalBasis: LegalBasis | null;
    };
  };
  lastUpdated: Date;
}

/**
 * Consent analytics/metrics
 */
export interface ConsentMetrics {
  totalActive: number;
  totalRevoked: number;
  consentRate: number;
  byType: Record<string, { granted: number; revoked: number }>;
  byMethod: Record<string, number>;
  recentWithdrawals: number;
}
