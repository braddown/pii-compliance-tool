/**
 * Omnipii Cloud database adapter
 * Connects to the Omnipii Cloud API service
 */

import {
  BaseAdapter,
  type DatabaseAdapterConfig,
  type TenantContext,
  type TransactionHandle,
  type HealthCheckResult,
} from '../types/adapter';
import type { QueryBuilder, QueryResult } from '../types/query';
import type { OmnipiiConfig } from '../types/factory';
import {
  OMNIPII_REGION_URLS,
  DEFAULT_OMNIPII_REGION,
  parseOmnipiiApiKey,
} from '../types/factory';
import type {
  TenantUsage,
  LimitCheckResult,
  MeteredResource,
} from '../types/metering';

/**
 * Extended config for Omnipii adapter initialization
 */
export interface OmnipiiAdapterConfig extends DatabaseAdapterConfig {
  connection: OmnipiiConfig;
}

/**
 * Response from Omnipii API
 */
interface OmnipiiApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

/**
 * Omnipii Cloud database adapter
 * Makes HTTP calls to the Omnipii Cloud API
 */
export class OmnipiiAdapter extends BaseAdapter {
  readonly type = 'omnipii' as const;

  private _baseUrl: string = '';
  private _apiKey: string = '';
  private _tenantIdFromKey: string = '';

  /**
   * Initialize the adapter with Omnipii Cloud configuration
   */
  async initialize(config: OmnipiiAdapterConfig): Promise<void> {
    if (this._initialized) {
      throw new Error('Omnipii adapter already initialized');
    }

    const { apiKey, region, baseUrl } = config.connection;

    if (!apiKey) {
      throw new Error('Omnipii API key is required');
    }

    // Parse and validate API key
    const parsed = parseOmnipiiApiKey(apiKey);
    if (!parsed.valid) {
      throw new Error(
        'Invalid Omnipii API key format. Expected: op_<mode>_<tenant>_<key>'
      );
    }

    this._apiKey = apiKey;
    this._tenantIdFromKey = parsed.tenantId!;

    // Determine base URL
    const resolvedRegion = region ?? DEFAULT_OMNIPII_REGION;
    this._baseUrl = baseUrl ?? OMNIPII_REGION_URLS[resolvedRegion];

    this._config = config;
    this._tablePrefix = config.tablePrefix ?? 'compliance_';

    // Validate API key with the server
    const validation = await this.validateApiKey();
    if (!validation.valid) {
      throw new Error(`API key validation failed: ${validation.error}`);
    }

    this._initialized = true;

    if (config.debug) {
      console.log('[OmnipiiAdapter] Initialized with region:', resolvedRegion);
    }
  }

  /**
   * Validate API key with the server
   */
  private async validateApiKey(): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await this.apiCall<{ valid: boolean; tier: string }>(
        '/v1/auth/validate',
        { method: 'POST' }
      );

      if (response.success && response.data?.valid) {
        return { valid: true };
      }

      return {
        valid: false,
        error: response.error?.message ?? 'Validation failed',
      };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Apply tenant context
   */
  protected async applyTenantContext(context: TenantContext): Promise<void> {
    // For Omnipii Cloud, tenant is derived from API key
    // We just store the context locally
    if (context.tenantId !== this._tenantIdFromKey) {
      console.warn(
        '[OmnipiiAdapter] Tenant context differs from API key tenant. Using API key tenant.'
      );
    }
  }

  /**
   * Create a query builder for a table
   */
  from<T = Record<string, unknown>>(table: string): QueryBuilder<T> {
    this.ensureInitialized();

    const fullTableName = this.getFullTableName(table);

    return new OmnipiiQueryBuilder<T>(
      this._baseUrl,
      this._apiKey,
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

    try {
      const response = await this.apiCall<T>(`/v1/rpc/${functionName}`, {
        method: 'POST',
        body: params,
      });

      if (!response.success) {
        return {
          data: null,
          error: {
            code: response.error?.code ?? 'RPC_ERROR',
            message: response.error?.message ?? 'RPC call failed',
            details: response.error?.details,
          },
        };
      }

      return { data: response.data ?? null };
    } catch (err) {
      return {
        data: null,
        error: {
          code: 'RPC_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Begin a transaction
   */
  async beginTransaction(): Promise<TransactionHandle> {
    throw new Error(
      'Explicit transactions are not supported with Omnipii Cloud. ' +
      'Use database functions (RPC) for transactional operations.'
    );
  }

  /**
   * Check adapter health
   */
  async healthCheck(): Promise<HealthCheckResult> {
    if (!this._initialized) {
      return {
        healthy: false,
        latencyMs: 0,
        error: 'Adapter not initialized',
      };
    }

    const start = Date.now();

    try {
      const response = await this.apiCall<{ status: string }>('/v1/health');
      const latencyMs = Date.now() - start;

      if (response.success) {
        return { healthy: true, latencyMs };
      }

      return {
        healthy: false,
        latencyMs,
        error: response.error?.message ?? 'Health check failed',
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
   * Disconnect from the service
   */
  async disconnect(): Promise<void> {
    this._initialized = false;
    this._tenantContext = null;
    this._config = null;
  }

  /**
   * Get current usage for the tenant
   */
  async getUsage(): Promise<TenantUsage | null> {
    this.ensureInitialized();

    try {
      const response = await this.apiCall<TenantUsage>('/v1/metering/usage');
      return response.data ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Check if an operation is within limits
   */
  async checkLimit(
    resource: MeteredResource,
    count: number = 1
  ): Promise<LimitCheckResult> {
    this.ensureInitialized();

    try {
      const response = await this.apiCall<LimitCheckResult>('/v1/metering/check', {
        method: 'POST',
        body: { resource, count },
      });

      if (response.success && response.data) {
        return response.data;
      }

      // Default to allowed if check fails
      return {
        allowed: true,
        current: 0,
        limit: Infinity,
        percentUsed: 0,
      };
    } catch {
      // Default to allowed if check fails
      return {
        allowed: true,
        current: 0,
        limit: Infinity,
        percentUsed: 0,
      };
    }
  }

  /**
   * Make an API call to Omnipii Cloud
   */
  private async apiCall<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      body?: unknown;
      headers?: Record<string, string>;
    } = {}
  ): Promise<OmnipiiApiResponse<T>> {
    const { method = 'GET', body, headers = {} } = options;

    const url = `${this._baseUrl}${path}`;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this._apiKey,
        ...headers,
      },
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return {
        success: false,
        error: {
          code: `HTTP_${response.status}`,
          message: errorBody.message ?? response.statusText,
          details: errorBody.details,
        },
      };
    }

    const data = await response.json();
    return data as OmnipiiApiResponse<T>;
  }
}

/**
 * Query builder for Omnipii Cloud
 * Builds queries and sends them to the API
 */
class OmnipiiQueryBuilder<T = Record<string, unknown>> implements QueryBuilder<T> {
  private _filters: Array<{ column: string; operator: string; value: unknown }> = [];
  private _orderBy: Array<{ column: string; ascending: boolean }> = [];
  private _limit?: number;
  private _offset?: number;
  private _columns: string[] | '*' = '*';
  private _isSingle = false;
  private _operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private _data: Partial<T> | Partial<T>[] | null = null;
  private _countType?: 'exact' | 'planned' | 'estimated';

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly tableName: string,
    private readonly tenantContext: TenantContext | null,
    private readonly meteringCallback: ((event: any) => Promise<void>) | null
  ) {}

  select(
    columns?: string[] | '*',
    options?: { count?: 'exact' | 'planned' | 'estimated' }
  ): QueryBuilder<T> {
    this._operation = 'select';
    this._columns = columns ?? '*';
    this._countType = options?.count;
    return this;
  }

  eq(column: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ column, operator: 'eq', value });
    return this;
  }

  neq(column: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ column, operator: 'neq', value });
    return this;
  }

  gt(column: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ column, operator: 'gt', value });
    return this;
  }

  gte(column: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ column, operator: 'gte', value });
    return this;
  }

  lt(column: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ column, operator: 'lt', value });
    return this;
  }

  lte(column: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ column, operator: 'lte', value });
    return this;
  }

  like(column: string, pattern: string): QueryBuilder<T> {
    this._filters.push({ column, operator: 'like', value: pattern });
    return this;
  }

  ilike(column: string, pattern: string): QueryBuilder<T> {
    this._filters.push({ column, operator: 'ilike', value: pattern });
    return this;
  }

  in(column: string, values: unknown[]): QueryBuilder<T> {
    this._filters.push({ column, operator: 'in', value: values });
    return this;
  }

  contains(column: string, values: unknown[]): QueryBuilder<T> {
    this._filters.push({ column, operator: 'contains', value: values });
    return this;
  }

  is(column: string, value: null | boolean): QueryBuilder<T> {
    this._filters.push({ column, operator: 'is', value });
    return this;
  }

  not(column: string, operator: string, value: unknown): QueryBuilder<T> {
    this._filters.push({ column, operator: `not.${operator}`, value });
    return this;
  }

  or(filterString: string): QueryBuilder<T> {
    this._filters.push({ column: '_or', operator: 'or', value: filterString });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T> {
    this._orderBy.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  range(from: number, to: number): QueryBuilder<T> {
    this._offset = from;
    this._limit = to - from + 1;
    return this;
  }

  limit(count: number): QueryBuilder<T> {
    this._limit = count;
    return this;
  }

  insert(data: Partial<T> | Partial<T>[]): QueryBuilder<T> {
    this._operation = 'insert';
    this._data = data;
    return this;
  }

  update(data: Partial<T>): QueryBuilder<T> {
    this._operation = 'update';
    this._data = data;
    return this;
  }

  delete(): QueryBuilder<T> {
    this._operation = 'delete';
    return this;
  }

  single(): QueryBuilder<T> {
    this._isSingle = true;
    return this;
  }

  async then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    try {
      const result = await this.execute();

      if (onfulfilled) {
        return onfulfilled(result);
      }
      return result as unknown as TResult1;
    } catch (error) {
      if (onrejected) {
        return onrejected(error);
      }
      throw error;
    }
  }

  /**
   * Execute the query against Omnipii Cloud API
   */
  private async execute(): Promise<QueryResult<T>> {
    const query = {
      table: this.tableName,
      operation: this._operation,
      columns: this._columns,
      filters: this._filters,
      orderBy: this._orderBy,
      limit: this._limit,
      offset: this._offset,
      single: this._isSingle,
      count: this._countType,
      data: this._data,
    };

    const response = await fetch(`${this.baseUrl}/v1/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
      },
      body: JSON.stringify(query),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        data: null,
        error: {
          code: result.error?.code ?? `HTTP_${response.status}`,
          message: result.error?.message ?? 'Query failed',
          details: result.error?.details,
        },
      };
    }

    // Record metering for mutations
    if (this.meteringCallback && this.tenantContext && this._operation !== 'select') {
      const recordCount = Array.isArray(result.data)
        ? result.data.length
        : result.data ? 1 : 0;

      if (recordCount > 0) {
        try {
          await this.meteringCallback({
            tenantId: this.tenantContext.tenantId,
            operation: this._operation,
            table: this.tableName,
            recordCount,
            timestamp: new Date(),
          });
        } catch (err) {
          console.error('[OmnipiiQueryBuilder] Metering callback failed:', err);
        }
      }
    }

    return {
      data: result.data,
      count: result.count,
    };
  }
}
