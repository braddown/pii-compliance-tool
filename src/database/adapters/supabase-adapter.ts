/**
 * Supabase database adapter implementation
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  BaseAdapter,
  type DatabaseAdapterConfig,
  type TenantContext,
  type TransactionHandle,
  type HealthCheckResult,
} from '../types/adapter';
import type { QueryBuilder, QueryResult } from '../types/query';
import type { SupabaseConfig } from '../types/factory';
import { SupabaseQueryBuilder } from '../query-builder/supabase-query-builder';

/**
 * Extended config for Supabase adapter initialization
 */
export interface SupabaseAdapterConfig extends DatabaseAdapterConfig {
  connection: SupabaseConfig;
}

/**
 * Supabase database adapter
 * Wraps Supabase client with our adapter interface
 */
export class SupabaseAdapter extends BaseAdapter {
  readonly type = 'supabase' as const;

  private _supabase: SupabaseClient | null = null;

  /**
   * Get the underlying Supabase client
   * Useful for advanced operations not covered by the adapter interface
   */
  get supabase(): SupabaseClient {
    this.ensureInitialized();
    return this._supabase!;
  }

  /**
   * Initialize the adapter with Supabase configuration
   */
  async initialize(config: SupabaseAdapterConfig): Promise<void> {
    if (this._initialized) {
      throw new Error('Supabase adapter already initialized');
    }

    const { url, anonKey, serviceRoleKey } = config.connection;

    if (!url || !anonKey) {
      throw new Error('Supabase URL and anon key are required');
    }

    // Use service role key if available for server-side operations
    const key = serviceRoleKey || anonKey;

    this._supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this._config = config;
    this._tablePrefix = config.tablePrefix ?? 'compliance_';
    this._initialized = true;

    if (config.debug) {
      console.log('[SupabaseAdapter] Initialized with URL:', url);
    }
  }

  /**
   * Create a new instance with an existing Supabase client
   * This is for backwards compatibility with existing code
   */
  static fromClient(
    client: SupabaseClient,
    options: { tablePrefix?: string; debug?: boolean } = {}
  ): SupabaseAdapter {
    const adapter = new SupabaseAdapter();
    adapter._supabase = client;
    adapter._tablePrefix = options.tablePrefix ?? 'compliance_';
    adapter._initialized = true;
    adapter._config = {
      connection: {} as SupabaseConfig, // Not needed when client is provided
      tablePrefix: options.tablePrefix,
      debug: options.debug,
    };
    return adapter;
  }

  /**
   * Apply tenant context via RLS
   */
  protected async applyTenantContext(context: TenantContext): Promise<void> {
    this.ensureInitialized();

    // Set tenant context via RPC function
    const { error } = await this._supabase!.rpc('set_tenant_context', {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId ?? null,
    });

    if (error) {
      throw new Error(`Failed to set tenant context: ${error.message}`);
    }
  }

  /**
   * Create a query builder for a table
   */
  from<T = Record<string, unknown>>(table: string): QueryBuilder<T> {
    this.ensureInitialized();

    const fullTableName = this.getFullTableName(table);

    return new SupabaseQueryBuilder<T>(
      this._supabase!,
      fullTableName,
      this._tenantContext,
      this._meteringCallback
    );
  }

  /**
   * Execute an RPC function
   */
  async rpc<T = unknown>(
    functionName: string,
    params?: Record<string, unknown>
  ): Promise<QueryResult<T>> {
    this.ensureInitialized();

    const { data, error } = await this._supabase!.rpc(functionName, params);

    if (error) {
      return {
        data: null,
        error: {
          code: error.code || 'RPC_ERROR',
          message: error.message,
          details: error.details,
          hint: error.hint,
        },
      };
    }

    return { data };
  }

  /**
   * Begin a transaction
   * Note: Supabase doesn't support explicit transactions via PostgREST
   * This is a placeholder that throws an error
   */
  async beginTransaction(): Promise<TransactionHandle> {
    throw new Error(
      'Explicit transactions are not supported with Supabase via PostgREST. ' +
      'Use database functions (RPC) for transactional operations.'
    );
  }

  /**
   * Check adapter health
   */
  async healthCheck(): Promise<HealthCheckResult> {
    if (!this._initialized || !this._supabase) {
      return {
        healthy: false,
        latencyMs: 0,
        error: 'Adapter not initialized',
      };
    }

    const start = Date.now();

    try {
      // Simple query to check connectivity
      const { error } = await this._supabase
        .from(this.getFullTableName('audit_logs'))
        .select('id')
        .limit(1);

      const latencyMs = Date.now() - start;

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is fine for health check
        return {
          healthy: false,
          latencyMs,
          error: error.message,
        };
      }

      return {
        healthy: true,
        latencyMs,
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Disconnect from the database
   * Note: Supabase client doesn't have explicit disconnect
   */
  async disconnect(): Promise<void> {
    // Supabase JS client doesn't have explicit disconnect
    // Just clear our references
    this._supabase = null;
    this._initialized = false;
    this._tenantContext = null;
    this._config = null;
  }
}
