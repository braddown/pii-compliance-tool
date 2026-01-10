/**
 * Query builder types for database adapter abstraction
 */

/**
 * Filter operators for database queries
 */
export type FilterOperator =
  | 'eq'        // Equal
  | 'neq'       // Not equal
  | 'gt'        // Greater than
  | 'gte'       // Greater than or equal
  | 'lt'        // Less than
  | 'lte'       // Less than or equal
  | 'like'      // Pattern match (case-sensitive)
  | 'ilike'     // Pattern match (case-insensitive)
  | 'in'        // In array
  | 'contains'  // Array contains value(s)
  | 'is'        // IS NULL / IS NOT NULL
  | 'not';      // Negation wrapper

/**
 * Single filter condition
 */
export interface FilterCondition {
  column: string;
  operator: FilterOperator;
  value: unknown;
  negate?: boolean;
}

/**
 * OR group of filter conditions
 */
export interface OrFilterGroup {
  type: 'or';
  conditions: FilterCondition[];
}

/**
 * Combined filter type
 */
export type QueryFilter = FilterCondition | OrFilterGroup;

/**
 * Order by clause
 */
export interface OrderByClause {
  column: string;
  ascending: boolean;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  offset: number;
  limit: number;
}

/**
 * Select query options
 */
export interface SelectOptions {
  columns?: string[] | '*';
  count?: 'exact' | 'planned' | 'estimated' | false;
  filters?: QueryFilter[];
  orderBy?: OrderByClause[];
  pagination?: PaginationOptions;
  single?: boolean;
}

/**
 * Database adapter error
 */
export interface DatabaseAdapterError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
}

/**
 * Result from a database query
 */
export interface QueryResult<T> {
  data: T | T[] | null;
  count?: number;
  error?: DatabaseAdapterError;
}

/**
 * Query builder interface - fluent API for building queries
 */
export interface QueryBuilder<T = Record<string, unknown>> {
  // Selection
  select(
    columns?: string[] | '*',
    options?: { count?: 'exact' | 'planned' | 'estimated' }
  ): QueryBuilder<T>;

  // Filters
  eq(column: string, value: unknown): QueryBuilder<T>;
  neq(column: string, value: unknown): QueryBuilder<T>;
  gt(column: string, value: unknown): QueryBuilder<T>;
  gte(column: string, value: unknown): QueryBuilder<T>;
  lt(column: string, value: unknown): QueryBuilder<T>;
  lte(column: string, value: unknown): QueryBuilder<T>;
  like(column: string, pattern: string): QueryBuilder<T>;
  ilike(column: string, pattern: string): QueryBuilder<T>;
  in(column: string, values: unknown[]): QueryBuilder<T>;
  contains(column: string, values: unknown[]): QueryBuilder<T>;
  is(column: string, value: null | boolean): QueryBuilder<T>;
  not(column: string, operator: string, value: unknown): QueryBuilder<T>;
  or(filterString: string): QueryBuilder<T>;

  // Ordering and pagination
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>;
  range(from: number, to: number): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;

  // Mutations
  insert(data: Partial<T> | Partial<T>[]): QueryBuilder<T>;
  update(data: Partial<T>): QueryBuilder<T>;
  delete(): QueryBuilder<T>;

  // Modifiers
  single(): QueryBuilder<T>;

  // Execute - thenable for await support
  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2>;
}
