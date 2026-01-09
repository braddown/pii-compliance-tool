import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';

/**
 * Database error with additional context
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: string,
    public readonly hint?: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }

  static fromPostgrestError(error: PostgrestError): DatabaseError {
    return new DatabaseError(
      error.message,
      error.code,
      error.details,
      error.hint
    );
  }
}

/**
 * Record not found error
 */
export class NotFoundError extends Error {
  constructor(resource: string, id?: string) {
    super(id ? `${resource} with id '${id}' not found` : `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Base repository configuration
 */
export interface BaseRepositoryConfig {
  tablePrefix?: string;
}

/**
 * Base repository with common functionality for all compliance repositories
 */
export abstract class BaseRepository {
  protected readonly supabase: SupabaseClient;
  protected readonly tenantId: string;
  protected readonly tablePrefix: string;

  constructor(
    supabase: SupabaseClient,
    tenantId: string,
    config: BaseRepositoryConfig = {}
  ) {
    this.supabase = supabase;
    this.tenantId = tenantId;
    this.tablePrefix = config.tablePrefix ?? 'compliance_';
  }

  /**
   * Get the full table name with prefix
   */
  protected tableName(name: string): string {
    return `${this.tablePrefix}${name}`;
  }

  /**
   * Set the tenant context for RLS
   * Must be called before any query that uses RLS policies
   */
  protected async setTenantContext(): Promise<void> {
    const { error } = await this.supabase.rpc('set_tenant_context', {
      tenant_id: this.tenantId,
    });

    if (error) {
      // Try alternative function name
      const { error: altError } = await this.supabase.rpc('set_session_variable', {
        variable_name: 'app.current_tenant_id',
        variable_value: this.tenantId,
      });

      if (altError) {
        throw new DatabaseError(
          'Failed to set tenant context',
          altError.code,
          altError.details
        );
      }
    }
  }

  /**
   * Handle Postgrest errors consistently
   */
  protected handleError(error: PostgrestError, operation: string): never {
    const dbError = DatabaseError.fromPostgrestError(error);
    console.error(`[${this.constructor.name}] ${operation} failed:`, {
      message: error.message,
      code: error.code,
      details: error.details,
    });
    throw dbError;
  }

  /**
   * Convert database row to camelCase object
   */
  protected toCamelCase<T>(row: Record<string, unknown>): T {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
        letter.toUpperCase()
      );
      result[camelKey] = value;
    }
    return result as T;
  }

  /**
   * Convert camelCase object to snake_case for database
   */
  protected toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      result[snakeKey] = value;
    }
    return result;
  }

  /**
   * Parse date strings to Date objects
   */
  protected parseDate(value: unknown): Date | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') return new Date(value);
    return null;
  }

  /**
   * Format Date to ISO string for database
   */
  protected formatDate(date: Date | null | undefined): string | null {
    if (!date) return null;
    return date.toISOString();
  }
}
