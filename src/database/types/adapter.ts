/**
 * Database adapter interface and related types
 */

import type { QueryBuilder, QueryResult } from './query';

/**
 * Supported database adapter types
 */
export type DatabaseAdapterType = 'omnipii' | 'supabase' | 'postgresql' | 'mysql';

/**
 * Configuration for initializing a database adapter
 */
export interface DatabaseAdapterConfig {
  /** Connection configuration (varies by adapter type) */
  connection: unknown;
  /** Table name prefix (default: 'compliance_') */
  tablePrefix?: string;
  /** Enable debug/query logging */
  debug?: boolean;
  /** Connection pool size (for connection-pooled adapters) */
  poolSize?: number;
}

/**
 * Tenant context for multi-tenant isolation
 */
export interface TenantContext {
  tenantId: string;
  userId?: string;
}

/**
 * Metering event for usage tracking
 */
export interface MeteringEvent {
  tenantId: string;
  operation: 'insert' | 'select' | 'update' | 'delete';
  table: string;
  recordCount: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Metering callback for tracking usage
 */
export type MeteringCallback = (event: MeteringEvent) => Promise<void>;

/**
 * Transaction handle for managing database transactions
 */
export interface TransactionHandle {
  /** Create a query builder within this transaction */
  from<T = Record<string, unknown>>(table: string): QueryBuilder<T>;
  /** Commit the transaction */
  commit(): Promise<void>;
  /** Rollback the transaction */
  rollback(): Promise<void>;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * Main database adapter interface
 *
 * All database adapters must implement this interface to provide
 * a consistent API for database operations across different backends.
 */
export interface DatabaseAdapter {
  /**
   * Adapter type identifier
   */
  readonly type: DatabaseAdapterType;

  /**
   * Whether the adapter has been initialized
   */
  readonly initialized: boolean;

  /**
   * Initialize the adapter with configuration
   * Must be called before any other operations
   */
  initialize(config: DatabaseAdapterConfig): Promise<void>;

  /**
   * Set tenant context for multi-tenant isolation
   * Must be called before any query that requires tenant isolation
   */
  setTenantContext(context: TenantContext): Promise<void>;

  /**
   * Clear the current tenant context
   */
  clearTenantContext(): Promise<void>;

  /**
   * Get the current tenant context
   */
  getTenantContext(): TenantContext | null;

  /**
   * Start a query builder for a table
   * @param table - Table name (without prefix, prefix is handled internally)
   */
  from<T = Record<string, unknown>>(table: string): QueryBuilder<T>;

  /**
   * Execute a stored procedure/function (RPC)
   * @param functionName - Name of the function to execute
   * @param params - Parameters to pass to the function
   */
  rpc<T = unknown>(
    functionName: string,
    params?: Record<string, unknown>
  ): Promise<QueryResult<T>>;

  /**
   * Begin a database transaction
   * Note: Not all adapters support explicit transactions
   * @throws Error if transactions are not supported
   */
  beginTransaction(): Promise<TransactionHandle>;

  /**
   * Register a metering callback for usage tracking
   * Called after successful insert/update/delete operations
   */
  setMeteringCallback(callback: MeteringCallback): void;

  /**
   * Check adapter health and connectivity
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * Close connections and cleanup resources
   */
  disconnect(): Promise<void>;
}

/**
 * Abstract base class for database adapters
 * Provides common functionality that all adapters share
 */
export abstract class BaseAdapter implements DatabaseAdapter {
  abstract readonly type: DatabaseAdapterType;

  protected _initialized = false;
  protected _config: DatabaseAdapterConfig | null = null;
  protected _tenantContext: TenantContext | null = null;
  protected _meteringCallback: MeteringCallback | null = null;
  protected _tablePrefix = 'compliance_';

  get initialized(): boolean {
    return this._initialized;
  }

  abstract initialize(config: DatabaseAdapterConfig): Promise<void>;
  abstract from<T>(table: string): QueryBuilder<T>;
  abstract rpc<T>(functionName: string, params?: Record<string, unknown>): Promise<QueryResult<T>>;
  abstract beginTransaction(): Promise<TransactionHandle>;
  abstract healthCheck(): Promise<HealthCheckResult>;
  abstract disconnect(): Promise<void>;

  async setTenantContext(context: TenantContext): Promise<void> {
    this._tenantContext = context;
    await this.applyTenantContext(context);
  }

  async clearTenantContext(): Promise<void> {
    this._tenantContext = null;
  }

  getTenantContext(): TenantContext | null {
    return this._tenantContext;
  }

  setMeteringCallback(callback: MeteringCallback): void {
    this._meteringCallback = callback;
  }

  /**
   * Apply tenant context to the database connection
   * Override in subclasses to implement adapter-specific logic
   */
  protected abstract applyTenantContext(context: TenantContext): Promise<void>;

  /**
   * Record a metering event if callback is registered
   */
  protected async recordMetering(
    operation: MeteringEvent['operation'],
    table: string,
    recordCount: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (this._meteringCallback && this._tenantContext) {
      try {
        await this._meteringCallback({
          tenantId: this._tenantContext.tenantId,
          operation,
          table,
          recordCount,
          timestamp: new Date(),
          metadata,
        });
      } catch (err) {
        // Don't fail the operation if metering fails
        console.error('[DatabaseAdapter] Metering callback failed:', err);
      }
    }
  }

  /**
   * Get the full table name with prefix
   */
  protected getFullTableName(table: string): string {
    // If table already has prefix, don't add it again
    if (table.startsWith(this._tablePrefix)) {
      return table;
    }
    return `${this._tablePrefix}${table}`;
  }

  /**
   * Ensure adapter is initialized before operations
   */
  protected ensureInitialized(): void {
    if (!this._initialized) {
      throw new Error(`${this.type} adapter not initialized. Call initialize() first.`);
    }
  }
}
