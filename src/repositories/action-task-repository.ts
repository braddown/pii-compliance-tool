import type { SupabaseClient } from '@supabase/supabase-js';
import {
  BaseRepository,
  BaseRepositoryConfig,
  NotFoundError,
} from './base-repository';
import type {
  ActionTask,
  ActionTaskStatus,
  ActionTaskResult,
  CreateActionTaskInput,
  UpdateActionTaskInput,
  ActionTaskQueryOptions,
  ActionTaskSummary,
  CompleteActionTaskInput,
  FailActionTaskInput,
} from '../types/action-task';
import type { GDPRRequestType } from '../types/data-subject-request';

/**
 * Database row type for action tasks
 */
interface ActionTaskRow {
  id: string;
  tenant_id: string;
  dsr_request_id: string;
  pii_location_id: string;
  task_type: string;
  status: string;
  assigned_to: string | null;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  attempt_count: number;
  max_attempts: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  execution_result: Record<string, unknown>;
  notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  correlation_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Repository for Action Task operations
 */
export class ActionTaskRepository extends BaseRepository {
  constructor(
    supabase: SupabaseClient,
    tenantId: string,
    config: BaseRepositoryConfig = {}
  ) {
    super(supabase, tenantId, config);
  }

  /**
   * Create a new action task
   */
  async create(input: CreateActionTaskInput): Promise<ActionTask> {
    await this.setTenantContext();

    const row = {
      tenant_id: this.tenantId,
      dsr_request_id: input.dsrRequestId,
      pii_location_id: input.piiLocationId,
      task_type: input.taskType,
      status: input.status ?? 'pending',
      assigned_to: input.assignedTo ?? null,
      assigned_at: input.assignedTo ? new Date().toISOString() : null,
      notes: input.notes ?? null,
    };

    const { data, error } = await this.supabase
      .from(this.tableName('action_tasks'))
      .insert(row)
      .select()
      .single();

    if (error) {
      this.handleError(error, 'create action task');
    }

    return this.mapToActionTask(data);
  }

  /**
   * Update an action task
   */
  async update(id: string, input: UpdateActionTaskInput): Promise<ActionTask> {
    await this.setTenantContext();

    const updates: Record<string, unknown> = {};

    if (input.status !== undefined) {
      updates.status = input.status;

      // Set timestamps based on status changes
      if (input.status === 'in_progress' && !updates.started_at) {
        updates.started_at = new Date().toISOString();
      }

      if (['completed', 'failed', 'skipped', 'blocked'].includes(input.status)) {
        updates.completed_at = new Date().toISOString();
      }
    }

    if (input.assignedTo !== undefined) {
      updates.assigned_to = input.assignedTo;
      if (input.assignedTo) {
        updates.assigned_at = new Date().toISOString();
      }
    }

    if (input.executionResult !== undefined) {
      // Merge execution result
      const existing = await this.findById(id);
      if (existing) {
        updates.execution_result = { ...existing.executionResult, ...input.executionResult };
      }
    }

    if (input.notes !== undefined) {
      updates.notes = input.notes;
    }

    if (input.verifiedBy !== undefined) {
      updates.verified_by = input.verifiedBy;
      updates.verified_at = new Date().toISOString();
    }

    if (input.verificationNotes !== undefined) {
      updates.verification_notes = input.verificationNotes;
    }

    if (input.nextRetryAt !== undefined) {
      updates.next_retry_at = input.nextRetryAt?.toISOString() ?? null;
    }

    const { data, error } = await this.supabase
      .from(this.tableName('action_tasks'))
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Action Task', id);
      }
      this.handleError(error, 'update action task');
    }

    return this.mapToActionTask(data);
  }

  /**
   * Find an action task by ID
   */
  async findById(id: string): Promise<ActionTask | null> {
    await this.setTenantContext();

    const { data, error } = await this.supabase
      .from(this.tableName('action_tasks'))
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.handleError(error, 'find action task');
    }

    return data ? this.mapToActionTask(data) : null;
  }

  /**
   * Query action tasks with filtering and pagination
   */
  async query(options: ActionTaskQueryOptions = {}): Promise<{
    data: ActionTask[];
    total: number;
  }> {
    await this.setTenantContext();

    const {
      limit = 50,
      offset = 0,
      orderBy = 'createdAt',
      orderDirection = 'desc',
      ...filters
    } = options;

    let query = this.supabase
      .from(this.tableName('action_tasks'))
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters.dsrRequestId) {
      query = query.eq('dsr_request_id', filters.dsrRequestId);
    }

    if (filters.piiLocationId) {
      query = query.eq('pii_location_id', filters.piiLocationId);
    }

    if (filters.taskType) {
      if (Array.isArray(filters.taskType)) {
        query = query.in('task_type', filters.taskType);
      } else {
        query = query.eq('task_type', filters.taskType);
      }
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }

    if (filters.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo);
    }

    if (filters.hasErrors) {
      query = query.in('status', ['failed', 'blocked']);
    }

    if (filters.needsRetry) {
      query = query
        .eq('status', 'failed')
        .lt('attempt_count', 3) // max_attempts default
        .not('next_retry_at', 'is', null)
        .lte('next_retry_at', new Date().toISOString());
    }

    if (filters.awaitingCallback) {
      query = query.eq('status', 'awaiting_callback');
    }

    // Apply ordering
    const orderColumnMap: Record<string, string> = {
      createdAt: 'created_at',
      status: 'status',
      priorityOrder: 'created_at', // Fall back to created_at
    };
    const orderColumn = orderColumnMap[orderBy] ?? 'created_at';
    query = query.order(orderColumn, { ascending: orderDirection === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.handleError(error, 'query action tasks');
    }

    return {
      data: (data || []).map((row) => this.mapToActionTask(row)),
      total: count ?? 0,
    };
  }

  /**
   * Create action tasks for all applicable PII locations for a GDPR request
   */
  async createTasksForRequest(
    dsrRequestId: string,
    requestType: GDPRRequestType
  ): Promise<ActionTask[]> {
    await this.setTenantContext();

    // Get all active PII locations that support this request type
    const { data: locations, error: locError } = await this.supabase
      .from(this.tableName('pii_locations'))
      .select('id, execution_type')
      .eq('is_active', true)
      .contains('supported_request_types', [requestType])
      .order('priority_order', { ascending: true });

    if (locError) {
      this.handleError(locError, 'get PII locations for request');
    }

    if (!locations || locations.length === 0) {
      return [];
    }

    // Create action tasks for each location
    const tasks = locations.map((location) => ({
      tenant_id: this.tenantId,
      dsr_request_id: dsrRequestId,
      pii_location_id: location.id,
      task_type: requestType,
      status: location.execution_type === 'manual' ? 'manual_action' : 'pending',
    }));

    const { data: createdTasks, error } = await this.supabase
      .from(this.tableName('action_tasks'))
      .insert(tasks)
      .select();

    if (error) {
      this.handleError(error, 'create action tasks for request');
    }

    return (createdTasks || []).map((row) => this.mapToActionTask(row));
  }

  /**
   * Start a task (mark as in_progress)
   */
  async startTask(id: string, assignedTo?: string): Promise<ActionTask> {
    const updates: UpdateActionTaskInput = {
      status: 'in_progress',
    };

    if (assignedTo) {
      updates.assignedTo = assignedTo;
    }

    // Increment attempt count
    await this.setTenantContext();
    await this.supabase
      .from(this.tableName('action_tasks'))
      .update({
        attempt_count: this.supabase.rpc('increment_attempt_count', { task_id: id }),
        last_attempt_at: new Date().toISOString(),
      })
      .eq('id', id);

    return this.update(id, updates);
  }

  /**
   * Complete a task successfully
   */
  async completeTask(id: string, input: CompleteActionTaskInput): Promise<ActionTask> {
    return this.update(id, {
      status: 'completed',
      executionResult: input.result,
      notes: input.notes,
    });
  }

  /**
   * Mark a task as failed
   */
  async failTask(id: string, input: FailActionTaskInput): Promise<ActionTask> {
    const task = await this.findById(id);
    if (!task) {
      throw new NotFoundError('Action Task', id);
    }

    const updates: UpdateActionTaskInput = {
      status: 'failed',
      executionResult: { errorMessage: input.errorMessage },
      notes: input.notes,
    };

    // Schedule retry if requested and attempts remaining
    if (input.scheduleRetry && task.attemptCount < task.maxAttempts) {
      // Exponential backoff: 1min, 2min, 4min, etc.
      const delayMinutes = Math.pow(2, task.attemptCount);
      const nextRetry = new Date();
      nextRetry.setMinutes(nextRetry.getMinutes() + delayMinutes);
      updates.nextRetryAt = nextRetry;
    }

    return this.update(id, updates);
  }

  /**
   * Skip a task (mark as not applicable)
   */
  async skipTask(id: string, reason: string): Promise<ActionTask> {
    return this.update(id, {
      status: 'skipped',
      notes: reason,
    });
  }

  /**
   * Block a task (cannot proceed)
   */
  async blockTask(id: string, reason: string): Promise<ActionTask> {
    return this.update(id, {
      status: 'blocked',
      notes: reason,
    });
  }

  /**
   * Retry a failed task
   */
  async retryTask(id: string): Promise<ActionTask> {
    return this.update(id, {
      status: 'pending',
      nextRetryAt: null,
    });
  }

  /**
   * Verify a completed task
   */
  async verifyTask(id: string, verifiedBy: string, notes?: string): Promise<ActionTask> {
    return this.update(id, {
      status: 'completed',
      verifiedBy,
      verificationNotes: notes,
    });
  }

  /**
   * Get summary of task statuses for a GDPR request
   */
  async getSummaryForRequest(dsrRequestId: string): Promise<ActionTaskSummary> {
    await this.setTenantContext();

    const { data, error } = await this.supabase
      .from(this.tableName('action_tasks'))
      .select('status')
      .eq('dsr_request_id', dsrRequestId);

    if (error) {
      this.handleError(error, 'get action task summary');
    }

    const byStatus: Record<ActionTaskStatus, number> = {
      pending: 0,
      in_progress: 0,
      awaiting_callback: 0,
      manual_action: 0,
      verification: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
    };

    for (const row of data || []) {
      byStatus[row.status as ActionTaskStatus]++;
    }

    const total = data?.length ?? 0;
    const completedOrSkipped = byStatus.completed + byStatus.skipped;
    const allCompleted = total > 0 && completedOrSkipped === total;
    const hasFailures = byStatus.failed > 0 || byStatus.blocked > 0;

    return {
      dsrRequestId,
      total,
      byStatus,
      allCompleted,
      hasFailures,
      pendingManualActions: byStatus.manual_action,
      awaitingCallbacks: byStatus.awaiting_callback,
    };
  }

  /**
   * Get all tasks for a GDPR request
   */
  async getTasksForRequest(dsrRequestId: string): Promise<ActionTask[]> {
    const { data } = await this.query({
      dsrRequestId,
      limit: 1000,
      orderBy: 'createdAt',
      orderDirection: 'asc',
    });
    return data;
  }

  /**
   * Get pending manual tasks (optionally for a specific user)
   */
  async getPendingManualTasks(assignedTo?: string): Promise<ActionTask[]> {
    const filters: ActionTaskQueryOptions = {
      status: 'manual_action',
      limit: 1000,
    };

    if (assignedTo) {
      filters.assignedTo = assignedTo;
    }

    const { data } = await this.query(filters);
    return data;
  }

  /**
   * Get tasks that need to be retried
   */
  async getTasksNeedingRetry(): Promise<ActionTask[]> {
    const { data } = await this.query({
      needsRetry: true,
      limit: 100,
    });
    return data;
  }

  /**
   * Get tasks awaiting webhook callbacks
   */
  async getAwaitingCallbacks(): Promise<ActionTask[]> {
    const { data } = await this.query({
      awaitingCallback: true,
      limit: 100,
    });
    return data;
  }

  /**
   * Handle webhook callback for a task
   */
  async handleWebhookCallback(
    correlationId: string,
    payload: unknown,
    success: boolean
  ): Promise<ActionTask> {
    await this.setTenantContext();

    // Find task by correlation ID
    const { data, error } = await this.supabase
      .from(this.tableName('action_tasks'))
      .select('*')
      .eq('correlation_id', correlationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Action Task with correlation ID', correlationId);
      }
      this.handleError(error, 'find task by correlation ID');
    }

    const task = this.mapToActionTask(data);

    return this.update(task.id, {
      status: success ? 'completed' : 'failed',
      executionResult: {
        webhookReceived: true,
        webhookPayload: payload,
      },
    });
  }

  /**
   * Map database row to ActionTask type
   */
  private mapToActionTask(row: ActionTaskRow): ActionTask {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      dsrRequestId: row.dsr_request_id,
      piiLocationId: row.pii_location_id,
      taskType: row.task_type as GDPRRequestType,
      status: row.status as ActionTaskStatus,
      assignedTo: row.assigned_to,
      assignedAt: row.assigned_at ? new Date(row.assigned_at) : null,
      startedAt: row.started_at ? new Date(row.started_at) : null,
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      attemptCount: row.attempt_count,
      maxAttempts: row.max_attempts,
      lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at) : null,
      nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at) : null,
      executionResult: row.execution_result as ActionTaskResult,
      notes: row.notes,
      verifiedBy: row.verified_by,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
      verificationNotes: row.verification_notes,
      correlationId: row.correlation_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
