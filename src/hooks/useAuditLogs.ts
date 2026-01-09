'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useComplianceContext } from '../context/ComplianceProvider';
import type { AuditLog, AuditLogFilters, AuditLogQueryOptions } from '../types/audit-log';

export interface UseAuditLogsOptions {
  /** Initial filters to apply */
  initialFilters?: AuditLogFilters;
  /** Items per page */
  pageSize?: number;
  /** Auto-refresh interval in milliseconds */
  refreshInterval?: number;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

export interface UseAuditLogsReturn {
  /** Audit log data */
  logs: AuditLog[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Total count */
  total: number;
  /** Current filters */
  filters: AuditLogFilters;
  /** Current page (0-indexed) */
  page: number;
  /** Whether there are more pages */
  hasMore: boolean;
  /** Update filters */
  setFilters: (filters: AuditLogFilters) => void;
  /** Go to a specific page */
  setPage: (page: number) => void;
  /** Refresh the data */
  refresh: () => Promise<void>;
  /** Export logs matching current filters */
  exportLogs: () => Promise<AuditLog[]>;
}

/**
 * Hook for fetching and managing audit logs
 *
 * @example
 * ```tsx
 * const { logs, loading, filters, setFilters } = useAuditLogs({
 *   initialFilters: { gdprRelevant: true },
 *   pageSize: 20,
 * });
 * ```
 */
export function useAuditLogs(options: UseAuditLogsOptions = {}): UseAuditLogsReturn {
  const { pageSize = 50, initialFilters = {}, refreshInterval, onError } = options;
  const { repositories, config } = useComplianceContext();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<AuditLogFilters>(initialFilters);
  const [page, setPage] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const queryOptions: AuditLogQueryOptions = {
        ...filters,
        limit: pageSize,
        offset: page * pageSize,
        orderDirection: 'desc',
      };

      const result = await repositories.auditLog.query(queryOptions);
      setLogs(result.data);
      setTotal(result.total);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch audit logs');
      setError(error);
      onError?.(error);
      config.onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [repositories.auditLog, filters, page, pageSize, onError, config]);

  // Initial fetch and filter/page changes
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(fetchLogs, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchLogs]);

  const hasMore = useMemo(() => {
    return (page + 1) * pageSize < total;
  }, [page, pageSize, total]);

  const exportLogs = useCallback(async (): Promise<AuditLog[]> => {
    return repositories.auditLog.export(filters);
  }, [repositories.auditLog, filters]);

  const handleSetFilters = useCallback((newFilters: AuditLogFilters) => {
    setFilters(newFilters);
    setPage(0); // Reset to first page when filters change
  }, []);

  return {
    logs,
    loading,
    error,
    total,
    filters,
    page,
    hasMore,
    setFilters: handleSetFilters,
    setPage,
    refresh: fetchLogs,
    exportLogs,
  };
}
