'use client';

import React, { createContext, useContext, useMemo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ComplianceConfig, ComplianceFeatures, ComplianceClassNames } from '../types/config';
import { AuditLogRepository } from '../repositories/audit-log-repository';
import { ConsentRecordRepository } from '../repositories/consent-repository';
import { DataSubjectRequestRepository } from '../repositories/dsr-repository';
import { PIILocationRepository } from '../repositories/pii-location-repository';
import { ActionTaskRepository } from '../repositories/action-task-repository';

/**
 * Context value containing config and repositories
 */
interface ComplianceContextValue {
  config: ComplianceConfig;
  repositories: {
    auditLog: AuditLogRepository;
    consent: ConsentRecordRepository;
    dsr: DataSubjectRequestRepository;
    piiLocations: PIILocationRepository;
    actionTasks: ActionTaskRepository;
  };
  features: Required<ComplianceFeatures>;
  apiBasePath: string;
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
 * Provider component that makes compliance context available to child components
 *
 * @example
 * ```tsx
 * import { ComplianceProvider } from '@conversr/compliance';
 *
 * export default function CompliancePage() {
 *   return (
 *     <ComplianceProvider
 *       config={{
 *         supabase: createClient(),
 *         tenantId: 'tenant-123',
 *       }}
 *     >
 *       <ComplianceDashboard />
 *     </ComplianceProvider>
 *   );
 * }
 * ```
 */
export function ComplianceProvider({ config, children }: ComplianceProviderProps) {
  const value = useMemo<ComplianceContextValue>(() => {
    const tablePrefix = config.tablePrefix ?? 'compliance_';
    const repoConfig = { tablePrefix };

    return {
      config,
      repositories: {
        auditLog: new AuditLogRepository(config.supabase, config.tenantId, repoConfig),
        consent: new ConsentRecordRepository(config.supabase, config.tenantId, repoConfig),
        dsr: new DataSubjectRequestRepository(config.supabase, config.tenantId, repoConfig),
        piiLocations: new PIILocationRepository(config.supabase, config.tenantId, repoConfig),
        actionTasks: new ActionTaskRepository(config.supabase, config.tenantId, repoConfig),
      },
      features: {
        ...DEFAULT_FEATURES,
        ...config.features,
      },
      apiBasePath: config.apiBasePath ?? '/api/compliance',
    };
  }, [config]);

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
