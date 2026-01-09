'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useComplianceContext } from '../context/ComplianceProvider';
import type {
  GDPRRequest,
  GDPRRequestFilters,
  GDPRRequestQueryOptions,
  CreateGDPRRequestInput,
  UpdateGDPRRequestInput,
  GDPRRequestMetrics,
} from '../types/gdpr-request';

export interface UseGDPRRequestsOptions {
  /** Initial filters to apply */
  initialFilters?: GDPRRequestFilters;
  /** Items per page */
  pageSize?: number;
  /** Auto-refresh interval in milliseconds */
  refreshInterval?: number;
  /** Include metrics in the response */
  includeMetrics?: boolean;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

export interface UseGDPRRequestsReturn {
  /** GDPR request data */
  requests: GDPRRequest[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Total count */
  total: number;
  /** Metrics (if includeMetrics is true) */
  metrics: GDPRRequestMetrics | null;
  /** Current filters */
  filters: GDPRRequestFilters;
  /** Current page (0-indexed) */
  page: number;
  /** Whether there are more pages */
  hasMore: boolean;
  /** Update filters */
  setFilters: (filters: GDPRRequestFilters) => void;
  /** Go to a specific page */
  setPage: (page: number) => void;
  /** Refresh the data */
  refresh: () => Promise<void>;
  /** Create a new GDPR request */
  createRequest: (input: CreateGDPRRequestInput) => Promise<GDPRRequest>;
  /** Update an existing request */
  updateRequest: (id: string, input: UpdateGDPRRequestInput) => Promise<GDPRRequest>;
  /** Add a note to a request */
  addNote: (id: string, note: string, author: string) => Promise<GDPRRequest>;
  /** Get overdue requests */
  getOverdue: () => Promise<GDPRRequest[]>;
  /** Get requests due soon */
  getDueSoon: () => Promise<GDPRRequest[]>;
}

/**
 * Hook for fetching and managing GDPR requests
 *
 * @example
 * ```tsx
 * const { requests, loading, createRequest, updateRequest } = useGDPRRequests({
 *   initialFilters: { status: ['pending', 'in_progress'] },
 *   includeMetrics: true,
 * });
 * ```
 */
export function useGDPRRequests(options: UseGDPRRequestsOptions = {}): UseGDPRRequestsReturn {
  const {
    pageSize = 50,
    initialFilters = {},
    refreshInterval,
    includeMetrics = false,
    onError,
  } = options;

  const { repositories, config } = useComplianceContext();

  const [requests, setRequests] = useState<GDPRRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [metrics, setMetrics] = useState<GDPRRequestMetrics | null>(null);
  const [filters, setFilters] = useState<GDPRRequestFilters>(initialFilters);
  const [page, setPage] = useState(0);

  const handleError = useCallback((err: unknown) => {
    const error = err instanceof Error ? err : new Error('Operation failed');
    setError(error);
    onError?.(error);
    config.onError?.(error);
    return error;
  }, [onError, config]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const queryOptions: GDPRRequestQueryOptions = {
        ...filters,
        limit: pageSize,
        offset: page * pageSize,
        orderDirection: 'desc',
      };

      const [requestsResult, metricsResult] = await Promise.all([
        repositories.dsr.query(queryOptions),
        includeMetrics ? repositories.dsr.getMetrics() : null,
      ]);

      setRequests(requestsResult.data);
      setTotal(requestsResult.total);
      if (metricsResult) {
        setMetrics(metricsResult);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [repositories.dsr, filters, page, pageSize, includeMetrics, handleError]);

  // Initial fetch and filter/page changes
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Auto-refresh
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(fetchRequests, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchRequests]);

  const hasMore = useMemo(() => {
    return (page + 1) * pageSize < total;
  }, [page, pageSize, total]);

  const createRequest = useCallback(async (input: CreateGDPRRequestInput): Promise<GDPRRequest> => {
    try {
      const request = await repositories.dsr.create(input);
      await fetchRequests(); // Refresh the list
      return request;
    } catch (err) {
      throw handleError(err);
    }
  }, [repositories.dsr, fetchRequests, handleError]);

  const updateRequest = useCallback(async (
    id: string,
    input: UpdateGDPRRequestInput
  ): Promise<GDPRRequest> => {
    try {
      const request = await repositories.dsr.update(id, input);
      await fetchRequests(); // Refresh the list
      return request;
    } catch (err) {
      throw handleError(err);
    }
  }, [repositories.dsr, fetchRequests, handleError]);

  const addNote = useCallback(async (
    id: string,
    note: string,
    author: string
  ): Promise<GDPRRequest> => {
    try {
      const request = await repositories.dsr.addNote(id, note, author);
      await fetchRequests(); // Refresh the list
      return request;
    } catch (err) {
      throw handleError(err);
    }
  }, [repositories.dsr, fetchRequests, handleError]);

  const getOverdue = useCallback(async (): Promise<GDPRRequest[]> => {
    return repositories.dsr.getOverdue();
  }, [repositories.dsr]);

  const getDueSoon = useCallback(async (): Promise<GDPRRequest[]> => {
    return repositories.dsr.getDueSoon();
  }, [repositories.dsr]);

  const handleSetFilters = useCallback((newFilters: GDPRRequestFilters) => {
    setFilters(newFilters);
    setPage(0);
  }, []);

  return {
    requests,
    loading,
    error,
    total,
    metrics,
    filters,
    page,
    hasMore,
    setFilters: handleSetFilters,
    setPage,
    refresh: fetchRequests,
    createRequest,
    updateRequest,
    addNote,
    getOverdue,
    getDueSoon,
  };
}
