// Main entry point for @conversr/compliance

// Types
export * from './types';

// Repositories
export {
  BaseRepository,
  AuditLogRepository,
  ConsentRecordRepository,
  DataSubjectRequestRepository,
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
} from './hooks';

// API Handlers
export {
  createComplianceRouter,
  createAuditLogsHandler,
  createGDPRRequestsHandler,
  createConsentHandler,
  createMetricsHandler,
} from './api';

// Components (re-export from components/index)
export * from './components';
