import type { SupabaseClient } from '@supabase/supabase-js';
import {
  BaseRepository,
  BaseRepositoryConfig,
  NotFoundError,
} from './base-repository';
import type {
  ConsentRecord,
  CreateConsentInput,
  RevokeConsentInput,
  ConsentQueryOptions,
  CustomerConsentSummary,
  ConsentMetrics,
} from '../types/consent';

/**
 * Database row type for consent records
 */
interface ConsentRecordRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  consent_type: string;
  consent_granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  method: string;
  legal_basis: string | null;
  retention_days: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Repository for consent record operations
 * Note: Consent records are immutable - updates create new records
 */
export class ConsentRecordRepository extends BaseRepository {
  constructor(
    supabase: SupabaseClient,
    tenantId: string,
    config: BaseRepositoryConfig = {}
  ) {
    super(supabase, tenantId, config);
  }

  /**
   * Grant consent - creates a new consent record
   */
  async grantConsent(input: CreateConsentInput): Promise<ConsentRecord> {
    await this.setTenantContext();

    const row = {
      tenant_id: this.tenantId,
      customer_id: input.customerId,
      consent_type: input.consentType,
      consent_granted: true,
      granted_at: new Date().toISOString(),
      revoked_at: null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      method: input.method,
      legal_basis: input.legalBasis ?? null,
      retention_days: input.retentionDays ?? null,
      metadata: input.metadata ?? {},
    };

    const { data, error } = await this.supabase
      .from(this.tableName('consent_records'))
      .insert(row)
      .select()
      .single();

    if (error) {
      this.handleError(error, 'grant consent');
    }

    return this.mapToConsentRecord(data);
  }

  /**
   * Revoke consent - creates a new consent record with revoked status
   */
  async revokeConsent(input: RevokeConsentInput): Promise<ConsentRecord> {
    await this.setTenantContext();

    const row = {
      tenant_id: this.tenantId,
      customer_id: input.customerId,
      consent_type: input.consentType,
      consent_granted: false,
      granted_at: null,
      revoked_at: new Date().toISOString(),
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      method: input.method ?? 'api',
      legal_basis: null,
      retention_days: null,
      metadata: input.reason ? { reason: input.reason } : {},
    };

    const { data, error } = await this.supabase
      .from(this.tableName('consent_records'))
      .insert(row)
      .select()
      .single();

    if (error) {
      this.handleError(error, 'revoke consent');
    }

    return this.mapToConsentRecord(data);
  }

  /**
   * Query consent records with filtering and pagination
   */
  async query(options: ConsentQueryOptions = {}): Promise<{
    data: ConsentRecord[];
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
      .from(this.tableName('consent_records'))
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }

    if (filters.consentType) {
      if (Array.isArray(filters.consentType)) {
        query = query.in('consent_type', filters.consentType);
      } else {
        query = query.eq('consent_type', filters.consentType);
      }
    }

    if (filters.consentGranted !== undefined) {
      query = query.eq('consent_granted', filters.consentGranted);
    }

    if (filters.method) {
      query = query.eq('method', filters.method);
    }

    if (filters.legalBasis) {
      query = query.eq('legal_basis', filters.legalBasis);
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    // Apply ordering
    const orderColumnMap: Record<string, string> = {
      createdAt: 'created_at',
      grantedAt: 'granted_at',
      revokedAt: 'revoked_at',
    };
    const orderColumn = orderColumnMap[orderBy] ?? 'created_at';
    query = query.order(orderColumn, { ascending: orderDirection === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.handleError(error, 'query consent records');
    }

    return {
      data: (data || []).map((row) => this.mapToConsentRecord(row)),
      total: count ?? 0,
    };
  }

  /**
   * Get consent history for a customer
   */
  async getCustomerHistory(customerId: string): Promise<ConsentRecord[]> {
    const { data } = await this.query({
      customerId,
      orderDirection: 'desc',
      limit: 1000,
    });
    return data;
  }

  /**
   * Get current consent status for a customer (latest record per consent type)
   */
  async getCustomerConsentSummary(customerId: string): Promise<CustomerConsentSummary> {
    await this.setTenantContext();

    // Get all consent types for this customer, ordered by created_at desc
    const { data, error } = await this.supabase
      .from(this.tableName('consent_records'))
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      this.handleError(error, 'get customer consent summary');
    }

    // Group by consent type and take the latest
    const consents: CustomerConsentSummary['consents'] = {};
    const seenTypes = new Set<string>();
    let lastUpdated = new Date(0);

    for (const row of data || []) {
      if (!seenTypes.has(row.consent_type)) {
        seenTypes.add(row.consent_type);
        const record = this.mapToConsentRecord(row);
        consents[row.consent_type] = {
          granted: record.consentGranted,
          grantedAt: record.grantedAt,
          revokedAt: record.revokedAt,
          method: record.method,
          legalBasis: record.legalBasis,
        };
        if (record.createdAt > lastUpdated) {
          lastUpdated = record.createdAt;
        }
      }
    }

    return {
      customerId,
      consents,
      lastUpdated,
    };
  }

  /**
   * Check if customer has valid consent for a specific type
   */
  async hasConsent(customerId: string, consentType: string): Promise<boolean> {
    await this.setTenantContext();

    // Get the latest consent record for this type
    const { data, error } = await this.supabase
      .from(this.tableName('consent_records'))
      .select('consent_granted')
      .eq('customer_id', customerId)
      .eq('consent_type', consentType)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return false; // No consent record found
      }
      this.handleError(error, 'check consent');
    }

    return data?.consent_granted ?? false;
  }

  /**
   * Get consent metrics
   */
  async getMetrics(): Promise<ConsentMetrics> {
    await this.setTenantContext();

    // Get all consent records
    const { data, error } = await this.supabase
      .from(this.tableName('consent_records'))
      .select('customer_id, consent_type, consent_granted, method, created_at');

    if (error) {
      this.handleError(error, 'get consent metrics');
    }

    // Calculate metrics
    const byType: Record<string, { granted: number; revoked: number }> = {};
    const byMethod: Record<string, number> = {};
    let totalActive = 0;
    let totalRevoked = 0;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    let recentWithdrawals = 0;

    // Group by customer + type to get latest status
    const latestByCustomerType = new Map<string, boolean>();

    for (const row of data || []) {
      const key = `${row.customer_id}:${row.consent_type}`;

      // Track by type
      if (!byType[row.consent_type]) {
        byType[row.consent_type] = { granted: 0, revoked: 0 };
      }

      // Track by method
      byMethod[row.method] = (byMethod[row.method] || 0) + 1;

      // Track latest status per customer+type
      latestByCustomerType.set(key, row.consent_granted);

      // Track recent withdrawals
      if (!row.consent_granted && new Date(row.created_at) > thirtyDaysAgo) {
        recentWithdrawals++;
      }
    }

    // Count active/revoked based on latest status
    for (const [key, granted] of latestByCustomerType) {
      const consentType = key.split(':')[1];
      if (granted) {
        totalActive++;
        byType[consentType].granted++;
      } else {
        totalRevoked++;
        byType[consentType].revoked++;
      }
    }

    const total = totalActive + totalRevoked;
    const consentRate = total > 0 ? (totalActive / total) * 100 : 0;

    return {
      totalActive,
      totalRevoked,
      consentRate: Math.round(consentRate * 10) / 10,
      byType,
      byMethod,
      recentWithdrawals,
    };
  }

  /**
   * Map database row to ConsentRecord type
   */
  private mapToConsentRecord(row: ConsentRecordRow): ConsentRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      customerId: row.customer_id,
      consentType: row.consent_type as ConsentRecord['consentType'],
      consentGranted: row.consent_granted,
      grantedAt: row.granted_at ? new Date(row.granted_at) : null,
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      method: row.method as ConsentRecord['method'],
      legalBasis: row.legal_basis as ConsentRecord['legalBasis'],
      retentionDays: row.retention_days,
      metadata: row.metadata as ConsentRecord['metadata'],
      createdAt: new Date(row.created_at),
    };
  }
}
