import type { SupabaseClient } from '@supabase/supabase-js';
import {
  BaseRepository,
  BaseRepositoryConfig,
  NotFoundError,
} from './base-repository';
import type {
  PIILocation,
  PIISystemType,
  PIIExecutionType,
  CreatePIILocationInput,
  UpdatePIILocationInput,
  PIILocationQueryOptions,
  PIILocationSummary,
} from '../types/pii-location';
import type { GDPRRequestType } from '../types/data-subject-request';
import type { AutomatedActionConfig, ManualActionConfig } from '../types/action-config';

/**
 * Database row type for PII locations
 */
interface PIILocationRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  system_type: string;
  execution_type: string;
  supported_request_types: string[];
  priority_order: number;
  action_config: Record<string, unknown>;
  owner_email: string | null;
  owner_team: string | null;
  pii_fields: string[];
  data_categories: string[];
  consent_fields: string[];
  consent_query_config: Record<string, unknown> | null;
  is_active: boolean;
  last_verified_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Repository for PII Data Location operations
 */
export class PIILocationRepository extends BaseRepository {
  constructor(
    supabase: SupabaseClient,
    tenantId: string,
    config: BaseRepositoryConfig = {}
  ) {
    super(supabase, tenantId, config);
  }

  /**
   * Create a new PII location
   */
  async create(input: CreatePIILocationInput): Promise<PIILocation> {
    await this.setTenantContext();

    const row = {
      tenant_id: this.tenantId,
      name: input.name,
      description: input.description ?? null,
      system_type: input.systemType,
      execution_type: input.executionType,
      supported_request_types: input.supportedRequestTypes ?? ['erasure', 'access', 'portability'],
      priority_order: input.priorityOrder ?? 100,
      action_config: input.actionConfig,
      owner_email: input.ownerEmail ?? null,
      owner_team: input.ownerTeam ?? null,
      pii_fields: input.piiFields ?? [],
      data_categories: input.dataCategories ?? [],
      consent_fields: input.consentFields ?? [],
      consent_query_config: input.consentQueryConfig ?? null,
      is_active: true,
      last_verified_at: null,
      metadata: input.metadata ?? {},
    };

    const { data, error } = await this.supabase
      .from(this.tableName('pii_locations'))
      .insert(row)
      .select()
      .single();

    if (error) {
      this.handleError(error, 'create PII location');
    }

    return this.mapToPIILocation(data);
  }

  /**
   * Update a PII location
   */
  async update(id: string, input: UpdatePIILocationInput): Promise<PIILocation> {
    await this.setTenantContext();

    const updates: Record<string, unknown> = {};

    if (input.name !== undefined) {
      updates.name = input.name;
    }

    if (input.description !== undefined) {
      updates.description = input.description;
    }

    if (input.executionType !== undefined) {
      updates.execution_type = input.executionType;
    }

    if (input.supportedRequestTypes !== undefined) {
      updates.supported_request_types = input.supportedRequestTypes;
    }

    if (input.priorityOrder !== undefined) {
      updates.priority_order = input.priorityOrder;
    }

    if (input.actionConfig !== undefined) {
      updates.action_config = input.actionConfig;
    }

    if (input.ownerEmail !== undefined) {
      updates.owner_email = input.ownerEmail;
    }

    if (input.ownerTeam !== undefined) {
      updates.owner_team = input.ownerTeam;
    }

    if (input.piiFields !== undefined) {
      updates.pii_fields = input.piiFields;
    }

    if (input.dataCategories !== undefined) {
      updates.data_categories = input.dataCategories;
    }

    if (input.consentFields !== undefined) {
      updates.consent_fields = input.consentFields;
    }

    if (input.consentQueryConfig !== undefined) {
      updates.consent_query_config = input.consentQueryConfig;
    }

    if (input.isActive !== undefined) {
      updates.is_active = input.isActive;
    }

    if (input.lastVerifiedAt !== undefined) {
      updates.last_verified_at = input.lastVerifiedAt?.toISOString() ?? null;
    }

    if (input.metadata !== undefined) {
      // Merge metadata rather than replace
      const existing = await this.findById(id);
      if (existing) {
        updates.metadata = { ...existing.metadata, ...input.metadata };
      }
    }

    const { data, error } = await this.supabase
      .from(this.tableName('pii_locations'))
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('PII Location', id);
      }
      this.handleError(error, 'update PII location');
    }

    return this.mapToPIILocation(data);
  }

  /**
   * Find a PII location by ID
   */
  async findById(id: string): Promise<PIILocation | null> {
    await this.setTenantContext();

    const { data, error } = await this.supabase
      .from(this.tableName('pii_locations'))
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.handleError(error, 'find PII location');
    }

    return data ? this.mapToPIILocation(data) : null;
  }

  /**
   * Query PII locations with filtering and pagination
   */
  async query(options: PIILocationQueryOptions = {}): Promise<{
    data: PIILocation[];
    total: number;
  }> {
    await this.setTenantContext();

    const {
      limit = 50,
      offset = 0,
      orderBy = 'priorityOrder',
      orderDirection = 'asc',
      ...filters
    } = options;

    let query = this.supabase
      .from(this.tableName('pii_locations'))
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters.systemType) {
      if (Array.isArray(filters.systemType)) {
        query = query.in('system_type', filters.systemType);
      } else {
        query = query.eq('system_type', filters.systemType);
      }
    }

    if (filters.executionType) {
      if (Array.isArray(filters.executionType)) {
        query = query.in('execution_type', filters.executionType);
      } else {
        query = query.eq('execution_type', filters.executionType);
      }
    }

    if (filters.supportedRequestType) {
      query = query.contains('supported_request_types', [filters.supportedRequestType]);
    }

    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    if (filters.ownerTeam) {
      query = query.eq('owner_team', filters.ownerTeam);
    }

    if (filters.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      );
    }

    // Apply ordering
    const orderColumnMap: Record<string, string> = {
      name: 'name',
      priorityOrder: 'priority_order',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };
    const orderColumn = orderColumnMap[orderBy] ?? 'priority_order';
    query = query.order(orderColumn, { ascending: orderDirection === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.handleError(error, 'query PII locations');
    }

    return {
      data: (data || []).map((row) => this.mapToPIILocation(row)),
      total: count ?? 0,
    };
  }

  /**
   * Delete a PII location (soft delete by setting is_active = false)
   */
  async delete(id: string): Promise<boolean> {
    await this.setTenantContext();

    const { error } = await this.supabase
      .from(this.tableName('pii_locations'))
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('PII Location', id);
      }
      this.handleError(error, 'delete PII location');
    }

    return true;
  }

  /**
   * Hard delete a PII location (use with caution)
   */
  async hardDelete(id: string): Promise<boolean> {
    await this.setTenantContext();

    const { error } = await this.supabase
      .from(this.tableName('pii_locations'))
      .delete()
      .eq('id', id);

    if (error) {
      this.handleError(error, 'hard delete PII location');
    }

    return true;
  }

  /**
   * Get all active PII locations
   */
  async getActive(): Promise<PIILocation[]> {
    const { data } = await this.query({
      isActive: true,
      orderBy: 'priorityOrder',
      orderDirection: 'asc',
      limit: 1000,
    });
    return data;
  }

  /**
   * Get PII locations that support a specific request type
   */
  async getForRequestType(requestType: GDPRRequestType): Promise<PIILocation[]> {
    const { data } = await this.query({
      supportedRequestType: requestType,
      isActive: true,
      orderBy: 'priorityOrder',
      orderDirection: 'asc',
      limit: 1000,
    });
    return data;
  }

  /**
   * Get PII locations by system type
   */
  async getBySystemType(systemType: PIISystemType): Promise<PIILocation[]> {
    const { data } = await this.query({
      systemType,
      isActive: true,
      limit: 1000,
    });
    return data;
  }

  /**
   * Get PII locations by execution type
   */
  async getByExecutionType(executionType: PIIExecutionType): Promise<PIILocation[]> {
    const { data } = await this.query({
      executionType,
      isActive: true,
      limit: 1000,
    });
    return data;
  }

  /**
   * Get PII locations by owner team
   */
  async getByOwnerTeam(team: string): Promise<PIILocation[]> {
    const { data } = await this.query({
      ownerTeam: team,
      isActive: true,
      limit: 1000,
    });
    return data;
  }

  /**
   * Mark a location as verified (configuration tested)
   */
  async markVerified(id: string): Promise<PIILocation> {
    return this.update(id, {
      lastVerifiedAt: new Date(),
    });
  }

  /**
   * Get summary statistics for PII locations
   */
  async getSummary(): Promise<PIILocationSummary> {
    await this.setTenantContext();

    const { data, error } = await this.supabase
      .from(this.tableName('pii_locations'))
      .select('is_active, system_type, execution_type, last_verified_at');

    if (error) {
      this.handleError(error, 'get PII location summary');
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let total = 0;
    let active = 0;
    let needsVerification = 0;

    const bySystemType: Record<PIISystemType, number> = {
      database: 0,
      api: 0,
      manual: 0,
      file_storage: 0,
      third_party: 0,
    };

    const byExecutionType: Record<PIIExecutionType, number> = {
      automated: 0,
      semi_automated: 0,
      manual: 0,
    };

    for (const row of data || []) {
      total++;
      if (row.is_active) {
        active++;
        bySystemType[row.system_type as PIISystemType]++;
        byExecutionType[row.execution_type as PIIExecutionType]++;

        // Check if verification is needed (not verified in 30 days)
        if (!row.last_verified_at || new Date(row.last_verified_at) < thirtyDaysAgo) {
          needsVerification++;
        }
      }
    }

    return {
      total,
      active,
      bySystemType,
      byExecutionType,
      needsVerification,
    };
  }

  /**
   * Map database row to PIILocation type
   */
  private mapToPIILocation(row: PIILocationRow): PIILocation {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      systemType: row.system_type as PIISystemType,
      executionType: row.execution_type as PIIExecutionType,
      supportedRequestTypes: row.supported_request_types as GDPRRequestType[],
      priorityOrder: row.priority_order,
      actionConfig: row.action_config as unknown as AutomatedActionConfig | ManualActionConfig,
      ownerEmail: row.owner_email,
      ownerTeam: row.owner_team,
      piiFields: row.pii_fields,
      dataCategories: row.data_categories,
      consentFields: row.consent_fields ?? [],
      consentQueryConfig: row.consent_query_config as PIILocation['consentQueryConfig'],
      isActive: row.is_active,
      lastVerifiedAt: row.last_verified_at ? new Date(row.last_verified_at) : null,
      metadata: row.metadata,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
