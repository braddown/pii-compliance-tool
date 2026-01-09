import type { SupabaseClient } from '@supabase/supabase-js';
import {
  BaseRepository,
  BaseRepositoryConfig,
  DatabaseError,
} from './base-repository';
import type {
  AuditLog,
  CreateAuditLogInput,
  AuditLogQueryOptions,
} from '../types/audit-log';

/**
 * Database row type for audit logs
 */
interface AuditLogRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  actor_type: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Repository for audit log operations
 * Note: Audit logs are immutable - only create and query operations are supported
 */
export class AuditLogRepository extends BaseRepository {
  constructor(
    supabase: SupabaseClient,
    tenantId: string,
    config: BaseRepositoryConfig = {}
  ) {
    super(supabase, tenantId, config);
  }

  /**
   * Create a new audit log entry
   */
  async create(input: CreateAuditLogInput): Promise<AuditLog> {
    await this.setTenantContext();

    const row = {
      tenant_id: this.tenantId,
      user_id: input.userId ?? null,
      actor_type: input.actorType,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId ?? null,
      old_values: input.oldValues ?? null,
      new_values: input.newValues ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    };

    const { data, error } = await this.supabase
      .from(this.tableName('audit_logs'))
      .insert(row)
      .select()
      .single();

    if (error) {
      this.handleError(error, 'create audit log');
    }

    return this.mapToAuditLog(data);
  }

  /**
   * Query audit logs with filtering and pagination
   */
  async query(options: AuditLogQueryOptions = {}): Promise<{
    data: AuditLog[];
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

    // Build query
    let query = this.supabase
      .from(this.tableName('audit_logs'))
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters.actorType) {
      query = query.eq('actor_type', filters.actorType);
    }

    if (filters.action) {
      if (Array.isArray(filters.action)) {
        query = query.in('action', filters.action);
      } else {
        query = query.eq('action', filters.action);
      }
    }

    if (filters.resourceType) {
      query = query.eq('resource_type', filters.resourceType);
    }

    if (filters.resourceId) {
      query = query.eq('resource_id', filters.resourceId);
    }

    if (filters.gdprRelevant !== undefined) {
      query = query.eq('metadata->gdprRelevant', filters.gdprRelevant);
    }

    if (filters.riskLevel) {
      query = query.eq('metadata->riskLevel', filters.riskLevel);
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    if (filters.search) {
      query = query.or(
        `action.ilike.%${filters.search}%,resource_type.ilike.%${filters.search}%`
      );
    }

    // Apply ordering
    const orderColumn = orderBy === 'createdAt' ? 'created_at' : orderBy;
    query = query.order(orderColumn, { ascending: orderDirection === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.handleError(error, 'query audit logs');
    }

    return {
      data: (data || []).map((row) => this.mapToAuditLog(row)),
      total: count ?? 0,
    };
  }

  /**
   * Get a single audit log by ID
   */
  async findById(id: string): Promise<AuditLog | null> {
    await this.setTenantContext();

    const { data, error } = await this.supabase
      .from(this.tableName('audit_logs'))
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.handleError(error, 'find audit log');
    }

    return data ? this.mapToAuditLog(data) : null;
  }

  /**
   * Get recent audit logs (convenience method)
   */
  async getRecent(limit: number = 10): Promise<AuditLog[]> {
    const { data } = await this.query({ limit, orderDirection: 'desc' });
    return data;
  }

  /**
   * Get GDPR-relevant audit logs
   */
  async getGDPRRelevant(options: Omit<AuditLogQueryOptions, 'gdprRelevant'> = {}): Promise<{
    data: AuditLog[];
    total: number;
  }> {
    return this.query({ ...options, gdprRelevant: true });
  }

  /**
   * Get audit logs for a specific resource
   */
  async getForResource(
    resourceType: string,
    resourceId: string,
    options: Omit<AuditLogQueryOptions, 'resourceType' | 'resourceId'> = {}
  ): Promise<AuditLog[]> {
    const { data } = await this.query({
      ...options,
      resourceType,
      resourceId,
    });
    return data;
  }

  /**
   * Count audit logs matching filters
   */
  async count(filters: Omit<AuditLogQueryOptions, 'limit' | 'offset' | 'orderBy' | 'orderDirection'> = {}): Promise<number> {
    const { total } = await this.query({ ...filters, limit: 0 });
    return total;
  }

  /**
   * Export audit logs to JSON
   */
  async export(options: AuditLogQueryOptions = {}): Promise<AuditLog[]> {
    // Remove pagination limits for export
    const { data } = await this.query({
      ...options,
      limit: 10000, // Max export limit
      offset: 0,
    });
    return data;
  }

  /**
   * Map database row to AuditLog type
   */
  private mapToAuditLog(row: AuditLogRow): AuditLog {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      actorType: row.actor_type as AuditLog['actorType'],
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      oldValues: row.old_values,
      newValues: row.new_values,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      metadata: row.metadata as AuditLog['metadata'],
      createdAt: new Date(row.created_at),
    };
  }
}
