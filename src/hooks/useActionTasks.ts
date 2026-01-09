'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useComplianceContext } from '../context/ComplianceProvider';
import type {
  ActionTask,
  ActionTaskQueryOptions,
  ActionTaskSummary,
  CompleteActionTaskInput,
  FailActionTaskInput,
} from '../types/action-task';
import type { GDPRRequestType } from '../types/data-subject-request';

export interface UseActionTasksOptions {
  /** DSR request ID to filter tasks (required for most use cases) */
  dsrRequestId?: string;
  /** Initial filters to apply */
  initialFilters?: Partial<ActionTaskQueryOptions>;
  /** Items per page */
  pageSize?: number;
  /** Auto-refresh interval in milliseconds */
  refreshInterval?: number;
  /** Include summary for the DSR request */
  includeSummary?: boolean;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

export interface UseActionTasksReturn {
  /** Action task data */
  tasks: ActionTask[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Total count */
  total: number;
  /** Summary for the DSR request (if dsrRequestId provided and includeSummary is true) */
  summary: ActionTaskSummary | null;
  /** Current filters */
  filters: Partial<ActionTaskQueryOptions>;
  /** Current page (0-indexed) */
  page: number;
  /** Whether there are more pages */
  hasMore: boolean;
  /** Update filters */
  setFilters: (filters: Partial<ActionTaskQueryOptions>) => void;
  /** Go to a specific page */
  setPage: (page: number) => void;
  /** Refresh the data */
  refresh: () => Promise<void>;
  /** Start a task (mark as in_progress) */
  startTask: (taskId: string, assignedTo?: string) => Promise<ActionTask>;
  /** Complete a task successfully */
  completeTask: (taskId: string, input: CompleteActionTaskInput) => Promise<ActionTask>;
  /** Mark a task as failed */
  failTask: (taskId: string, input: FailActionTaskInput) => Promise<ActionTask>;
  /** Skip a task */
  skipTask: (taskId: string, reason: string) => Promise<ActionTask>;
  /** Block a task */
  blockTask: (taskId: string, reason: string) => Promise<ActionTask>;
  /** Retry a failed task */
  retryTask: (taskId: string) => Promise<ActionTask>;
  /** Verify a completed task */
  verifyTask: (taskId: string, verifiedBy: string, notes?: string) => Promise<ActionTask>;
  /** Initiate action tasks for a DSR request */
  initiateTasksForRequest: (dsrRequestId: string, requestType: GDPRRequestType) => Promise<ActionTask[]>;
  /** Get pending manual tasks */
  getPendingManualTasks: (assignedTo?: string) => Promise<ActionTask[]>;
  /** Get tasks that need retry */
  getTasksNeedingRetry: () => Promise<ActionTask[]>;
}

/**
 * Hook for fetching and managing action tasks for GDPR request execution
 *
 * @example
 * ```tsx
 * const {
 *   tasks,
 *   loading,
 *   summary,
 *   startTask,
 *   completeTask,
 *   failTask,
 * } = useActionTasks({
 *   dsrRequestId: 'request-123',
 *   includeSummary: true,
 * });
 *
 * // Start a task
 * await startTask(task.id);
 *
 * // Complete with result
 * await completeTask(task.id, {
 *   result: { recordsAffected: 5 },
 *   notes: 'Deleted from CRM',
 * });
 * ```
 */
export function useActionTasks(options: UseActionTasksOptions = {}): UseActionTasksReturn {
  const {
    dsrRequestId,
    pageSize = 50,
    initialFilters = {},
    refreshInterval,
    includeSummary = false,
    onError,
  } = options;

  const { repositories, config } = useComplianceContext();

  const [tasks, setTasks] = useState<ActionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<ActionTaskSummary | null>(null);
  const [filters, setFilters] = useState<Partial<ActionTaskQueryOptions>>(initialFilters);
  const [page, setPage] = useState(0);

  const handleError = useCallback((err: unknown) => {
    const error = err instanceof Error ? err : new Error('Operation failed');
    setError(error);
    onError?.(error);
    config.onError?.(error);
    return error;
  }, [onError, config]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const queryOptions: ActionTaskQueryOptions = {
        ...filters,
        dsrRequestId: dsrRequestId ?? filters.dsrRequestId,
        limit: pageSize,
        offset: page * pageSize,
      };

      const [tasksResult, summaryResult] = await Promise.all([
        repositories.actionTasks.query(queryOptions),
        includeSummary && dsrRequestId
          ? repositories.actionTasks.getSummaryForRequest(dsrRequestId)
          : null,
      ]);

      setTasks(tasksResult.data);
      setTotal(tasksResult.total);
      if (summaryResult) {
        setSummary(summaryResult);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [repositories.actionTasks, filters, dsrRequestId, page, pageSize, includeSummary, handleError]);

  // Initial fetch and filter/page changes
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Auto-refresh
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(fetchTasks, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, fetchTasks]);

  const hasMore = useMemo(() => {
    return (page + 1) * pageSize < total;
  }, [page, pageSize, total]);

  const startTask = useCallback(async (taskId: string, assignedTo?: string): Promise<ActionTask> => {
    try {
      const task = await repositories.actionTasks.startTask(taskId, assignedTo);
      await fetchTasks();
      return task;
    } catch (err) {
      throw handleError(err);
    }
  }, [repositories.actionTasks, fetchTasks, handleError]);

  const completeTask = useCallback(async (
    taskId: string,
    input: CompleteActionTaskInput
  ): Promise<ActionTask> => {
    try {
      const task = await repositories.actionTasks.completeTask(taskId, input);
      await fetchTasks();
      return task;
    } catch (err) {
      throw handleError(err);
    }
  }, [repositories.actionTasks, fetchTasks, handleError]);

  const failTask = useCallback(async (
    taskId: string,
    input: FailActionTaskInput
  ): Promise<ActionTask> => {
    try {
      const task = await repositories.actionTasks.failTask(taskId, input);
      await fetchTasks();
      return task;
    } catch (err) {
      throw handleError(err);
    }
  }, [repositories.actionTasks, fetchTasks, handleError]);

  const skipTask = useCallback(async (taskId: string, reason: string): Promise<ActionTask> => {
    try {
      const task = await repositories.actionTasks.skipTask(taskId, reason);
      await fetchTasks();
      return task;
    } catch (err) {
      throw handleError(err);
    }
  }, [repositories.actionTasks, fetchTasks, handleError]);

  const blockTask = useCallback(async (taskId: string, reason: string): Promise<ActionTask> => {
    try {
      const task = await repositories.actionTasks.blockTask(taskId, reason);
      await fetchTasks();
      return task;
    } catch (err) {
      throw handleError(err);
    }
  }, [repositories.actionTasks, fetchTasks, handleError]);

  const retryTask = useCallback(async (taskId: string): Promise<ActionTask> => {
    try {
      const task = await repositories.actionTasks.retryTask(taskId);
      await fetchTasks();
      return task;
    } catch (err) {
      throw handleError(err);
    }
  }, [repositories.actionTasks, fetchTasks, handleError]);

  const verifyTask = useCallback(async (
    taskId: string,
    verifiedBy: string,
    notes?: string
  ): Promise<ActionTask> => {
    try {
      const task = await repositories.actionTasks.verifyTask(taskId, verifiedBy, notes);
      await fetchTasks();
      return task;
    } catch (err) {
      throw handleError(err);
    }
  }, [repositories.actionTasks, fetchTasks, handleError]);

  const initiateTasksForRequest = useCallback(async (
    requestId: string,
    requestType: GDPRRequestType
  ): Promise<ActionTask[]> => {
    try {
      const createdTasks = await repositories.actionTasks.createTasksForRequest(requestId, requestType);
      await fetchTasks();
      return createdTasks;
    } catch (err) {
      throw handleError(err);
    }
  }, [repositories.actionTasks, fetchTasks, handleError]);

  const getPendingManualTasks = useCallback(async (assignedTo?: string): Promise<ActionTask[]> => {
    return repositories.actionTasks.getPendingManualTasks(assignedTo);
  }, [repositories.actionTasks]);

  const getTasksNeedingRetry = useCallback(async (): Promise<ActionTask[]> => {
    return repositories.actionTasks.getTasksNeedingRetry();
  }, [repositories.actionTasks]);

  const handleSetFilters = useCallback((newFilters: Partial<ActionTaskQueryOptions>) => {
    setFilters(newFilters);
    setPage(0);
  }, []);

  return {
    tasks,
    loading,
    error,
    total,
    summary,
    filters,
    page,
    hasMore,
    setFilters: handleSetFilters,
    setPage,
    refresh: fetchTasks,
    startTask,
    completeTask,
    failTask,
    skipTask,
    blockTask,
    retryTask,
    verifyTask,
    initiateTasksForRequest,
    getPendingManualTasks,
    getTasksNeedingRetry,
  };
}
