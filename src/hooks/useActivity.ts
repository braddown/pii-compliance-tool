'use client';

import { useState, useEffect, useCallback } from 'react';
import { useComplianceContext } from '../context/ComplianceProvider';
import type {
  RequestActivity,
  ActivityFilters,
  ActivitySummary,
} from '../types/audit-log';

export interface UseActivityOptions {
  /** Filter by DSR request ID */
  dsrRequestId?: string;
  /** Items per page */
  pageSize?: number;
  /** Auto-refresh interval in milliseconds */
  refreshInterval?: number;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

export interface UseActivityReturn {
  /** Activity entries */
  activities: RequestActivity[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Total count */
  total: number;
  /** Current page (0-indexed) */
  page: number;
  /** Whether there are more pages */
  hasMore: boolean;
  /** Go to a specific page */
  setPage: (page: number) => void;
  /** Refresh the data */
  refresh: () => Promise<void>;
  /** Get summary for a specific DSR */
  getSummary: (dsrRequestId: string) => Promise<ActivitySummary>;
}

/**
 * Hook for fetching and displaying request activities
 */
export function useActivity(options: UseActivityOptions = {}): UseActivityReturn {
  const {
    dsrRequestId,
    pageSize = 20,
    refreshInterval,
    onError,
  } = options;

  const { repositories, config } = useComplianceContext();

  const [activities, setActivities] = useState<RequestActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const handleError = useCallback((err: unknown) => {
    const error = err instanceof Error ? err : new Error('Operation failed');
    setError(error);
    onError?.(error);
    config.onError?.(error);
    return error;
  }, [onError, config]);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filters: ActivityFilters = {};
      if (dsrRequestId) {
        filters.dsrRequestId = dsrRequestId;
      }

      const { data, total: totalCount } = await repositories.activity.query({
        ...filters,
        limit: pageSize,
        offset: page * pageSize,
        orderDirection: 'desc',
      });

      setActivities(data);
      setTotal(totalCount);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [repositories.activity, dsrRequestId, page, pageSize, handleError]);

  // Initial fetch and filter/page changes
  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Auto-refresh
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(fetchActivities, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchActivities]);

  const hasMore = (page + 1) * pageSize < total;

  const getSummary = useCallback(async (requestId: string): Promise<ActivitySummary> => {
    return repositories.activity.getSummary(requestId);
  }, [repositories.activity]);

  return {
    activities,
    loading,
    error,
    total,
    page,
    hasMore,
    setPage,
    refresh: fetchActivities,
    getSummary,
  };
}
