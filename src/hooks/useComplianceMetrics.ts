'use client';

import { useState, useEffect, useCallback } from 'react';
import { useComplianceContext } from '../context/ComplianceProvider';
import type { GDPRRequestMetrics } from '../types/data-subject-request';
import type { ConsentMetrics } from '../types/consent';

export interface AuditMetrics {
  totalEvents: number;
  todayEvents: number;
  gdprRelevantEvents: number;
  highRiskEvents: number;
}

export interface ComplianceMetrics {
  gdprRequests: GDPRRequestMetrics;
  consent: ConsentMetrics;
  audit: AuditMetrics;
  timestamp: Date;
}

export interface UseComplianceMetricsOptions {
  /** Auto-refresh interval in milliseconds */
  refreshInterval?: number;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

export interface UseComplianceMetricsReturn {
  /** Compliance metrics */
  metrics: ComplianceMetrics | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Refresh metrics */
  refresh: () => Promise<void>;
  /** Get just GDPR metrics */
  gdprMetrics: GDPRRequestMetrics | null;
  /** Get just consent metrics */
  consentMetrics: ConsentMetrics | null;
  /** Get just audit metrics */
  auditMetrics: AuditMetrics | null;
}

/**
 * Hook for fetching compliance metrics
 *
 * @example
 * ```tsx
 * const { metrics, loading, refresh } = useComplianceMetrics({
 *   refreshInterval: 60000, // Refresh every minute
 * });
 *
 * if (metrics) {
 *   console.log('GDPR compliance rate:', metrics.gdprRequests.complianceRate);
 *   console.log('Consent rate:', metrics.consent.consentRate);
 * }
 * ```
 */
export function useComplianceMetrics(
  options: UseComplianceMetricsOptions = {}
): UseComplianceMetricsReturn {
  const { refreshInterval, onError } = options;
  const { repositories, config } = useComplianceContext();

  const [metrics, setMetrics] = useState<ComplianceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const handleError = useCallback((err: unknown) => {
    const error = err instanceof Error ? err : new Error('Failed to fetch metrics');
    setError(error);
    onError?.(error);
    config.onError?.(error);
  }, [onError, config]);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [gdprMetrics, consentMetrics, totalEvents, todayEvents, gdprRelevantEvents, highRiskEvents] =
        await Promise.all([
          repositories.dsr.getMetrics(),
          repositories.consent.getMetrics(),
          repositories.auditLog.count({}),
          repositories.auditLog.count({ startDate: today }),
          repositories.auditLog.count({ gdprRelevant: true }),
          repositories.auditLog.count({ riskLevel: 'high' }),
        ]);

      setMetrics({
        gdprRequests: gdprMetrics,
        consent: consentMetrics,
        audit: {
          totalEvents,
          todayEvents,
          gdprRelevantEvents,
          highRiskEvents,
        },
        timestamp: new Date(),
      });
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [repositories, handleError]);

  // Initial fetch
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Auto-refresh
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchMetrics]);

  return {
    metrics,
    loading,
    error,
    refresh: fetchMetrics,
    gdprMetrics: metrics?.gdprRequests ?? null,
    consentMetrics: metrics?.consent ?? null,
    auditMetrics: metrics?.audit ?? null,
  };
}
