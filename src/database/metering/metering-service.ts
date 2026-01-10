/**
 * Metering service implementation
 * Tracks usage and enforces limits for Omnipii SaaS
 */

import type {
  MeteringService,
  TenantUsage,
  MeteredResource,
  LimitCheckResult,
  UsageHistoryEntry,
  UsageTier,
  TierLimits,
} from '../types/metering';
import {
  TIER_LIMITS,
  RESOURCE_TO_LIMIT,
  RESOURCE_TO_USAGE,
  wouldExceedLimit,
  calculatePercentUsed,
} from '../types/metering';

/**
 * In-memory metering service for development/testing
 * Production implementation will use the Omnipii Cloud API
 */
export class InMemoryMeteringService implements MeteringService {
  private usageStore: Map<string, TenantUsage> = new Map();
  private tierStore: Map<string, UsageTier> = new Map();

  constructor(private readonly upgradeBaseUrl: string = 'https://omnipii.com/upgrade') {}

  /**
   * Get or create usage record for tenant
   */
  async getCurrentUsage(tenantId: string): Promise<TenantUsage> {
    let usage = this.usageStore.get(tenantId);

    if (!usage) {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      usage = {
        tenantId,
        tier: await this.getTier(tenantId),
        periodStart,
        periodEnd,
        dsrCount: 0,
        activityCount: 0,
        piiLocationCount: 0,
        auditLogCount: 0,
        consentCount: 0,
        updatedAt: now,
      };

      this.usageStore.set(tenantId, usage);
    }

    return usage;
  }

  /**
   * Check if a resource operation is within limits
   */
  async checkLimit(
    tenantId: string,
    resource: MeteredResource,
    count: number = 1
  ): Promise<LimitCheckResult> {
    const usage = await this.getCurrentUsage(tenantId);
    const tier = usage.tier;
    const limits = TIER_LIMITS[tier];

    const limitKey = RESOURCE_TO_LIMIT[resource];
    const usageKey = RESOURCE_TO_USAGE[resource];

    const limit = limits[limitKey] as number;
    const current = usage[usageKey] as number;

    const allowed = !wouldExceedLimit(current, limit, count);
    const percentUsed = calculatePercentUsed(current + count, limit);

    const result: LimitCheckResult = {
      allowed,
      current,
      limit,
      percentUsed,
    };

    if (!allowed) {
      result.reason = `${resource} limit exceeded. Current: ${current}, Limit: ${limit}`;
      result.upgradeUrl = `${this.upgradeBaseUrl}?tenant=${tenantId}&resource=${resource}`;
    }

    return result;
  }

  /**
   * Record usage for a resource
   */
  async recordUsage(
    tenantId: string,
    resource: MeteredResource,
    count: number,
    _metadata?: Record<string, unknown>
  ): Promise<void> {
    const usage = await this.getCurrentUsage(tenantId);
    const usageKey = RESOURCE_TO_USAGE[resource] as keyof TenantUsage;

    // Type-safe increment
    switch (usageKey) {
      case 'dsrCount':
        usage.dsrCount += count;
        break;
      case 'activityCount':
        usage.activityCount += count;
        break;
      case 'piiLocationCount':
        usage.piiLocationCount += count;
        break;
      case 'auditLogCount':
        usage.auditLogCount += count;
        break;
      case 'consentCount':
        usage.consentCount += count;
        break;
    }

    usage.updatedAt = new Date();
    this.usageStore.set(tenantId, usage);
  }

  /**
   * Get usage history (stub - returns current period only)
   */
  async getUsageHistory(
    tenantId: string,
    _periods: number = 6
  ): Promise<UsageHistoryEntry[]> {
    const usage = await this.getCurrentUsage(tenantId);

    return [{
      periodStart: usage.periodStart,
      periodEnd: usage.periodEnd,
      tier: usage.tier,
      usage: {
        dsrs: usage.dsrCount,
        activities: usage.activityCount,
        piiLocations: usage.piiLocationCount,
        auditLogs: usage.auditLogCount,
        consents: usage.consentCount,
      },
    }];
  }

  /**
   * Get tenant's tier
   */
  async getTier(tenantId: string): Promise<UsageTier> {
    return this.tierStore.get(tenantId) ?? 'free';
  }

  /**
   * Set tenant's tier (for testing)
   */
  async setTier(tenantId: string, tier: UsageTier): Promise<void> {
    this.tierStore.set(tenantId, tier);

    // Update usage record if exists
    const usage = this.usageStore.get(tenantId);
    if (usage) {
      usage.tier = tier;
      this.usageStore.set(tenantId, usage);
    }
  }

  /**
   * Check if a feature is available
   */
  async hasFeature(tenantId: string, feature: keyof TierLimits): Promise<boolean> {
    const tier = await this.getTier(tenantId);
    const limits = TIER_LIMITS[tier];
    const value = limits[feature];

    // For boolean features, return the value
    if (typeof value === 'boolean') {
      return value;
    }

    // For numeric features, check if it's > 0 or Infinity
    return value > 0;
  }

  /**
   * Get limits for a tier
   */
  getLimits(tier: UsageTier): TierLimits {
    return TIER_LIMITS[tier];
  }

  /**
   * Reset usage for a tenant (for testing)
   */
  async resetUsage(tenantId: string): Promise<void> {
    this.usageStore.delete(tenantId);
  }
}

/**
 * Omnipii Cloud metering service
 * Tracks usage via the Omnipii Cloud API
 */
export class OmnipiiMeteringService implements MeteringService {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = 'https://api.omnipii.com'
  ) {}

  async getCurrentUsage(tenantId: string): Promise<TenantUsage> {
    const response = await this.apiCall<TenantUsage>('/v1/metering/usage');

    if (response) {
      return response;
    }

    // Return empty usage if API fails
    const now = new Date();
    return {
      tenantId,
      tier: 'free',
      periodStart: new Date(now.getFullYear(), now.getMonth(), 1),
      periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      dsrCount: 0,
      activityCount: 0,
      piiLocationCount: 0,
      auditLogCount: 0,
      consentCount: 0,
      updatedAt: now,
    };
  }

  async checkLimit(
    tenantId: string,
    resource: MeteredResource,
    count: number = 1
  ): Promise<LimitCheckResult> {
    const response = await this.apiCall<LimitCheckResult>('/v1/metering/check', {
      method: 'POST',
      body: { resource, count },
    });

    if (response) {
      return response;
    }

    // Default to allowed if API fails
    return {
      allowed: true,
      current: 0,
      limit: Infinity,
      percentUsed: 0,
    };
  }

  async recordUsage(
    tenantId: string,
    resource: MeteredResource,
    count: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.apiCall('/v1/metering/record', {
      method: 'POST',
      body: { resource, count, metadata },
    });
  }

  async getUsageHistory(
    tenantId: string,
    periods: number = 6
  ): Promise<UsageHistoryEntry[]> {
    const response = await this.apiCall<UsageHistoryEntry[]>(
      `/v1/metering/history?periods=${periods}`
    );
    return response ?? [];
  }

  async getTier(tenantId: string): Promise<UsageTier> {
    const usage = await this.getCurrentUsage(tenantId);
    return usage.tier;
  }

  async hasFeature(tenantId: string, feature: keyof TierLimits): Promise<boolean> {
    const tier = await this.getTier(tenantId);
    const limits = TIER_LIMITS[tier];
    const value = limits[feature];
    return typeof value === 'boolean' ? value : value > 0;
  }

  getLimits(tier: UsageTier): TierLimits {
    return TIER_LIMITS[tier];
  }

  private async apiCall<T>(
    path: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<T | null> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        console.error('[OmnipiiMeteringService] API call failed:', response.statusText);
        return null;
      }

      const data = await response.json();
      return data.data ?? data;
    } catch (err) {
      console.error('[OmnipiiMeteringService] API call error:', err);
      return null;
    }
  }
}

/**
 * Create a metering service instance
 */
export function createMeteringService(
  config?: { apiKey?: string; baseUrl?: string }
): MeteringService {
  if (config?.apiKey) {
    return new OmnipiiMeteringService(config.apiKey, config.baseUrl);
  }
  return new InMemoryMeteringService();
}
