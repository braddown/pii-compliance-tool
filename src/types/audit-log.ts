/**
 * Actor types for audit log entries
 */
export type AuditActorType = 'user' | 'system' | 'api' | 'workflow';

/**
 * Common audit event actions
 */
export type AuditAction =
  | 'data_access'
  | 'data_export'
  | 'data_deletion'
  | 'consent_updated'
  | 'consent_granted'
  | 'consent_revoked'
  | 'gdpr_request_created'
  | 'gdpr_request_updated'
  | 'gdpr_request_completed'
  | 'user_login'
  | 'user_logout'
  | 'settings_changed'
  | 'message_sent'
  | 'message_received'
  | string; // Allow custom actions

/**
 * Resource types that can be audited
 */
export type AuditResourceType =
  | 'customer'
  | 'consent_record'
  | 'gdpr_request'
  | 'message'
  | 'journey'
  | 'settings'
  | 'user'
  | string; // Allow custom resource types

/**
 * Audit log entry - immutable record of system activity
 */
export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string | null;
  actorType: AuditActorType;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: AuditLogMetadata;
  createdAt: Date;
}

/**
 * Metadata that can be attached to audit log entries
 */
export interface AuditLogMetadata {
  correlationId?: string;
  workflowId?: string;
  sessionId?: string;
  gdprRelevant?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
  [key: string]: unknown;
}

/**
 * Input for creating an audit log entry
 */
export interface CreateAuditLogInput {
  userId?: string;
  actorType: AuditActorType;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: AuditLogMetadata;
}

/**
 * Filters for querying audit logs
 */
export interface AuditLogFilters {
  userId?: string;
  actorType?: AuditActorType;
  action?: AuditAction | AuditAction[];
  resourceType?: AuditResourceType;
  resourceId?: string;
  gdprRelevant?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

/**
 * Pagination options for audit log queries
 */
export interface AuditLogQueryOptions extends AuditLogFilters {
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt';
  orderDirection?: 'asc' | 'desc';
}
