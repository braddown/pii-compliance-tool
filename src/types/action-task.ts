/**
 * Action Task types
 *
 * Tracks the execution of a GDPR request against each PII location.
 * Each task represents one location's contribution to fulfilling a request.
 */

import type { GDPRRequestType, GDPRRequest } from './data-subject-request';
import type { PIILocation } from './pii-location';

// =====================================================
// ENUMS AND CONSTANTS
// =====================================================

/**
 * Status of an action task
 */
export type ActionTaskStatus =
  | 'pending'           // Waiting to be started
  | 'in_progress'       // Currently being executed
  | 'awaiting_callback' // Webhook sent, waiting for callback
  | 'manual_action'     // Requires manual human action
  | 'verification'      // Automated complete, awaiting verification
  | 'completed'         // Successfully completed
  | 'failed'            // Failed (retryable)
  | 'blocked'           // Cannot proceed (dependency/issue)
  | 'skipped';          // Explicitly skipped (not applicable)

/**
 * All valid task statuses
 */
export const ACTION_TASK_STATUSES: ActionTaskStatus[] = [
  'pending',
  'in_progress',
  'awaiting_callback',
  'manual_action',
  'verification',
  'completed',
  'failed',
  'blocked',
  'skipped',
];

/**
 * Terminal statuses (task is finished)
 */
export const TERMINAL_STATUSES: ActionTaskStatus[] = [
  'completed',
  'failed',
  'blocked',
  'skipped',
];

/**
 * Active statuses (task is in progress)
 */
export const ACTIVE_STATUSES: ActionTaskStatus[] = [
  'in_progress',
  'awaiting_callback',
  'manual_action',
  'verification',
];

// =====================================================
// RESULT TYPES
// =====================================================

/**
 * Execution result structure
 */
export interface ActionTaskResult {
  /** Raw API response (for automated tasks) */
  apiResponse?: unknown;
  /** HTTP status code (for automated tasks) */
  httpStatus?: number;
  /** Number of records affected */
  recordsAffected?: number;
  /** Error message if failed */
  errorMessage?: string | null;
  /** Manual confirmation message */
  manualConfirmation?: string;
  /** Checklist completion status */
  checklistCompleted?: Record<string, boolean>;
  /** Whether webhook callback was received */
  webhookReceived?: boolean;
  /** Webhook callback payload */
  webhookPayload?: unknown;
  /** Execution duration in milliseconds */
  durationMs?: number;
  /** Additional custom fields */
  [key: string]: unknown;
}

// =====================================================
// MAIN TYPES
// =====================================================

/**
 * Action Task - Execution of a GDPR request against a PII location
 */
export interface ActionTask {
  /** Unique identifier */
  id: string;
  /** Tenant ID for multi-tenant isolation */
  tenantId: string;
  /** Reference to the GDPR request */
  dsrRequestId: string;
  /** Reference to the PII location */
  piiLocationId: string;
  /** Type of task (matches GDPR request type) */
  taskType: GDPRRequestType;
  /** Current status */
  status: ActionTaskStatus;
  /** User assigned to manual tasks */
  assignedTo: string | null;
  /** When task was assigned */
  assignedAt: Date | null;
  /** When execution started */
  startedAt: Date | null;
  /** When task completed (success or failure) */
  completedAt: Date | null;
  /** Number of execution attempts */
  attemptCount: number;
  /** Maximum allowed attempts */
  maxAttempts: number;
  /** When last attempt occurred */
  lastAttemptAt: Date | null;
  /** When next retry should occur */
  nextRetryAt: Date | null;
  /** Execution result details */
  executionResult: ActionTaskResult;
  /** Human notes about execution */
  notes: string | null;
  /** User who verified completion */
  verifiedBy: string | null;
  /** When verification occurred */
  verifiedAt: Date | null;
  /** Verification notes */
  verificationNotes: string | null;
  /** Correlation ID for audit log linking */
  correlationId: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;

  // Expanded relationships (populated on demand)
  /** Expanded PII location details */
  piiLocation?: PIILocation;
  /** Expanded GDPR request details */
  dsrRequest?: GDPRRequest;
}

// =====================================================
// INPUT TYPES
// =====================================================

/**
 * Input for creating an action task (usually created automatically)
 */
export interface CreateActionTaskInput {
  /** Reference to the GDPR request */
  dsrRequestId: string;
  /** Reference to the PII location */
  piiLocationId: string;
  /** Type of task */
  taskType: GDPRRequestType;
  /** Initial status (defaults based on location execution type) */
  status?: ActionTaskStatus;
  /** User to assign manual tasks to */
  assignedTo?: string;
  /** Initial notes */
  notes?: string;
}

/**
 * Input for updating an action task
 */
export interface UpdateActionTaskInput {
  /** New status */
  status?: ActionTaskStatus;
  /** User assignment */
  assignedTo?: string | null;
  /** Execution result (merged with existing) */
  executionResult?: Partial<ActionTaskResult>;
  /** Notes */
  notes?: string;
  /** Verification user */
  verifiedBy?: string;
  /** Verification notes */
  verificationNotes?: string;
  /** Next retry timestamp */
  nextRetryAt?: Date | null;
}

/**
 * Input for completing a task
 */
export interface CompleteActionTaskInput {
  /** Execution result details */
  result: ActionTaskResult;
  /** Optional notes */
  notes?: string;
}

/**
 * Input for failing a task
 */
export interface FailActionTaskInput {
  /** Error message */
  errorMessage: string;
  /** Whether to schedule a retry */
  scheduleRetry?: boolean;
  /** Optional notes */
  notes?: string;
}

// =====================================================
// QUERY TYPES
// =====================================================

/**
 * Filters for querying action tasks
 */
export interface ActionTaskFilters {
  /** Filter by GDPR request ID */
  dsrRequestId?: string;
  /** Filter by PII location ID */
  piiLocationId?: string;
  /** Filter by task type(s) */
  taskType?: GDPRRequestType | GDPRRequestType[];
  /** Filter by status(es) */
  status?: ActionTaskStatus | ActionTaskStatus[];
  /** Filter by assigned user */
  assignedTo?: string;
  /** Filter for tasks with errors */
  hasErrors?: boolean;
  /** Filter for tasks needing retry */
  needsRetry?: boolean;
  /** Filter for tasks awaiting callbacks */
  awaitingCallback?: boolean;
}

/**
 * Query options for action tasks
 */
export interface ActionTaskQueryOptions extends ActionTaskFilters {
  /** Maximum results to return */
  limit?: number;
  /** Number of results to skip */
  offset?: number;
  /** Field to order by */
  orderBy?: 'createdAt' | 'status' | 'priorityOrder';
  /** Order direction */
  orderDirection?: 'asc' | 'desc';
  /** Include expanded PII location */
  includePiiLocation?: boolean;
  /** Include expanded GDPR request */
  includeDsrRequest?: boolean;
}

// =====================================================
// SUMMARY TYPES
// =====================================================

/**
 * Summary of task statuses for a GDPR request
 */
export interface ActionTaskSummary {
  /** GDPR request ID */
  dsrRequestId: string;
  /** Total number of tasks */
  total: number;
  /** Breakdown by status */
  byStatus: Record<ActionTaskStatus, number>;
  /** Whether all tasks are completed (or skipped) */
  allCompleted: boolean;
  /** Whether any tasks have failed */
  hasFailures: boolean;
  /** Number of tasks requiring manual action */
  pendingManualActions: number;
  /** Number of tasks awaiting callback */
  awaitingCallbacks: number;
  /** Estimated time to complete manual tasks (minutes) */
  estimatedCompletionMinutes?: number;
}

/**
 * Progress information for a GDPR request's action tasks
 */
export interface ActionTaskProgress {
  /** GDPR request ID */
  dsrRequestId: string;
  /** Completion percentage (0-100) */
  completionPercentage: number;
  /** Number of completed tasks */
  completedCount: number;
  /** Total number of tasks */
  totalCount: number;
  /** Current phase description */
  currentPhase: string;
  /** Tasks currently in progress */
  inProgressTasks: ActionTask[];
  /** Tasks requiring attention */
  actionRequired: ActionTask[];
}
