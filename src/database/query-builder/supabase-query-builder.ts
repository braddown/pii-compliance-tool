/**
 * Supabase-specific query builder implementation
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { QueryBuilder, QueryResult } from '../types/query';
import type { MeteringCallback, MeteringEvent, TenantContext } from '../types/adapter';

// Use a simplified type for the Supabase query builder chain
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseQuery = any;

/**
 * Query builder implementation for Supabase
 * Wraps Supabase's PostgREST query builder with our interface
 */
export class SupabaseQueryBuilder<T = Record<string, unknown>> implements QueryBuilder<T> {
  private _query: SupabaseQuery;
  private _operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private _isSingle = false;
  private _data: Partial<T> | Partial<T>[] | null = null;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly tableName: string,
    private readonly tenantContext: TenantContext | null,
    private readonly meteringCallback: MeteringCallback | null
  ) {
    // Start with a select query by default
    this._query = this.supabase.from(this.tableName).select('*') as unknown as SupabaseQuery;
  }

  /**
   * Select columns from the table
   */
  select(
    columns?: string[] | '*',
    options?: { count?: 'exact' | 'planned' | 'estimated' }
  ): QueryBuilder<T> {
    this._operation = 'select';
    const columnString = columns === '*' || !columns ? '*' : columns.join(', ');
    this._query = this.supabase.from(this.tableName).select(columnString, {
      count: options?.count,
    }) as unknown as SupabaseQuery;
    return this;
  }

  /**
   * Filter: equal
   */
  eq(column: string, value: unknown): QueryBuilder<T> {
    this._query = this._query.eq(column, value) as SupabaseQuery;
    return this;
  }

  /**
   * Filter: not equal
   */
  neq(column: string, value: unknown): QueryBuilder<T> {
    this._query = this._query.neq(column, value) as SupabaseQuery;
    return this;
  }

  /**
   * Filter: greater than
   */
  gt(column: string, value: unknown): QueryBuilder<T> {
    this._query = this._query.gt(column, value) as SupabaseQuery;
    return this;
  }

  /**
   * Filter: greater than or equal
   */
  gte(column: string, value: unknown): QueryBuilder<T> {
    this._query = this._query.gte(column, value) as SupabaseQuery;
    return this;
  }

  /**
   * Filter: less than
   */
  lt(column: string, value: unknown): QueryBuilder<T> {
    this._query = this._query.lt(column, value) as SupabaseQuery;
    return this;
  }

  /**
   * Filter: less than or equal
   */
  lte(column: string, value: unknown): QueryBuilder<T> {
    this._query = this._query.lte(column, value) as SupabaseQuery;
    return this;
  }

  /**
   * Filter: pattern match (case-sensitive)
   */
  like(column: string, pattern: string): QueryBuilder<T> {
    this._query = this._query.like(column, pattern) as SupabaseQuery;
    return this;
  }

  /**
   * Filter: pattern match (case-insensitive)
   */
  ilike(column: string, pattern: string): QueryBuilder<T> {
    this._query = this._query.ilike(column, pattern) as SupabaseQuery;
    return this;
  }

  /**
   * Filter: value in array
   */
  in(column: string, values: unknown[]): QueryBuilder<T> {
    this._query = this._query.in(column, values) as SupabaseQuery;
    return this;
  }

  /**
   * Filter: array contains values
   */
  contains(column: string, values: unknown[]): QueryBuilder<T> {
    this._query = this._query.contains(column, values) as SupabaseQuery;
    return this;
  }

  /**
   * Filter: IS NULL / IS NOT NULL / IS TRUE / IS FALSE
   */
  is(column: string, value: null | boolean): QueryBuilder<T> {
    this._query = this._query.is(column, value) as SupabaseQuery;
    return this;
  }

  /**
   * Filter: negation
   */
  not(column: string, operator: string, value: unknown): QueryBuilder<T> {
    this._query = this._query.not(column, operator, value) as SupabaseQuery;
    return this;
  }

  /**
   * Filter: OR conditions
   */
  or(filterString: string): QueryBuilder<T> {
    this._query = this._query.or(filterString) as SupabaseQuery;
    return this;
  }

  /**
   * Order results
   */
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T> {
    this._query = this._query.order(column, {
      ascending: options?.ascending ?? true,
    }) as SupabaseQuery;
    return this;
  }

  /**
   * Limit results with range
   */
  range(from: number, to: number): QueryBuilder<T> {
    this._query = this._query.range(from, to) as SupabaseQuery;
    return this;
  }

  /**
   * Limit number of results
   */
  limit(count: number): QueryBuilder<T> {
    this._query = this._query.limit(count) as SupabaseQuery;
    return this;
  }

  /**
   * Insert data
   */
  insert(data: Partial<T> | Partial<T>[]): QueryBuilder<T> {
    this._operation = 'insert';
    this._data = data;
    this._query = this.supabase
      .from(this.tableName)
      .insert(data as any)
      .select() as unknown as SupabaseQuery;
    return this;
  }

  /**
   * Update data
   */
  update(data: Partial<T>): QueryBuilder<T> {
    this._operation = 'update';
    this._data = data;
    this._query = this.supabase
      .from(this.tableName)
      .update(data as any)
      .select() as unknown as SupabaseQuery;
    return this;
  }

  /**
   * Delete data
   */
  delete(): QueryBuilder<T> {
    this._operation = 'delete';
    this._query = this.supabase
      .from(this.tableName)
      .delete() as unknown as SupabaseQuery;
    return this;
  }

  /**
   * Return single result
   */
  single(): QueryBuilder<T> {
    this._isSingle = true;
    return this;
  }

  /**
   * Execute the query (thenable)
   */
  async then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    try {
      let result: QueryResult<T>;

      if (this._isSingle) {
        const response = await (this._query as any).single();
        result = this.mapResponse(response);
      } else {
        const response = await this._query;
        result = this.mapResponse(response);
      }

      // Record metering for mutations
      if (this.meteringCallback && this.tenantContext && !result.error) {
        const recordCount = this.getRecordCount(result);
        if (recordCount > 0 && this._operation !== 'select') {
          await this.recordMetering(recordCount);
        }
      }

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
   * Map Supabase response to our QueryResult format
   */
  private mapResponse(response: { data: any; error: any; count?: number | null }): QueryResult<T> {
    if (response.error) {
      return {
        data: null,
        error: {
          code: response.error.code || 'UNKNOWN',
          message: response.error.message || 'Unknown error',
          details: response.error.details,
          hint: response.error.hint,
        },
      };
    }

    return {
      data: response.data,
      count: response.count ?? undefined,
    };
  }

  /**
   * Get record count from result for metering
   */
  private getRecordCount(result: QueryResult<T>): number {
    if (!result.data) return 0;
    if (Array.isArray(result.data)) return result.data.length;
    return 1;
  }

  /**
   * Record metering event
   */
  private async recordMetering(recordCount: number): Promise<void> {
    if (!this.meteringCallback || !this.tenantContext) return;

    const event: MeteringEvent = {
      tenantId: this.tenantContext.tenantId,
      operation: this._operation as MeteringEvent['operation'],
      table: this.tableName,
      recordCount,
      timestamp: new Date(),
    };

    try {
      await this.meteringCallback(event);
    } catch (err) {
      // Don't fail the operation if metering fails
      console.error('[SupabaseQueryBuilder] Metering callback failed:', err);
    }
  }
}
