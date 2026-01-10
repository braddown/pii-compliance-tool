/**
 * Metering and usage tracking types for Omnipii SaaS
 */

/**
 * Available pricing tiers
 */
export type UsageTier = 'free' | 'starter' | 'pro' | 'enterprise';

/**
 * Tier limits configuration
 */
export interface TierLimits {
  /** Maximum DSRs per billing period */
  maxDsrs: number;
  /** Maximum activities per billing period */
  maxActivities: number;
  /** Maximum PII locations */
  maxPiiLocations: number;
  /** Maximum audit log entries per billing period */
  maxAuditLogs: number;
  /** Maximum consent records per billing period */
  maxConsentRecords: number;
  /** Whether custom database connectors are allowed */
  customConnectors: boolean;
  /** API rate limit (requests per minute) */
  apiRateLimit: number;
  /** Data retention period in days */
  retentionDays: number;
}

/**
 * Tier limits by plan
 */
export const TIER_LIMITS: Record<UsageTier, TierLimits> = {
  free: {
    maxDsrs: 50,
    maxActivities: 250,
    maxPiiLocations: 5,
    maxAuditLogs: 1000,
    maxConsentRecords: 100,
    customConnectors: false,
    apiRateLimit: 60,
    retentionDays: 30,
  },
  starter: {
    maxDsrs: 500,
    maxActivities: 2500,
    maxPiiLocations: 20,
    maxAuditLogs: 10000,
    maxConsentRecords: 1000,
    customConnectors: false,
    apiRateLimit: 300,
    retentionDays: 90,
  },
  pro: {
    maxDsrs: 5000,
    maxActivities: 25000,
    maxPiiLocations: 100,
    maxAuditLogs: 100000,
    maxConsentRecords: 10000,
    customConnectors: true,
    apiRateLimit: 1000,
    retentionDays: 365,
  },
  enterprise: {
    maxDsrs: Infinity,
    maxActivities: Infinity,
    maxPiiLocations: Infinity,
    maxAuditLogs: Infinity,
    maxConsentRecords: Infinity,
    customConnectors: true,
    apiRateLimit: Infinity,
    retentionDays: Infinity,
  },
};

/**
 * Pricing information by tier (monthly, in cents)
 */
export const TIER_PRICING: Record<UsageTier, { monthly: number; yearly: number }> = {
  free: { monthly: 0, yearly: 0 },
  starter: { monthly: 2900, yearly: 29000 }, // $29/mo or $290/yr
  pro: { monthly: 9900, yearly: 99000 }, // $99/mo or $990/yr
  enterprise: { monthly: 0, yearly: 0 }, // Custom pricing
};

/**
 * Current usage for a tenant in a billing period
 */
export interface TenantUsage {
  /** Tenant ID */
  tenantId: string;
  /** Current tier */
  tier: UsageTier;
  /** Billing period start */
  periodStart: Date;
  /** Billing period end */
  periodEnd: Date;
  /** Current DSR count */
  dsrCount: number;
  /** Current activity count */
  activityCount: number;
  /** Current PII location count */
  piiLocationCount: number;
  /** Current audit log count */
  auditLogCount: number;
  /** Current consent record count */
  consentCount: number;
  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Resource types that are metered
 */
export type MeteredResource =
  | 'dsr'
  | 'activity'
  | 'pii_location'
  | 'audit_log'
  | 'consent';

/**
 * Map resource types to their limit keys
 */
export const RESOURCE_TO_LIMIT: Record<MeteredResource, keyof TierLimits> = {
  dsr: 'maxDsrs',
  activity: 'maxActivities',
  pii_location: 'maxPiiLocations',
  audit_log: 'maxAuditLogs',
  consent: 'maxConsentRecords',
};

/**
 * Map resource types to their usage count keys
 */
export const RESOURCE_TO_USAGE: Record<MeteredResource, keyof TenantUsage> = {
  dsr: 'dsrCount',
  activity: 'activityCount',
  pii_location: 'piiLocationCount',
  audit_log: 'auditLogCount',
  consent: 'consentCount',
};

/**
 * Result of a limit check
 */
export interface LimitCheckResult {
  /** Whether the operation is allowed */
  allowed: boolean;
  /** Current usage */
  current: number;
  /** Maximum allowed */
  limit: number;
  /** Percentage of limit used */
  percentUsed: number;
  /** If not allowed, reason */
  reason?: string;
  /** Upgrade URL if limit exceeded */
  upgradeUrl?: string;
}

/**
 * Usage history entry
 */
export interface UsageHistoryEntry {
  /** Period start date */
  periodStart: Date;
  /** Period end date */
  periodEnd: Date;
  /** Tier during this period */
  tier: UsageTier;
  /** Usage counts */
  usage: {
    dsrs: number;
    activities: number;
    piiLocations: number;
    auditLogs: number;
    consents: number;
  };
}

/**
 * Metering service interface
 */
export interface MeteringService {
  /**
   * Get current usage for a tenant
   */
  getCurrentUsage(tenantId: string): Promise<TenantUsage>;

  /**
   * Check if a resource operation is allowed
   */
  checkLimit(
    tenantId: string,
    resource: MeteredResource,
    count?: number
  ): Promise<LimitCheckResult>;

  /**
   * Record resource usage
   */
  recordUsage(
    tenantId: string,
    resource: MeteredResource,
    count: number,
    metadata?: Record<string, unknown>
  ): Promise<void>;

  /**
   * Get usage history for a tenant
   */
  getUsageHistory(
    tenantId: string,
    periods?: number
  ): Promise<UsageHistoryEntry[]>;

  /**
   * Get tenant's current tier
   */
  getTier(tenantId: string): Promise<UsageTier>;

  /**
   * Check if a feature is available for tenant's tier
   */
  hasFeature(tenantId: string, feature: keyof TierLimits): Promise<boolean>;

  /**
   * Get limits for a tier
   */
  getLimits(tier: UsageTier): TierLimits;
}

/**
 * Error thrown when a usage limit is exceeded
 */
export class UsageLimitExceededError extends Error {
  constructor(
    public readonly resource: MeteredResource,
    public readonly current: number,
    public readonly limit: number,
    public readonly tier: UsageTier,
    public readonly upgradeUrl?: string
  ) {
    super(
      `Usage limit exceeded for ${resource}. Current: ${current}, Limit: ${limit}. ` +
      `Upgrade your plan at ${upgradeUrl || 'https://omnipii.com/pricing'}`
    );
    this.name = 'UsageLimitExceededError';
  }
}

/**
 * Check if current usage would exceed limit
 */
export function wouldExceedLimit(
  current: number,
  limit: number,
  increment: number = 1
): boolean {
  if (limit === Infinity) return false;
  return current + increment > limit;
}

/**
 * Calculate percentage of limit used
 */
export function calculatePercentUsed(current: number, limit: number): number {
  if (limit === Infinity) return 0;
  if (limit === 0) return current > 0 ? 100 : 0;
  return Math.round((current / limit) * 100);
}

/**
 * Get upgrade suggestion based on current tier and usage
 */
export function getUpgradeSuggestion(
  tier: UsageTier,
  usage: TenantUsage
): UsageTier | null {
  if (tier === 'enterprise') return null;

  const limits = TIER_LIMITS[tier];
  const nextTier: UsageTier =
    tier === 'free' ? 'starter' :
    tier === 'starter' ? 'pro' : 'enterprise';

  // Check if any resource is at 80% or more of limit
  const resources: MeteredResource[] = ['dsr', 'activity', 'pii_location', 'audit_log', 'consent'];

  for (const resource of resources) {
    const limitKey = RESOURCE_TO_LIMIT[resource];
    const usageKey = RESOURCE_TO_USAGE[resource];
    const limit = limits[limitKey] as number;
    const current = usage[usageKey] as number;

    if (calculatePercentUsed(current, limit) >= 80) {
      return nextTier;
    }
  }

  return null;
}
