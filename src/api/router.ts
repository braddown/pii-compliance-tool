import { NextRequest, NextResponse } from 'next/server';
import type { APIHandlerConfig, ComplianceRouter, RouteHandler } from '../types/api';
import { createAuditLogsHandler } from './handlers/audit-logs';
import { createGDPRRequestsHandler } from './handlers/gdpr-requests';
import { createConsentHandler } from './handlers/consent';
import { createMetricsHandler } from './handlers/metrics';

/**
 * Create a compliance router that handles all compliance API routes
 *
 * Mount this in your Next.js app:
 *
 * ```typescript
 * // app/api/compliance/[...path]/route.ts
 * import { createComplianceRouter } from '@conversr/compliance/api';
 *
 * const router = createComplianceRouter({
 *   supabase: getSupabaseClient(),
 *   getTenantId: async (req) => session.user.tenantId
 * });
 *
 * export const GET = router.handleRequest;
 * export const POST = router.handleRequest;
 * export const PUT = router.handleRequest;
 * export const PATCH = router.handleRequest;
 * export const DELETE = router.handleRequest;
 * ```
 */
export function createComplianceRouter(config: APIHandlerConfig): ComplianceRouter {
  const handlers = {
    auditLogs: createAuditLogsHandler(config),
    gdprRequests: createGDPRRequestsHandler(config),
    consent: createConsentHandler(config),
    metrics: createMetricsHandler(config),
    reports: {}, // TODO: Implement reports handler
  };

  const handleRequest: RouteHandler = async (request: NextRequest): Promise<Response> => {
    const pathname = request.nextUrl.pathname;
    const method = request.method;

    // Rate limiting (if configured)
    if (config.rateLimiter) {
      const allowed = await config.rateLimiter.check(request);
      if (!allowed) {
        return NextResponse.json(
          { success: false, error: 'Rate limit exceeded' },
          { status: 429 }
        );
      }
    }

    // Route to appropriate handler
    try {
      // Audit logs: /api/compliance/audit-logs
      if (pathname.includes('/audit-logs')) {
        if (!config.enabledEndpoints?.auditLogs === false) {
          return NextResponse.json(
            { success: false, error: 'Audit logs endpoint is disabled' },
            { status: 404 }
          );
        }
        const handler = handlers.auditLogs[method as keyof typeof handlers.auditLogs];
        if (handler) {
          return handler(request);
        }
      }

      // GDPR requests: /api/compliance/gdpr-requests
      if (pathname.includes('/gdpr-requests')) {
        if (config.enabledEndpoints?.gdprRequests === false) {
          return NextResponse.json(
            { success: false, error: 'GDPR requests endpoint is disabled' },
            { status: 404 }
          );
        }
        const handler = handlers.gdprRequests[method as keyof typeof handlers.gdprRequests];
        if (handler) {
          return handler(request);
        }
      }

      // Consent: /api/compliance/consent
      if (pathname.includes('/consent')) {
        if (config.enabledEndpoints?.consent === false) {
          return NextResponse.json(
            { success: false, error: 'Consent endpoint is disabled' },
            { status: 404 }
          );
        }
        const handler = handlers.consent[method as keyof typeof handlers.consent];
        if (handler) {
          return handler(request);
        }
      }

      // Metrics: /api/compliance/metrics
      if (pathname.includes('/metrics')) {
        if (config.enabledEndpoints?.metrics === false) {
          return NextResponse.json(
            { success: false, error: 'Metrics endpoint is disabled' },
            { status: 404 }
          );
        }
        const handler = handlers.metrics[method as keyof typeof handlers.metrics];
        if (handler) {
          return handler(request);
        }
      }

      // Reports: /api/compliance/reports
      if (pathname.includes('/reports')) {
        if (config.enabledEndpoints?.reports === false) {
          return NextResponse.json(
            { success: false, error: 'Reports endpoint is disabled' },
            { status: 404 }
          );
        }
        // TODO: Implement reports handler
        return NextResponse.json(
          { success: false, error: 'Reports endpoint not yet implemented' },
          { status: 501 }
        );
      }

      // No matching route
      return NextResponse.json(
        { success: false, error: 'Not found' },
        { status: 404 }
      );
    } catch (error) {
      console.error('[ComplianceRouter] Unhandled error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  };

  return {
    handleRequest,
    handlers,
  };
}
