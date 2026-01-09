/**
 * Activity types for request processing
 */
export type ActivityType =
  // DSR lifecycle
  | 'request_created'
  | 'request_verified'
  | 'request_assigned'
  | 'request_status_changed'
  | 'request_completed'
  | 'request_rejected'
  // Action task lifecycle
  | 'task_created'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_skipped'
  // Notes and communication
  | 'note_added';

/**
 * Actor types - who performed the action
 */
export type ActorType = 'user' | 'system' | 'automation';

/**
 * Request activity log entry
 * Immutable record of actions taken on DSRs and their tasks
 */
export interface RequestActivity {
  id: string;
  tenantId: string;
  /** The DSR this activity relates to */
  dsrRequestId: string;
  /** The specific action task (if applicable) */
  actionTaskId: string | null;
  /** The PII location name (denormalized for display) */
  piiLocationName: string | null;
  /** What happened */
  activityType: ActivityType;
  /** Human-readable description */
  description: string;
  /** Who performed the action */
  actorType: ActorType;
  /** User ID if actor is a user */
  actorId: string | null;
  /** User name/email (denormalized for display) */
  actorName: string | null;
  /** Previous status (for status changes) */
  previousStatus: string | null;
  /** New status (for status changes) */
  newStatus: string | null;
  /** Additional context */
  details: Record<string, unknown> | null;
  /** When this happened */
  createdAt: Date;
}

/**
 * Input for creating an activity log entry
 */
export interface CreateActivityInput {
  dsrRequestId: string;
  actionTaskId?: string;
  piiLocationName?: string;
  activityType: ActivityType;
  description: string;
  actorType: ActorType;
  actorId?: string;
  actorName?: string;
  previousStatus?: string;
  newStatus?: string;
  details?: Record<string, unknown>;
}

/**
 * Filters for querying activities
 */
export interface ActivityFilters {
  dsrRequestId?: string;
  actionTaskId?: string;
  activityType?: ActivityType | ActivityType[];
  actorType?: ActorType;
  actorId?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Query options for activities
 */
export interface ActivityQueryOptions extends ActivityFilters {
  limit?: number;
  offset?: number;
  orderDirection?: 'asc' | 'desc';
}

/**
 * Activity summary for a DSR
 */
export interface ActivitySummary {
  totalActivities: number;
  lastActivity: RequestActivity | null;
  taskCompletions: number;
  taskFailures: number;
}

// =============================================================================
// BACKWARDS COMPATIBILITY ALIASES
// =============================================================================

/** @deprecated Use ActorType instead */
export type AuditActorType = 'user' | 'system' | 'api' | 'workflow' | 'automation';

/** @deprecated Use ActivityType instead */
export type AuditAction = ActivityType | string;

/** @deprecated Use 'data_subject_request' | 'action_task' instead */
export type AuditResourceType = 'data_subject_request' | 'action_task' | string;

/** @deprecated Use RequestActivity instead */
export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string | null;
  actorType: AuditActorType;
  action: string;
  resourceType: string;
  resourceId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: AuditLogMetadata;
  createdAt: Date;
}

/** @deprecated */
export interface AuditLogMetadata {
  correlationId?: string;
  workflowId?: string;
  sessionId?: string;
  gdprRelevant?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
  [key: string]: unknown;
}

/** @deprecated Use CreateActivityInput instead */
export interface CreateAuditLogInput {
  userId?: string;
  actorType: AuditActorType;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: AuditLogMetadata;
}

/** @deprecated Use ActivityFilters instead */
export interface AuditLogFilters {
  userId?: string;
  actorType?: AuditActorType;
  action?: string | string[];
  resourceType?: string;
  resourceId?: string;
  gdprRelevant?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

/** @deprecated Use ActivityQueryOptions instead */
export interface AuditLogQueryOptions extends AuditLogFilters {
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt';
  orderDirection?: 'asc' | 'desc';
}
