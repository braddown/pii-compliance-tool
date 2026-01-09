export { createAuditLogsHandler } from './handlers/audit-logs';
export { createGDPRRequestsHandler } from './handlers/gdpr-requests';
export { createConsentHandler } from './handlers/consent';
export { createMetricsHandler } from './handlers/metrics';
export { createComplianceRouter } from './router';
export type { APIHandlerConfig, ComplianceRouter, ResourceHandlers } from '../types/api';
