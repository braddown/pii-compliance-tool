/**
 * Types of data subject requests (DSR)
 * These rights are common across privacy regulations (GDPR, CCPA, APP, etc.)
 */
export type DSRType =
  | 'access'        // Right of access to personal data
  | 'rectification' // Right to rectification/correction
  | 'erasure'       // Right to erasure/deletion
  | 'restriction'   // Right to restriction of processing
  | 'portability'   // Right to data portability
  | 'objection'     // Right to object to processing
  | 'consent';      // Request for consent records/proof

/**
 * Status of a data subject request
 */
export type DSRStatus =
  | 'pending_verification'  // Awaiting email verification (public submissions)
  | 'pending'
  | 'in_progress'
  | 'review'
  | 'completed'
  | 'rejected'
  | 'cancelled';

/**
 * Priority level for data subject requests
 */
export type DSRPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Method used to verify requester identity
 */
export type VerificationMethod =
  | 'email'
  | 'phone'
  | 'in_person'
  | 'verified_id'
  | 'two_factor';

/**
 * Data Subject Request
 */
export interface DataSubjectRequest {
  id: string;
  tenantId: string;
  customerId: string | null;
  requestType: DSRType;
  status: DSRStatus;
  priority: DSRPriority;
  requesterEmail: string;
  requesterPhone: string | null;
  verificationMethod: VerificationMethod | null;
  verifiedAt: Date | null;
  assignedTo: string | null;
  notes: string | null;
  metadata: DSRMetadata;
  requestedAt: Date;
  dueDate: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Metadata for data subject requests
 */
export interface DSRMetadata {
  dataExportUrl?: string;
  deletionScope?: string[];
  rectificationFields?: Record<string, { old: unknown; new: unknown }>;
  rejectionReason?: string;
  processingNotes?: Array<{
    timestamp: Date;
    note: string;
    author: string;
  }>;
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    uploadedAt: Date;
  }>;
  // Public submission verification fields
  verificationToken?: string;
  verificationExpiresAt?: string;
  submissionSource?: 'public_api' | 'dashboard' | 'email' | 'integration';
  submitterName?: string;
  submitterIpAddress?: string;
  submitterUserAgent?: string;
  [key: string]: unknown;
}

/**
 * Input for public request submission (external parties)
 */
export interface PublicRequestSubmissionInput {
  requestType: DSRType;
  email: string;
  name?: string;
  description?: string;
}

/**
 * Response for public request submission
 */
export interface PublicRequestSubmissionResponse {
  success: boolean;
  message: string;
  requestId: string;
  verificationRequired: boolean;
  expiresAt?: string;
}

/**
 * Verification callback configuration
 */
export interface VerificationCallbackConfig {
  /** URL to call when verification email needs to be sent */
  sendVerificationEmail?: (params: {
    email: string;
    requestId: string;
    verificationToken: string;
    verificationUrl: string;
    requestType: DSRType;
    expiresAt: Date;
  }) => Promise<void>;
  /** Base URL for verification links (e.g., https://yoursite.com/verify-request) */
  verificationBaseUrl?: string;
  /** Token expiration in hours (default: 24) */
  tokenExpirationHours?: number;
}

/**
 * Input for creating a data subject request
 */
export interface CreateDSRInput {
  customerId?: string;
  requestType: DSRType;
  requesterEmail: string;
  requesterPhone?: string;
  priority?: DSRPriority;
  notes?: string;
  metadata?: Partial<DSRMetadata>;
}

/**
 * Input for updating a data subject request
 */
export interface UpdateDSRInput {
  status?: DSRStatus;
  priority?: DSRPriority;
  assignedTo?: string | null;
  verificationMethod?: VerificationMethod;
  verifiedAt?: Date;
  notes?: string;
  metadata?: Partial<DSRMetadata>;
}

/**
 * Filters for querying data subject requests
 */
export interface DSRFilters {
  requestType?: DSRType | DSRType[];
  status?: DSRStatus | DSRStatus[];
  priority?: DSRPriority | DSRPriority[];
  assignedTo?: string;
  customerId?: string;
  overdue?: boolean;
  dueSoon?: boolean; // Due within 7 days
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

/**
 * Query options for data subject requests
 */
export interface DSRQueryOptions extends DSRFilters {
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'dueDate' | 'priority' | 'status';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Data subject request metrics
 */
export interface DSRMetrics {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  dueSoon: number;
  avgResponseDays: number;
  complianceRate: number;
  byType: Record<DSRType, number>;
}

/**
 * Status history entry for data subject requests
 */
export interface DSRStatusHistoryEntry {
  status: DSRStatus;
  changedAt: Date;
  changedBy: string;
  notes?: string;
}

/**
 * Privacy regulation article references
 * Maps request types to relevant articles across regulations
 */
export const PRIVACY_REGULATION_ARTICLES: Record<DSRType, { gdpr?: number; ccpa?: string; title: string }> = {
  access: { gdpr: 15, ccpa: '1798.100', title: 'Right of access' },
  rectification: { gdpr: 16, title: 'Right to rectification' },
  erasure: { gdpr: 17, ccpa: '1798.105', title: 'Right to erasure/deletion' },
  restriction: { gdpr: 18, title: 'Right to restriction of processing' },
  portability: { gdpr: 20, ccpa: '1798.100', title: 'Right to data portability' },
  objection: { gdpr: 21, ccpa: '1798.120', title: 'Right to object/opt-out' },
  consent: { gdpr: 7, title: 'Right to consent records/proof' },
};

/**
 * Default response deadline in days (common across regulations)
 */
export const DSR_RESPONSE_DEADLINE_DAYS = 30;

// =============================================================================
// BACKWARDS COMPATIBILITY ALIASES
// These are deprecated and will be removed in a future version
// =============================================================================

/** @deprecated Use DSRType instead */
export type GDPRRequestType = DSRType;

/** @deprecated Use DSRStatus instead */
export type GDPRRequestStatus = DSRStatus;

/** @deprecated Use DSRPriority instead */
export type GDPRRequestPriority = DSRPriority;

/** @deprecated Use DataSubjectRequest instead */
export type GDPRRequest = DataSubjectRequest;

/** @deprecated Use DSRMetadata instead */
export type GDPRRequestMetadata = DSRMetadata;

/** @deprecated Use CreateDSRInput instead */
export type CreateGDPRRequestInput = CreateDSRInput;

/** @deprecated Use UpdateDSRInput instead */
export type UpdateGDPRRequestInput = UpdateDSRInput;

/** @deprecated Use DSRFilters instead */
export type GDPRRequestFilters = DSRFilters;

/** @deprecated Use DSRQueryOptions instead */
export type GDPRRequestQueryOptions = DSRQueryOptions;

/** @deprecated Use DSRMetrics instead */
export type GDPRRequestMetrics = DSRMetrics;

/** @deprecated Use DSRStatusHistoryEntry instead */
export type GDPRStatusHistoryEntry = DSRStatusHistoryEntry;

/** @deprecated Use PRIVACY_REGULATION_ARTICLES instead */
export const GDPR_ARTICLES = PRIVACY_REGULATION_ARTICLES;

/** @deprecated Use DSR_RESPONSE_DEADLINE_DAYS instead */
export const GDPR_RESPONSE_DEADLINE_DAYS = DSR_RESPONSE_DEADLINE_DAYS;
