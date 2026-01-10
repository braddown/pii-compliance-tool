/**
 * Database adapter type exports
 */

// Query builder types
export type {
  FilterOperator,
  FilterCondition,
  OrFilterGroup,
  QueryFilter,
  OrderByClause,
  PaginationOptions,
  SelectOptions,
  DatabaseAdapterError,
  QueryResult,
  QueryBuilder,
} from './query';

// Adapter types
export type {
  DatabaseAdapterType,
  DatabaseAdapterConfig,
  TenantContext,
  MeteringEvent,
  MeteringCallback,
  TransactionHandle,
  HealthCheckResult,
  DatabaseAdapter,
} from './adapter';

export { BaseAdapter } from './adapter';

// Factory types
export type {
  OmnipiiConfig,
  SupabaseConfig,
  PostgreSQLConfig,
  MySQLConfig,
  DatabaseConfiguration,
  ConfigForAdapter,
  DatabaseFactoryOptions,
  AdapterFactoryResult,
} from './factory';

export {
  DEFAULT_OMNIPII_REGION,
  DEFAULT_OMNIPII_BASE_URL,
  OMNIPII_REGION_URLS,
  isValidOmnipiiApiKey,
  parseOmnipiiApiKey,
} from './factory';

// Metering types
export type {
  UsageTier,
  TierLimits,
  TenantUsage,
  MeteredResource,
  LimitCheckResult,
  UsageHistoryEntry,
  MeteringService,
} from './metering';

export {
  TIER_LIMITS,
  TIER_PRICING,
  RESOURCE_TO_LIMIT,
  RESOURCE_TO_USAGE,
  UsageLimitExceededError,
  wouldExceedLimit,
  calculatePercentUsed,
  getUpgradeSuggestion,
} from './metering';
