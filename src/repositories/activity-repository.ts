import type { SupabaseClient } from '@supabase/supabase-js';
import {
  BaseRepository,
  BaseRepositoryConfig,
} from './base-repository';
import type {
  RequestActivity,
  CreateActivityInput,
  ActivityQueryOptions,
  ActivitySummary,
} from '../types/audit-log';

/**
 * Database row type for request activities
 */
interface ActivityRow {
  id: string;
  tenant_id: string;
  dsr_request_id: string;
  action_task_id: string | null;
  pii_location_name: string | null;
  activity_type: string;
  description: string;
  actor_type: string;
  actor_id: string | null;
  actor_name: string | null;
  previous_status: string | null;
  new_status: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Repository for request activity logging
 * Activities are immutable - only create and query operations
 */
export class ActivityRepository extends BaseRepository {
  constructor(
    supabase: SupabaseClient,
    tenantId: string,
    config: BaseRepositoryConfig = {}
  ) {
    super(supabase, tenantId, config);
  }

  /**
   * Log an activity
   */
  async log(input: CreateActivityInput): Promise<RequestActivity> {
    await this.setTenantContext();

    const row = {
      tenant_id: this.tenantId,
      dsr_request_id: input.dsrRequestId,
      action_task_id: input.actionTaskId ?? null,
      pii_location_name: input.piiLocationName ?? null,
      activity_type: input.activityType,
      description: input.description,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      actor_name: input.actorName ?? null,
      previous_status: input.previousStatus ?? null,
      new_status: input.newStatus ?? null,
      details: input.details ?? null,
    };

    const { data, error } = await this.supabase
      .from(this.tableName('request_activities'))
      .insert(row)
      .select()
      .single();

    if (error) {
      // Don't throw on activity logging failures - just log and continue
      console.error('[ActivityRepository] Failed to log activity:', error);
      // Return a mock activity so callers don't break
      return {
        id: 'failed',
        tenantId: this.tenantId,
        dsrRequestId: input.dsrRequestId,
        actionTaskId: input.actionTaskId ?? null,
        piiLocationName: input.piiLocationName ?? null,
        activityType: input.activityType,
        description: input.description,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        previousStatus: input.previousStatus ?? null,
        newStatus: input.newStatus ?? null,
        details: input.details ?? null,
        createdAt: new Date(),
      };
    }

    return this.mapToActivity(data);
  }

  /**
   * Query activities with filtering and pagination
   */
  async query(options: ActivityQueryOptions = {}): Promise<{
    data: RequestActivity[];
    total: number;
  }> {
    await this.setTenantContext();

    const {
      limit = 50,
      offset = 0,
      orderDirection = 'desc',
      ...filters
    } = options;

    let query = this.supabase
      .from(this.tableName('request_activities'))
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters.dsrRequestId) {
      query = query.eq('dsr_request_id', filters.dsrRequestId);
    }

    if (filters.actionTaskId) {
      query = query.eq('action_task_id', filters.actionTaskId);
    }

    if (filters.activityType) {
      if (Array.isArray(filters.activityType)) {
        query = query.in('activity_type', filters.activityType);
      } else {
        query = query.eq('activity_type', filters.activityType);
      }
    }

    if (filters.actorType) {
      query = query.eq('actor_type', filters.actorType);
    }

    if (filters.actorId) {
      query = query.eq('actor_id', filters.actorId);
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    // Apply ordering
    query = query.order('created_at', { ascending: orderDirection === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.handleError(error, 'query activities');
    }

    return {
      data: (data || []).map((row) => this.mapToActivity(row)),
      total: count ?? 0,
    };
  }

  /**
   * Get all activities for a DSR
   */
  async getForRequest(dsrRequestId: string): Promise<RequestActivity[]> {
    const { data } = await this.query({
      dsrRequestId,
      orderDirection: 'asc', // Chronological order
      limit: 1000,
    });
    return data;
  }

  /**
   * Get recent activities across all requests
   */
  async getRecent(limit: number = 20): Promise<RequestActivity[]> {
    const { data } = await this.query({ limit, orderDirection: 'desc' });
    return data;
  }

  /**
   * Get activity summary for a DSR
   */
  async getSummary(dsrRequestId: string): Promise<ActivitySummary> {
    const { data, total } = await this.query({
      dsrRequestId,
      limit: 1,
      orderDirection: 'desc',
    });

    // Count task completions and failures
    const { data: taskActivities } = await this.query({
      dsrRequestId,
      activityType: ['task_completed', 'task_failed'],
      limit: 1000,
    });

    const taskCompletions = taskActivities.filter(
      (a) => a.activityType === 'task_completed'
    ).length;
    const taskFailures = taskActivities.filter(
      (a) => a.activityType === 'task_failed'
    ).length;

    return {
      totalActivities: total,
      lastActivity: data[0] ?? null,
      taskCompletions,
      taskFailures,
    };
  }

  /**
   * Map database row to RequestActivity
   */
  private mapToActivity(row: ActivityRow): RequestActivity {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      dsrRequestId: row.dsr_request_id,
      actionTaskId: row.action_task_id,
      piiLocationName: row.pii_location_name,
      activityType: row.activity_type as RequestActivity['activityType'],
      description: row.description,
      actorType: row.actor_type as RequestActivity['actorType'],
      actorId: row.actor_id,
      actorName: row.actor_name,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      details: row.details,
      createdAt: new Date(row.created_at),
    };
  }
}
