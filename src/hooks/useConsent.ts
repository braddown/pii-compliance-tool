'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useComplianceContext } from '../context/ComplianceProvider';
import type {
  ConsentRecord,
  ConsentFilters,
  ConsentQueryOptions,
  CreateConsentInput,
  RevokeConsentInput,
  CustomerConsentSummary,
  ConsentMetrics,
} from '../types/consent';

export interface UseConsentOptions {
  /** Initial filters to apply */
  initialFilters?: ConsentFilters;
  /** Items per page */
  pageSize?: number;
  /** Customer ID to filter by (for customer-specific consent view) */
  customerId?: string;
  /** Include metrics in the response */
  includeMetrics?: boolean;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

export interface UseConsentReturn {
  /** Consent records */
  records: ConsentRecord[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Total count */
  total: number;
  /** Metrics (if includeMetrics is true) */
  metrics: ConsentMetrics | null;
  /** Current filters */
  filters: ConsentFilters;
  /** Current page (0-indexed) */
  page: number;
  /** Whether there are more pages */
  hasMore: boolean;
  /** Update filters */
  setFilters: (filters: ConsentFilters) => void;
  /** Go to a specific page */
  setPage: (page: number) => void;
  /** Refresh the data */
  refresh: () => Promise<void>;
  /** Grant consent */
  grantConsent: (input: CreateConsentInput) => Promise<ConsentRecord>;
  /** Revoke consent */
  revokeConsent: (input: RevokeConsentInput) => Promise<ConsentRecord>;
  /** Check if customer has consent for a type */
  hasConsent: (customerId: string, consentType: string) => Promise<boolean>;
  /** Get consent summary for a customer */
  getCustomerSummary: (customerId: string) => Promise<CustomerConsentSummary>;
}

/**
 * Hook for fetching and managing consent records
 *
 * @example
 * ```tsx
 * // All consent records
 * const { records, grantConsent, revokeConsent } = useConsent();
 *
 * // Customer-specific consent
 * const { records, grantConsent } = useConsent({
 *   customerId: 'customer-123',
 * });
 * ```
 */
export function useConsent(options: UseConsentOptions = {}): UseConsentReturn {
  const {
    pageSize = 50,
    initialFilters = {},
    customerId,
    includeMetrics = false,
    onError,
  } = options;

  const { repositories, config } = useComplianceContext();

  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [metrics, setMetrics] = useState<ConsentMetrics | null>(null);
  const [filters, setFilters] = useState<ConsentFilters>({
    ...initialFilters,
    customerId: customerId ?? initialFilters.customerId,
  });
  const [page, setPage] = useState(0);

  const handleError = useCallback((err: unknown) => {
    const error = err instanceof Error ? err : new Error('Operation failed');
    setError(error);
    onError?.(error);
    config.onError?.(error);
    return error;
  }, [onError, config]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const queryOptions: ConsentQueryOptions = {
        ...filters,
        limit: pageSize,
        offset: page * pageSize,
        orderDirection: 'desc',
      };

      const [recordsResult, metricsResult] = await Promise.all([
        repositories.consent.query(queryOptions),
        includeMetrics ? repositories.consent.getMetrics() : null,
      ]);

      setRecords(recordsResult.data);
      setTotal(recordsResult.total);
      if (metricsResult) {
        setMetrics(metricsResult);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [repositories.consent, filters, page, pageSize, includeMetrics, handleError]);

  // Initial fetch and filter/page changes
  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const hasMore = useMemo(() => {
    return (page + 1) * pageSize < total;
  }, [page, pageSize, total]);

  const grantConsent = useCallback(async (input: CreateConsentInput): Promise<ConsentRecord> => {
    try {
      const record = await repositories.consent.grantConsent(input);
      await fetchRecords(); // Refresh the list
      return record;
    } catch (err) {
      throw handleError(err);
    }
  }, [repositories.consent, fetchRecords, handleError]);

  const revokeConsentFn = useCallback(async (input: RevokeConsentInput): Promise<ConsentRecord> => {
    try {
      const record = await repositories.consent.revokeConsent(input);
      await fetchRecords(); // Refresh the list
      return record;
    } catch (err) {
      throw handleError(err);
    }
  }, [repositories.consent, fetchRecords, handleError]);

  const hasConsentFn = useCallback(async (
    customerId: string,
    consentType: string
  ): Promise<boolean> => {
    return repositories.consent.hasConsent(customerId, consentType);
  }, [repositories.consent]);

  const getCustomerSummary = useCallback(async (
    customerId: string
  ): Promise<CustomerConsentSummary> => {
    return repositories.consent.getCustomerConsentSummary(customerId);
  }, [repositories.consent]);

  const handleSetFilters = useCallback((newFilters: ConsentFilters) => {
    setFilters(newFilters);
    setPage(0);
  }, []);

  return {
    records,
    loading,
    error,
    total,
    metrics,
    filters,
    page,
    hasMore,
    setFilters: handleSetFilters,
    setPage,
    refresh: fetchRecords,
    grantConsent,
    revokeConsent: revokeConsentFn,
    hasConsent: hasConsentFn,
    getCustomerSummary,
  };
}
