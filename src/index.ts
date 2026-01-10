// Main entry point for Omnipii
// Privacy compliance toolkit for modern applications
// https://omnipii.com

// Types
export * from './types';

// Database Adapter
export * from './database';

// Repositories
export {
  BaseRepository,
  AuditLogRepository,
  ConsentRecordRepository,
  DataSubjectRequestRepository,
  PIILocationRepository,
  ActionTaskRepository,
} from './repositories';
export { DatabaseError, NotFoundError, ValidationError } from './repositories/base-repository';

// Context and Hooks
export {
  ComplianceProvider,
  useComplianceContext,
  useComplianceConfig,
  useComplianceRepositories,
  useComplianceFeatures,
  useComplianceApiPath,
} from './context/ComplianceProvider';

export {
  useAuditLogs,
  useGDPRRequests,
  useConsent,
  useComplianceMetrics,
  usePIILocations,
  useActionTasks,
} from './hooks';

// API Handlers
export {
  createComplianceRouter,
  createAuditLogsHandler,
  createGDPRRequestsHandler,
  createConsentHandler,
  createMetricsHandler,
  createPIILocationsHandler,
  createActionTasksHandler,
  createPublicRequestHandler,
} from './api';
export type { PublicRequestHandlerConfig } from './api';

// Components (re-export from components/index)
export * from './components';
