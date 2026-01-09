/**
 * PII Location types
 *
 * Defines the registry of systems/locations where PII is stored.
 * Each location can be configured for automated or manual action execution.
 */

import type { GDPRRequestType } from './data-subject-request';
import type { AutomatedActionConfig, ManualActionConfig } from './action-config';

// =====================================================
// ENUMS AND CONSTANTS
// =====================================================

/**
 * Types of systems where PII can be stored
 */
export type PIISystemType =
  | 'database'      // Direct database access (PostgreSQL, MySQL, MongoDB)
  | 'api'           // External API (SaaS, internal microservice)
  | 'manual'        // Manual process (CRM without API, paper records)
  | 'file_storage'  // File storage (S3, GCS, local filesystem)
  | 'third_party';  // Third-party vendor requiring coordination

/**
 * Execution types for PII actions
 */
export type PIIExecutionType =
  | 'automated'      // Fully automated via API/webhook
  | 'semi_automated' // Automated execution with manual verification
  | 'manual';        // Requires human action following instructions

/**
 * All valid system types
 */
export const PII_SYSTEM_TYPES: PIISystemType[] = [
  'database',
  'api',
  'manual',
  'file_storage',
  'third_party',
];

/**
 * All valid execution types
 */
export const PII_EXECUTION_TYPES: PIIExecutionType[] = [
  'automated',
  'semi_automated',
  'manual',
];

// =====================================================
// MAIN TYPES
// =====================================================

/**
 * Configuration for querying consent proof from a system
 */
export interface ConsentQueryConfig {
  /** How to retrieve consent proof */
  queryType: 'api' | 'database' | 'manual';
  /** For API: endpoint URL template (use {{customerId}}) */
  endpoint?: string;
  /** For database: SQL query template */
  query?: string;
  /** For manual: instructions for retrieving proof */
  instructions?: string;
  /** Fields in the response that contain consent data */
  responseMapping?: {
    consentField: string;
    grantedAtField?: string;
    proofField?: string;
  };
}

/**
 * Metadata for PII locations
 */
export interface PIILocationMetadata {
  /** External integration ID */
  integrationId?: string;
  /** Last sync timestamp */
  lastSyncAt?: Date;
  /** Approximate record count */
  recordCount?: number;
  /** Custom tags */
  tags?: string[];
  /** Additional custom fields */
  [key: string]: unknown;
}

/**
 * PII Data Location - Registry entry for a system containing PII
 */
export interface PIILocation {
  /** Unique identifier */
  id: string;
  /** Tenant ID for multi-tenant isolation */
  tenantId: string;
  /** Human-readable name (e.g., "Salesforce CRM", "PostgreSQL Users DB") */
  name: string;
  /** Detailed description of what PII is stored */
  description: string | null;
  /** Type of system */
  systemType: PIISystemType;
  /** How actions are executed */
  executionType: PIIExecutionType;
  /** GDPR request types this location supports */
  supportedRequestTypes: GDPRRequestType[];
  /** Execution priority (lower = first) */
  priorityOrder: number;
  /** Configuration for automated or manual actions */
  actionConfig: AutomatedActionConfig | ManualActionConfig;
  /** Technical owner email for escalations */
  ownerEmail: string | null;
  /** Team responsible for this location */
  ownerTeam: string | null;
  /** List of PII fields stored (e.g., ["email", "phone", "name"]) */
  piiFields: string[];
  /** GDPR data categories (e.g., ["contact_info", "financial"]) */
  dataCategories: string[];
  /** Consent types tracked in this system (e.g., ["email_marketing", "sms_opt_in"]) */
  consentFields: string[];
  /** Configuration for querying consent proof */
  consentQueryConfig: ConsentQueryConfig | null;
  /** Whether this location is active */
  isActive: boolean;
  /** When configuration was last verified working */
  lastVerifiedAt: Date | null;
  /** Additional metadata */
  metadata: PIILocationMetadata;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

// =====================================================
// INPUT TYPES
// =====================================================

/**
 * Input for creating a PII location
 */
export interface CreatePIILocationInput {
  /** Human-readable name */
  name: string;
  /** Detailed description */
  description?: string;
  /** Type of system */
  systemType: PIISystemType;
  /** How actions are executed */
  executionType: PIIExecutionType;
  /** GDPR request types this location supports */
  supportedRequestTypes?: GDPRRequestType[];
  /** Execution priority (lower = first) */
  priorityOrder?: number;
  /** Configuration for automated or manual actions */
  actionConfig: AutomatedActionConfig | ManualActionConfig;
  /** Technical owner email */
  ownerEmail?: string;
  /** Team responsible */
  ownerTeam?: string;
  /** List of PII fields stored */
  piiFields?: string[];
  /** GDPR data categories */
  dataCategories?: string[];
  /** Consent types tracked in this system */
  consentFields?: string[];
  /** Configuration for querying consent proof */
  consentQueryConfig?: ConsentQueryConfig;
  /** Additional metadata */
  metadata?: PIILocationMetadata;
}

/**
 * Input for updating a PII location
 */
export interface UpdatePIILocationInput {
  /** Human-readable name */
  name?: string;
  /** Detailed description */
  description?: string | null;
  /** How actions are executed */
  executionType?: PIIExecutionType;
  /** GDPR request types this location supports */
  supportedRequestTypes?: GDPRRequestType[];
  /** Execution priority */
  priorityOrder?: number;
  /** Configuration for automated or manual actions */
  actionConfig?: AutomatedActionConfig | ManualActionConfig;
  /** Technical owner email */
  ownerEmail?: string | null;
  /** Team responsible */
  ownerTeam?: string | null;
  /** List of PII fields stored */
  piiFields?: string[];
  /** GDPR data categories */
  dataCategories?: string[];
  /** Consent types tracked in this system */
  consentFields?: string[];
  /** Configuration for querying consent proof */
  consentQueryConfig?: ConsentQueryConfig | null;
  /** Whether this location is active */
  isActive?: boolean;
  /** When configuration was last verified */
  lastVerifiedAt?: Date | null;
  /** Additional metadata (merged with existing) */
  metadata?: Partial<PIILocationMetadata>;
}

// =====================================================
// QUERY TYPES
// =====================================================

/**
 * Filters for querying PII locations
 */
export interface PIILocationFilters {
  /** Filter by system type(s) */
  systemType?: PIISystemType | PIISystemType[];
  /** Filter by execution type(s) */
  executionType?: PIIExecutionType | PIIExecutionType[];
  /** Filter by supported request type */
  supportedRequestType?: GDPRRequestType;
  /** Filter by active status */
  isActive?: boolean;
  /** Filter by owner team */
  ownerTeam?: string;
  /** Full-text search on name and description */
  search?: string;
}

/**
 * Query options for PII locations
 */
export interface PIILocationQueryOptions extends PIILocationFilters {
  /** Maximum results to return */
  limit?: number;
  /** Number of results to skip */
  offset?: number;
  /** Field to order by */
  orderBy?: 'name' | 'priorityOrder' | 'createdAt' | 'updatedAt';
  /** Order direction */
  orderDirection?: 'asc' | 'desc';
}

// =====================================================
// RESPONSE TYPES
// =====================================================

/**
 * Summary statistics for PII locations
 */
export interface PIILocationSummary {
  /** Total number of locations */
  total: number;
  /** Number of active locations */
  active: number;
  /** Breakdown by system type */
  bySystemType: Record<PIISystemType, number>;
  /** Breakdown by execution type */
  byExecutionType: Record<PIIExecutionType, number>;
  /** Number of locations needing verification */
  needsVerification: number;
}
