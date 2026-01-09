'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useComplianceContext } from '../context/ComplianceProvider';
import type {
  DataSubjectRequest,
  DSRFilters,
  DSRQueryOptions,
  CreateDSRInput,
  UpdateDSRInput,
  DSRMetrics,
} from '../types/data-subject-request';

export interface UseDataSubjectRequestsOptions {
  /** Initial filters to apply */
  initialFilters?: DSRFilters;
  /** Items per page */
  pageSize?: number;
  /** Auto-refresh interval in milliseconds */
  refreshInterval?: number;
  /** Include metrics in the response */
  includeMetrics?: boolean;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

export interface UseDataSubjectRequestsReturn {
  /** Data subject request data */
  requests: DataSubjectRequest[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Total count */
  total: number;
  /** Metrics (if includeMetrics is true) */
  metrics: DSRMetrics | null;
  /** Current filters */
  filters: DSRFilters;
  /** Current page (0-indexed) */
  page: number;
  /** Whether there are more pages */
  hasMore: boolean;
  /** Update filters */
  setFilters: (filters: DSRFilters) => void;
  /** Go to a specific page */
  setPage: (page: number) => void;
  /** Refresh the data */
  refresh: () => Promise<void>;
  /** Create a new data subject request */
  createRequest: (input: CreateDSRInput) => Promise<DataSubjectRequest>;
  /** Update an existing request */
  updateRequest: (id: string, input: UpdateDSRInput) => Promise<DataSubjectRequest>;
  /** Add a note to a request */
  addNote: (id: string, note: string, author: string) => Promise<DataSubjectRequest>;
  /** Get overdue requests */
  getOverdue: () => Promise<DataSubjectRequest[]>;
  /** Get requests due soon */
  getDueSoon: () => Promise<DataSubjectRequest[]>;
}

/**
 * Hook for fetching and managing data subject requests
 *
 * @example
 * ```tsx
 * const { requests, loading, createRequest, updateRequest } = useDataSubjectRequests({
 *   initialFilters: { status: ['pending', 'in_progress'] },
 *   includeMetrics: true,
 * });
 * ```
 */
export function useDataSubjectRequests(options: UseDataSubjectRequestsOptions = {}): UseDataSubjectRequestsReturn {
  const {
    pageSize = 50,
    initialFilters = {},
    refreshInterval,
    includeMetrics = false,
    onError,
  } = options;

  const { repositories, config } = useComplianceContext();

  const [requests, setRequests] = useState<DataSubjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [metrics, setMetrics] = useState<DSRMetrics | null>(null);
  const [filters, setFilters] = useState<DSRFilters>(initialFilters);
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
      // Use API routes if apiBasePath is configured (ensures server-side data consistency)
      if (config.apiBasePath) {
        const queryParams = new URLSearchParams();
        queryParams.set('limit', pageSize.toString());
        queryParams.set('offset', (page * pageSize).toString());
        if (filters.status) {
          const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
          statuses.forEach(s => queryParams.append('status', s));
        }
        if (filters.requestType) {
          const types = Array.isArray(filters.requestType) ? filters.requestType : [filters.requestType];
          types.forEach(t => queryParams.append('requestType', t));
        }

        const [requestsResponse, metricsResponse] = await Promise.all([
          fetch(`${config.apiBasePath}/data-subject-requests?${queryParams}`),
          includeMetrics ? fetch(`${config.apiBasePath}/metrics`) : null,
        ]);

        const requestsData = await requestsResponse.json();
        if (!requestsData.success) {
          throw new Error(requestsData.error || 'Failed to fetch requests');
        }

        setRequests(requestsData.data);
        setTotal(requestsData.total ?? requestsData.data.length);

        if (metricsResponse) {
          const metricsData = await metricsResponse.json();
          if (metricsData.success) {
            setMetrics(metricsData.data?.gdprRequests ?? null);
          }
        }
      } else {
        // Fallback to direct repository access
        const queryOptions: DSRQueryOptions = {
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
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [config.apiBasePath, repositories.dsr, filters, page, pageSize, includeMetrics, handleError]);

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

  const createRequest = useCallback(async (input: CreateDSRInput): Promise<DataSubjectRequest> => {
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
    input: UpdateDSRInput
  ): Promise<DataSubjectRequest> => {
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
  ): Promise<DataSubjectRequest> => {
    try {
      const request = await repositories.dsr.addNote(id, note, author);
      await fetchRequests(); // Refresh the list
      return request;
    } catch (err) {
      throw handleError(err);
    }
  }, [repositories.dsr, fetchRequests, handleError]);

  const getOverdue = useCallback(async (): Promise<DataSubjectRequest[]> => {
    return repositories.dsr.getOverdue();
  }, [repositories.dsr]);

  const getDueSoon = useCallback(async (): Promise<DataSubjectRequest[]> => {
    return repositories.dsr.getDueSoon();
  }, [repositories.dsr]);

  const handleSetFilters = useCallback((newFilters: DSRFilters) => {
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

// =============================================================================
// BACKWARDS COMPATIBILITY ALIASES
// These are deprecated and will be removed in a future version
// =============================================================================

/** @deprecated Use UseDataSubjectRequestsOptions instead */
export type UseGDPRRequestsOptions = UseDataSubjectRequestsOptions;

/** @deprecated Use UseDataSubjectRequestsReturn instead */
export type UseGDPRRequestsReturn = UseDataSubjectRequestsReturn;

/** @deprecated Use useDataSubjectRequests instead */
export const useGDPRRequests = useDataSubjectRequests;
