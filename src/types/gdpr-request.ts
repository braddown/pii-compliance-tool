/**
 * Types of GDPR data subject requests
 */
export type GDPRRequestType =
  | 'access'        // Article 15 - Right of access
  | 'rectification' // Article 16 - Right to rectification
  | 'erasure'       // Article 17 - Right to erasure (right to be forgotten)
  | 'restriction'   // Article 18 - Right to restriction of processing
  | 'portability'   // Article 20 - Right to data portability
  | 'objection';    // Article 21 - Right to object

/**
 * Status of a GDPR request
 */
export type GDPRRequestStatus =
  | 'pending'
  | 'in_progress'
  | 'review'
  | 'completed'
  | 'rejected'
  | 'cancelled';

/**
 * Priority level for GDPR requests
 */
export type GDPRRequestPriority = 'low' | 'medium' | 'high' | 'urgent';

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
 * GDPR Data Subject Request
 */
export interface GDPRRequest {
  id: string;
  tenantId: string;
  customerId: string | null;
  requestType: GDPRRequestType;
  status: GDPRRequestStatus;
  priority: GDPRRequestPriority;
  requesterEmail: string;
  requesterPhone: string | null;
  verificationMethod: VerificationMethod | null;
  verifiedAt: Date | null;
  assignedTo: string | null;
  notes: string | null;
  metadata: GDPRRequestMetadata;
  requestedAt: Date;
  dueDate: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Metadata for GDPR requests
 */
export interface GDPRRequestMetadata {
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
  [key: string]: unknown;
}

/**
 * Input for creating a GDPR request
 */
export interface CreateGDPRRequestInput {
  customerId?: string;
  requestType: GDPRRequestType;
  requesterEmail: string;
  requesterPhone?: string;
  priority?: GDPRRequestPriority;
  notes?: string;
  metadata?: Partial<GDPRRequestMetadata>;
}

/**
 * Input for updating a GDPR request
 */
export interface UpdateGDPRRequestInput {
  status?: GDPRRequestStatus;
  priority?: GDPRRequestPriority;
  assignedTo?: string | null;
  verificationMethod?: VerificationMethod;
  verifiedAt?: Date;
  notes?: string;
  metadata?: Partial<GDPRRequestMetadata>;
}

/**
 * Filters for querying GDPR requests
 */
export interface GDPRRequestFilters {
  requestType?: GDPRRequestType | GDPRRequestType[];
  status?: GDPRRequestStatus | GDPRRequestStatus[];
  priority?: GDPRRequestPriority | GDPRRequestPriority[];
  assignedTo?: string;
  customerId?: string;
  overdue?: boolean;
  dueSoon?: boolean; // Due within 7 days
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

/**
 * Query options for GDPR requests
 */
export interface GDPRRequestQueryOptions extends GDPRRequestFilters {
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'dueDate' | 'priority' | 'status';
  orderDirection?: 'asc' | 'desc';
}

/**
 * GDPR request metrics
 */
export interface GDPRRequestMetrics {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  dueSoon: number;
  avgResponseDays: number;
  complianceRate: number;
  byType: Record<GDPRRequestType, number>;
}

/**
 * Status history entry for GDPR requests
 */
export interface GDPRStatusHistoryEntry {
  status: GDPRRequestStatus;
  changedAt: Date;
  changedBy: string;
  notes?: string;
}

/**
 * GDPR Article reference
 */
export const GDPR_ARTICLES: Record<GDPRRequestType, { article: number; title: string }> = {
  access: { article: 15, title: 'Right of access by the data subject' },
  rectification: { article: 16, title: 'Right to rectification' },
  erasure: { article: 17, title: 'Right to erasure (right to be forgotten)' },
  restriction: { article: 18, title: 'Right to restriction of processing' },
  portability: { article: 20, title: 'Right to data portability' },
  objection: { article: 21, title: 'Right to object' },
};

/**
 * GDPR compliance deadline in days (Article 12)
 */
export const GDPR_RESPONSE_DEADLINE_DAYS = 30;
