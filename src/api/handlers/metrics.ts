import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuditLogRepository } from '../../repositories/audit-log-repository';
import { ConsentRecordRepository } from '../../repositories/consent-repository';
import { DataSubjectRequestRepository } from '../../repositories/dsr-repository';
import type { APIHandlerConfig, ResourceHandlers, APIResponse } from '../../types/api';
import type { GDPRRequestMetrics } from '../../types/gdpr-request';
import type { ConsentMetrics } from '../../types/consent';

/**
 * Combined compliance metrics
 */
interface ComplianceMetrics {
  gdprRequests: GDPRRequestMetrics;
  consent: ConsentMetrics;
  audit: {
    totalEvents: number;
    todayEvents: number;
    gdprRelevantEvents: number;
    highRiskEvents: number;
  };
  timestamp: Date;
}

function getSupabaseClient(config: APIHandlerConfig): SupabaseClient {
  return typeof config.supabase === 'function' ? config.supabase() : config.supabase;
}

/**
 * Create handlers for compliance metrics endpoints
 */
export function createMetricsHandler(config: APIHandlerConfig): ResourceHandlers {
  return {
    /**
     * GET /api/compliance/metrics
     * Get comprehensive compliance metrics
     *
     * GET /api/compliance/metrics/gdpr
     * Get GDPR request metrics only
     *
     * GET /api/compliance/metrics/consent
     * Get consent metrics only
     *
     * GET /api/compliance/metrics/audit
     * Get audit metrics only
     */
    GET: async (request: NextRequest): Promise<Response> => {
      try {
        const tenantId = await config.getTenantId(request);
        const supabase = getSupabaseClient(config);
        const pathname = request.nextUrl.pathname;

        const auditRepo = new AuditLogRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });
        const consentRepo = new ConsentRecordRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });
        const dsrRepo = new DataSubjectRequestRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });

        // GDPR metrics only
        if (pathname.endsWith('/gdpr')) {
          const metrics = await dsrRepo.getMetrics();
          return NextResponse.json({
            success: true,
            data: metrics,
          });
        }

        // Consent metrics only
        if (pathname.endsWith('/consent')) {
          const metrics = await consentRepo.getMetrics();
          return NextResponse.json({
            success: true,
            data: metrics,
          });
        }

        // Audit metrics only
        if (pathname.endsWith('/audit')) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const [totalResult, todayResult, gdprResult, highRiskResult] = await Promise.all([
            auditRepo.count({}),
            auditRepo.count({ startDate: today }),
            auditRepo.count({ gdprRelevant: true }),
            auditRepo.count({ riskLevel: 'high' }),
          ]);

          return NextResponse.json({
            success: true,
            data: {
              totalEvents: totalResult,
              todayEvents: todayResult,
              gdprRelevantEvents: gdprResult,
              highRiskEvents: highRiskResult,
            },
          });
        }

        // Full metrics
        const [gdprMetrics, consentMetrics] = await Promise.all([
          dsrRepo.getMetrics(),
          consentRepo.getMetrics(),
        ]);

        // Audit counts
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [totalEvents, todayEvents, gdprRelevantEvents, highRiskEvents] = await Promise.all([
          auditRepo.count({}),
          auditRepo.count({ startDate: today }),
          auditRepo.count({ gdprRelevant: true }),
          auditRepo.count({ riskLevel: 'high' }),
        ]);

        const metrics: ComplianceMetrics = {
          gdprRequests: gdprMetrics,
          consent: consentMetrics,
          audit: {
            totalEvents,
            todayEvents,
            gdprRelevantEvents,
            highRiskEvents,
          },
          timestamp: new Date(),
        };

        const response: APIResponse<ComplianceMetrics> = {
          success: true,
          data: metrics,
        };

        return NextResponse.json(response);
      } catch (error) {
        console.error('[Metrics] GET error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch compliance metrics' },
          { status: 500 }
        );
      }
    },
  };
}
