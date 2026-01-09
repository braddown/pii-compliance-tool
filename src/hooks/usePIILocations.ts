'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useComplianceContext } from '../context/ComplianceProvider';
import type {
  PIILocation,
  PIILocationQueryOptions,
  CreatePIILocationInput,
  UpdatePIILocationInput,
  PIILocationSummary,
  PIISystemType,
  PIIExecutionType,
} from '../types/pii-location';
import type { GDPRRequestType } from '../types/data-subject-request';

export interface UsePIILocationsOptions {
  /** Initial filters to apply */
  initialFilters?: Partial<PIILocationQueryOptions>;
  /** Items per page */
  pageSize?: number;
  /** Auto-refresh interval in milliseconds */
  refreshInterval?: number;
  /** Include summary statistics */
  includeSummary?: boolean;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

export interface UsePIILocationsReturn {
  /** PII location data */
  locations: PIILocation[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Total count */
  total: number;
  /** Summary statistics (if includeSummary is true) */
  summary: PIILocationSummary | null;
  /** Current filters */
  filters: Partial<PIILocationQueryOptions>;
  /** Current page (0-indexed) */
  page: number;
  /** Whether there are more pages */
  hasMore: boolean;
  /** Update filters */
  setFilters: (filters: Partial<PIILocationQueryOptions>) => void;
  /** Go to a specific page */
  setPage: (page: number) => void;
  /** Refresh the data */
  refresh: () => Promise<void>;
  /** Create a new PII location */
  createLocation: (input: CreatePIILocationInput) => Promise<PIILocation>;
  /** Update an existing location */
  updateLocation: (id: string, input: UpdatePIILocationInput) => Promise<PIILocation>;
  /** Delete (deactivate) a location */
  deleteLocation: (id: string) => Promise<void>;
  /** Mark location as verified */
  verifyLocation: (id: string) => Promise<PIILocation>;
  /** Get locations for a specific request type */
  getForRequestType: (type: GDPRRequestType) => Promise<PIILocation[]>;
  /** Get locations by system type */
  getBySystemType: (type: PIISystemType) => Promise<PIILocation[]>;
  /** Get locations by execution type */
  getByExecutionType: (type: PIIExecutionType) => Promise<PIILocation[]>;
}

/**
 * Hook for fetching and managing PII data locations
 *
 * @example
 * ```tsx
 * const { locations, loading, createLocation, updateLocation } = usePIILocations({
 *   initialFilters: { isActive: true, systemType: ['database', 'api'] },
 *   includeSummary: true,
 * });
 * ```
 */
export function usePIILocations(options: UsePIILocationsOptions = {}): UsePIILocationsReturn {
  const {
    pageSize = 50,
    initialFilters = {},
    refreshInterval,
    includeSummary = false,
    onError,
  } = options;

  const { repositories, config } = useComplianceContext();

  const [locations, setLocations] = useState<PIILocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<PIILocationSummary | null>(null);
  const [filters, setFilters] = useState<Partial<PIILocationQueryOptions>>(initialFilters);
  const [page, setPage] = useState(0);

  const handleError = useCallback((err: unknown) => {
    const error = err instanceof Error ? err : new Error('Operation failed');
    setError(error);
    onError?.(error);
    config.onError?.(error);
    return error;
  }, [onError, config]);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const queryOptions: PIILocationQueryOptions = {
        ...filters,
        limit: pageSize,
        offset: page * pageSize,
      };

      const [locationsResult, summaryResult] = await Promise.all([
        repositories.piiLocations.query(queryOptions),
        includeSummary ? repositories.piiLocations.getSummary() : null,
      ]);

      setLocations(locationsResult.data);
      setTotal(locationsResult.total);
      if (summaryResult) {
        setSummary(summaryResult);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [repositories.piiLocations, filters, page, pageSize, includeSummary, handleError]);

  // Initial fetch and filter/page changes
  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Auto-refresh
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(fetchLocations, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchLocations]);

  const hasMore = useMemo(() => {
    return (page + 1) * pageSize < total;
  }, [page, pageSize, total]);

  const createLocation = useCallback(async (input: CreatePIILocationInput): Promise<PIILocation> => {
    try {
      const location = await repositories.piiLocations.create(input);
      await fetchLocations();
      return location;
    } catch (err) {
      throw handleError(err);
    }
  }, [repositories.piiLocations, fetchLocations, handleError]);

  const updateLocation = useCallback(async (
    id: string,
    input: UpdatePIILocationInput
  ): Promise<PIILocation> => {
    try {
      const location = await repositories.piiLocations.update(id, input);
      await fetchLocations();
      return location;
    } catch (err) {
      throw handleError(err);
    }
  }, [repositories.piiLocations, fetchLocations, handleError]);

  const deleteLocation = useCallback(async (id: string): Promise<void> => {
    try {
      await repositories.piiLocations.delete(id);
      await fetchLocations();
    } catch (err) {
      throw handleError(err);
    }
  }, [repositories.piiLocations, fetchLocations, handleError]);

  const verifyLocation = useCallback(async (id: string): Promise<PIILocation> => {
    try {
      const location = await repositories.piiLocations.markVerified(id);
      await fetchLocations();
      return location;
    } catch (err) {
      throw handleError(err);
    }
  }, [repositories.piiLocations, fetchLocations, handleError]);

  const getForRequestType = useCallback(async (type: GDPRRequestType): Promise<PIILocation[]> => {
    return repositories.piiLocations.getForRequestType(type);
  }, [repositories.piiLocations]);

  const getBySystemType = useCallback(async (type: PIISystemType): Promise<PIILocation[]> => {
    return repositories.piiLocations.getBySystemType(type);
  }, [repositories.piiLocations]);

  const getByExecutionType = useCallback(async (type: PIIExecutionType): Promise<PIILocation[]> => {
    return repositories.piiLocations.getByExecutionType(type);
  }, [repositories.piiLocations]);

  const handleSetFilters = useCallback((newFilters: Partial<PIILocationQueryOptions>) => {
    setFilters(newFilters);
    setPage(0);
  }, []);

  return {
    locations,
    loading,
    error,
    total,
    summary,
    filters,
    page,
    hasMore,
    setFilters: handleSetFilters,
    setPage,
    refresh: fetchLocations,
    createLocation,
    updateLocation,
    deleteLocation,
    verifyLocation,
    getForRequestType,
    getBySystemType,
    getByExecutionType,
  };
}
