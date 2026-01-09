import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays } from 'date-fns';
import {
  BaseRepository,
  BaseRepositoryConfig,
  NotFoundError,
} from './base-repository';
import type {
  DataSubjectRequest,
  CreateDSRInput,
  UpdateDSRInput,
  DSRQueryOptions,
  DSRMetrics,
} from '../types/data-subject-request';

/**
 * Database row type for data subject requests
 */
interface DSRRow {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  request_type: string;
  status: string;
  priority: string;
  requester_email: string;
  requester_phone: string | null;
  verification_method: string | null;
  verified_at: string | null;
  assigned_to: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  requested_at: string;
  due_date: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Repository for Data Subject Request (DSR) operations
 */
export class DataSubjectRequestRepository extends BaseRepository {
  private readonly responseDays = 30; // Standard response deadline

  constructor(
    supabase: SupabaseClient,
    tenantId: string,
    config: BaseRepositoryConfig = {}
  ) {
    super(supabase, tenantId, config);
  }

  /**
   * Create a new data subject request
   */
  async create(input: CreateDSRInput): Promise<DataSubjectRequest> {
    await this.setTenantContext();

    const now = new Date();
    const dueDate = addDays(now, this.responseDays);

    const row = {
      tenant_id: this.tenantId,
      customer_id: input.customerId ?? null,
      request_type: input.requestType,
      status: 'pending',
      priority: input.priority ?? 'medium',
      requester_email: input.requesterEmail,
      requester_phone: input.requesterPhone ?? null,
      verification_method: null,
      verified_at: null,
      assigned_to: null,
      notes: input.notes ?? null,
      metadata: input.metadata ?? {},
      requested_at: now.toISOString(),
      due_date: dueDate.toISOString(),
      completed_at: null,
    };

    const { data, error } = await this.supabase
      .from(this.tableName('data_subject_requests'))
      .insert(row)
      .select()
      .single();

    if (error) {
      this.handleError(error, 'create data subject request');
    }

    return this.mapToDataSubjectRequest(data);
  }

  /**
   * Update a data subject request
   */
  async update(id: string, input: UpdateDSRInput): Promise<DataSubjectRequest> {
    await this.setTenantContext();

    const updates: Record<string, unknown> = {};

    if (input.status !== undefined) {
      updates.status = input.status;
      if (input.status === 'completed' || input.status === 'rejected') {
        updates.completed_at = new Date().toISOString();
      }
    }

    if (input.priority !== undefined) {
      updates.priority = input.priority;
    }

    if (input.assignedTo !== undefined) {
      updates.assigned_to = input.assignedTo;
    }

    if (input.verificationMethod !== undefined) {
      updates.verification_method = input.verificationMethod;
    }

    if (input.verifiedAt !== undefined) {
      updates.verified_at = input.verifiedAt?.toISOString() ?? null;
    }

    if (input.notes !== undefined) {
      updates.notes = input.notes;
    }

    if (input.metadata !== undefined) {
      // Merge metadata rather than replace
      const existing = await this.findById(id);
      if (existing) {
        updates.metadata = { ...existing.metadata, ...input.metadata };
      }
    }

    const { data, error } = await this.supabase
      .from(this.tableName('data_subject_requests'))
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Data Subject Request', id);
      }
      this.handleError(error, 'update data subject request');
    }

    return this.mapToDataSubjectRequest(data);
  }

  /**
   * Find a data subject request by ID
   */
  async findById(id: string): Promise<DataSubjectRequest | null> {
    await this.setTenantContext();

    const { data, error } = await this.supabase
      .from(this.tableName('data_subject_requests'))
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.handleError(error, 'find data subject request');
    }

    return data ? this.mapToDataSubjectRequest(data) : null;
  }

  /**
   * Query data subject requests with filtering and pagination
   */
  async query(options: DSRQueryOptions = {}): Promise<{
    data: DataSubjectRequest[];
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
      .from(this.tableName('data_subject_requests'))
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters.requestType) {
      if (Array.isArray(filters.requestType)) {
        query = query.in('request_type', filters.requestType);
      } else {
        query = query.eq('request_type', filters.requestType);
      }
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }

    if (filters.priority) {
      if (Array.isArray(filters.priority)) {
        query = query.in('priority', filters.priority);
      } else {
        query = query.eq('priority', filters.priority);
      }
    }

    if (filters.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo);
    }

    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }

    if (filters.overdue) {
      query = query
        .lt('due_date', new Date().toISOString())
        .in('status', ['pending', 'in_progress', 'review']);
    }

    if (filters.dueSoon) {
      const sevenDaysFromNow = addDays(new Date(), 7);
      query = query
        .lte('due_date', sevenDaysFromNow.toISOString())
        .gte('due_date', new Date().toISOString())
        .in('status', ['pending', 'in_progress', 'review']);
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    if (filters.search) {
      query = query.or(
        `requester_email.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`
      );
    }

    // Apply ordering
    const orderColumnMap: Record<string, string> = {
      createdAt: 'created_at',
      dueDate: 'due_date',
      priority: 'priority',
      status: 'status',
    };
    const orderColumn = orderColumnMap[orderBy] ?? 'created_at';
    query = query.order(orderColumn, { ascending: orderDirection === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.handleError(error, 'query data subject requests');
    }

    return {
      data: (data || []).map((row) => this.mapToDataSubjectRequest(row)),
      total: count ?? 0,
    };
  }

  /**
   * Get pending requests assigned to a user
   */
  async getAssignedTo(userId: string): Promise<DataSubjectRequest[]> {
    const { data } = await this.query({
      assignedTo: userId,
      status: ['pending', 'in_progress', 'review'],
    });
    return data;
  }

  /**
   * Get overdue requests
   */
  async getOverdue(): Promise<DataSubjectRequest[]> {
    const { data } = await this.query({ overdue: true });
    return data;
  }

  /**
   * Get requests due soon (within 7 days)
   */
  async getDueSoon(): Promise<DataSubjectRequest[]> {
    const { data } = await this.query({ dueSoon: true });
    return data;
  }

  /**
   * Add a processing note to a request
   */
  async addNote(id: string, note: string, author: string): Promise<DataSubjectRequest> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('Data Subject Request', id);
    }

    const processingNotes = existing.metadata.processingNotes || [];
    processingNotes.push({
      timestamp: new Date(),
      note,
      author,
    });

    return this.update(id, {
      metadata: { processingNotes },
    });
  }

  /**
   * Get data subject request metrics
   */
  async getMetrics(): Promise<DSRMetrics> {
    await this.setTenantContext();

    const { data, error } = await this.supabase
      .from(this.tableName('data_subject_requests'))
      .select('status, request_type, due_date, requested_at, completed_at');

    if (error) {
      this.handleError(error, 'get DSR metrics');
    }

    const now = new Date();
    const sevenDaysFromNow = addDays(now, 7);

    let total = 0;
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let overdue = 0;
    let dueSoon = 0;
    let totalResponseDays = 0;
    let completedCount = 0;

    const byType: Record<string, number> = {
      access: 0,
      rectification: 0,
      erasure: 0,
      restriction: 0,
      portability: 0,
      objection: 0,
      consent: 0,
    };

    for (const row of data || []) {
      total++;
      byType[row.request_type] = (byType[row.request_type] || 0) + 1;

      const dueDate = new Date(row.due_date);
      const isOpen = ['pending', 'in_progress', 'review'].includes(row.status);

      switch (row.status) {
        case 'pending':
          pending++;
          break;
        case 'in_progress':
        case 'review':
          inProgress++;
          break;
        case 'completed':
          completed++;
          completedCount++;
          if (row.completed_at && row.requested_at) {
            const days = Math.ceil(
              (new Date(row.completed_at).getTime() - new Date(row.requested_at).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            totalResponseDays += days;
          }
          break;
      }

      if (isOpen) {
        if (dueDate < now) {
          overdue++;
        } else if (dueDate <= sevenDaysFromNow) {
          dueSoon++;
        }
      }
    }

    const avgResponseDays =
      completedCount > 0 ? Math.round((totalResponseDays / completedCount) * 10) / 10 : 0;

    // Compliance rate: completed on time / total completed
    const onTimeCompleted = (data || []).filter((row) => {
      if (row.status !== 'completed' || !row.completed_at) return false;
      return new Date(row.completed_at) <= new Date(row.due_date);
    }).length;

    const complianceRate =
      completed > 0 ? Math.round((onTimeCompleted / completed) * 100 * 10) / 10 : 100;

    return {
      total,
      pending,
      inProgress,
      completed,
      overdue,
      dueSoon,
      avgResponseDays,
      complianceRate,
      byType: byType as DSRMetrics['byType'],
    };
  }

  /**
   * Map database row to DataSubjectRequest type
   */
  private mapToDataSubjectRequest(row: DSRRow): DataSubjectRequest {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      customerId: row.customer_id,
      requestType: row.request_type as DataSubjectRequest['requestType'],
      status: row.status as DataSubjectRequest['status'],
      priority: row.priority as DataSubjectRequest['priority'],
      requesterEmail: row.requester_email,
      requesterPhone: row.requester_phone,
      verificationMethod: row.verification_method as DataSubjectRequest['verificationMethod'],
      verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
      assignedTo: row.assigned_to,
      notes: row.notes,
      metadata: row.metadata as DataSubjectRequest['metadata'],
      requestedAt: new Date(row.requested_at),
      dueDate: new Date(row.due_date),
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
