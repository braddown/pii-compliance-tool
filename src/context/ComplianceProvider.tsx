'use client';

import React, { createContext, useContext, useMemo, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ComplianceConfig, ComplianceFeatures, ComplianceClassNames } from '../types/config';
import { ActivityRepository } from '../repositories/activity-repository';
import { AuditLogRepository } from '../repositories/audit-log-repository';
import { ConsentRecordRepository } from '../repositories/consent-repository';
import { DataSubjectRequestRepository } from '../repositories/dsr-repository';
import { PIILocationRepository } from '../repositories/pii-location-repository';
import { ActionTaskRepository } from '../repositories/action-task-repository';
import type { ActivityLogger } from '../repositories/base-repository';
import {
  createAdapter,
  createAdapterFromSupabaseClient,
  parseOmnipiiApiKey,
} from '../database';
import type { DatabaseAdapter } from '../database/types';

/**
 * Context value containing config and repositories
 */
interface ComplianceContextValue {
  config: ComplianceConfig;
  adapter?: DatabaseAdapter;
  repositories: {
    activity: ActivityRepository;
    auditLog: AuditLogRepository;
    consent: ConsentRecordRepository;
    dsr: DataSubjectRequestRepository;
    piiLocations: PIILocationRepository;
    actionTasks: ActionTaskRepository;
  };
  features: Required<ComplianceFeatures>;
  apiBasePath: string;
  databaseType: 'omnipii' | 'supabase' | 'postgresql' | 'mysql' | 'legacy';
  isReady: boolean;
}

const ComplianceContext = createContext<ComplianceContextValue | null>(null);

/**
 * Props for ComplianceProvider
 */
export interface ComplianceProviderProps {
  config: ComplianceConfig;
  children: React.ReactNode;
}

/**
 * Default features
 */
const DEFAULT_FEATURES: Required<ComplianceFeatures> = {
  auditLogs: true,
  gdprRequests: true,
  consentManagement: true,
  reports: true,
  privacyDashboard: true,
};

/**
 * Determine tenant ID from config
 */
function getTenantId(config: ComplianceConfig): string {
  // If tenantId is provided, use it
  if (config.tenantId) {
    return config.tenantId;
  }

  // For Omnipii, extract from API key
  if (config.database?.type === 'omnipii') {
    const parsed = parseOmnipiiApiKey(config.database.config.apiKey);
    if (parsed.tenantId) {
      return parsed.tenantId;
    }
  }

  throw new Error('tenantId is required unless using Omnipii Cloud with API key');
}

/**
 * Get Supabase client from config (for legacy support)
 */
function getSupabaseClient(config: ComplianceConfig): SupabaseClient | null {
  if (config.supabase) {
    return config.supabase;
  }
  return null;
}

/**
 * Provider component that makes compliance context available to child components
 *
 * @example Using Omnipii Cloud (recommended)
 * ```tsx
 * import { ComplianceProvider } from 'omnipii';
 *
 * export default function CompliancePage() {
 *   return (
 *     <ComplianceProvider
 *       config={{
 *         database: {
 *           type: 'omnipii',
 *           config: { apiKey: process.env.OMNIPII_API_KEY! },
 *         },
 *       }}
 *     >
 *       <ComplianceDashboard />
 *     </ComplianceProvider>
 *   );
 * }
 * ```
 *
 * @example Using Supabase (self-hosted)
 * ```tsx
 * <ComplianceProvider
 *   config={{
 *     database: {
 *       type: 'supabase',
 *       config: {
 *         url: process.env.SUPABASE_URL!,
 *         anonKey: process.env.SUPABASE_ANON_KEY!,
 *       },
 *     },
 *     tenantId: 'tenant-123',
 *   }}
 * >
 * ```
 *
 * @example Legacy Supabase client (deprecated)
 * ```tsx
 * <ComplianceProvider
 *   config={{
 *     supabase: createClient(),
 *     tenantId: 'tenant-123',
 *   }}
 * >
 * ```
 */
export function ComplianceProvider({ config, children }: ComplianceProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [adapter, setAdapter] = useState<DatabaseAdapter | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);

  // Determine database type
  const databaseType = useMemo(() => {
    if (config.database) {
      return config.database.type;
    }
    if (config.supabase) {
      return 'legacy' as const;
    }
    throw new Error('Either database or supabase config is required');
  }, [config.database, config.supabase]);

  // Initialize adapter (async for new database config)
  useEffect(() => {
    let cancelled = false;

    async function initAdapter() {
      try {
        if (config.database) {
          // New adapter pattern
          const result = await createAdapter(config.database, {
            tablePrefix: config.tablePrefix,
          });
          if (!cancelled) {
            setAdapter(result.adapter);
            setIsReady(true);
          }
        } else if (config.supabase) {
          // Legacy Supabase client
          const legacyAdapter = createAdapterFromSupabaseClient(config.supabase, {
            tablePrefix: config.tablePrefix,
          });
          if (!cancelled) {
            setAdapter(legacyAdapter);
            setIsReady(true);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          config.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }

    initAdapter();

    return () => {
      cancelled = true;
    };
  }, [config]);

  const value = useMemo<ComplianceContextValue>(() => {
    // Get Supabase client (required for repositories for now)
    const supabase = getSupabaseClient(config);
    const tenantId = getTenantId(config);
    const tablePrefix = config.tablePrefix ?? 'compliance_';

    // For non-legacy configs without supabase, we need to create a mock
    // or update repositories to use adapter. For now, throw if no supabase.
    if (!supabase) {
      throw new Error(
        'Supabase client required. For Omnipii Cloud, use the adapter directly via API routes.'
      );
    }

    const repoConfig = { tablePrefix, adapter };

    // Create activity repository first as other repos will use it for logging
    const activityRepo = new ActivityRepository(supabase, tenantId, repoConfig);

    // Create activity logger callback that other repositories will use
    const activityLogger: ActivityLogger = async (input) => {
      await activityRepo.log({
        dsrRequestId: input.dsrRequestId,
        actionTaskId: input.actionTaskId,
        piiLocationName: input.piiLocationName,
        activityType: input.activityType as Parameters<typeof activityRepo.log>[0]['activityType'],
        description: input.description,
        actorType: input.actorType,
        actorId: input.actorId,
        actorName: input.actorName,
        previousStatus: input.previousStatus,
        newStatus: input.newStatus,
        details: input.details,
      });
    };

    // Config for repositories that need activity logging
    const repoConfigWithLogging = { tablePrefix, activityLogger, adapter };

    return {
      config,
      adapter,
      repositories: {
        activity: activityRepo,
        auditLog: new AuditLogRepository(supabase, tenantId, repoConfig),
        consent: new ConsentRecordRepository(supabase, tenantId, repoConfig),
        dsr: new DataSubjectRequestRepository(supabase, tenantId, repoConfigWithLogging),
        piiLocations: new PIILocationRepository(supabase, tenantId, repoConfig),
        actionTasks: new ActionTaskRepository(supabase, tenantId, repoConfigWithLogging),
      },
      features: {
        ...DEFAULT_FEATURES,
        ...config.features,
      },
      apiBasePath: config.apiBasePath ?? '/api/compliance',
      databaseType,
      isReady,
    };
  }, [config, adapter, databaseType, isReady]);

  // Show error if initialization failed
  if (error) {
    return (
      <div style={{ color: 'red', padding: '1rem' }}>
        <strong>Omnipii Error:</strong> {error.message}
      </div>
    );
  }

  // Show loading state while initializing
  if (!isReady && config.database) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        Initializing Omnipii...
      </div>
    );
  }

  return (
    <ComplianceContext.Provider value={value}>
      {children}
    </ComplianceContext.Provider>
  );
}

/**
 * Hook to access the compliance context
 *
 * @throws Error if used outside of ComplianceProvider
 */
export function useComplianceContext(): ComplianceContextValue {
  const context = useContext(ComplianceContext);

  if (!context) {
    throw new Error(
      'useComplianceContext must be used within a ComplianceProvider. ' +
      'Wrap your component tree with <ComplianceProvider config={...}>.'
    );
  }

  return context;
}

/**
 * Hook to access the compliance config
 */
export function useComplianceConfig(): ComplianceConfig {
  return useComplianceContext().config;
}

/**
 * Hook to access compliance repositories
 */
export function useComplianceRepositories() {
  return useComplianceContext().repositories;
}

/**
 * Hook to access enabled features
 */
export function useComplianceFeatures(): Required<ComplianceFeatures> {
  return useComplianceContext().features;
}

/**
 * Hook to get the API base path
 */
export function useComplianceApiPath(): string {
  return useComplianceContext().apiBasePath;
}

export { ComplianceContext };
