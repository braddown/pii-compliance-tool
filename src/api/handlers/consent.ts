import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ConsentRecordRepository } from '../../repositories/consent-repository';
import type { APIHandlerConfig, ResourceHandlers, APIResponse, PaginatedResponse } from '../../types/api';
import type { ConsentRecord, ConsentQueryOptions, CustomerConsentSummary, LegalBasis } from '../../types/consent';

// Query parameter schemas
const QueryParamsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  customerId: z.string().uuid().optional(),
  consentType: z.string().optional(),
  consentGranted: z.coerce.boolean().optional(),
  method: z.string().optional(),
  legalBasis: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  orderBy: z.enum(['createdAt', 'grantedAt', 'revokedAt']).optional().default('createdAt'),
  orderDirection: z.enum(['asc', 'desc']).optional().default('desc'),
});

const GrantConsentSchema = z.object({
  customerId: z.string().uuid(),
  consentType: z.string().min(1),
  method: z.string().default('api'),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  legalBasis: z.enum(['consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests']).optional(),
  retentionDays: z.number().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const RevokeConsentSchema = z.object({
  customerId: z.string().uuid(),
  consentType: z.string().min(1),
  method: z.string().optional(),
  ipAddress: z.string().optional(),
  reason: z.string().optional(),
});

function getSupabaseClient(config: APIHandlerConfig): SupabaseClient {
  return typeof config.supabase === 'function' ? config.supabase() : config.supabase;
}

/**
 * Create handlers for consent endpoints
 */
export function createConsentHandler(config: APIHandlerConfig): ResourceHandlers {
  return {
    /**
     * GET /api/compliance/consent
     * Query consent records with filtering and pagination
     *
     * GET /api/compliance/consent/customer/[customerId]
     * Get consent summary for a specific customer
     *
     * GET /api/compliance/consent/check?customerId=...&consentType=...
     * Check if customer has valid consent
     */
    GET: async (request: NextRequest): Promise<Response> => {
      try {
        const tenantId = await config.getTenantId(request);
        const supabase = getSupabaseClient(config);
        const repo = new ConsentRecordRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });

        const pathname = request.nextUrl.pathname;
        const searchParams = Object.fromEntries(request.nextUrl.searchParams);

        // Check for consent verification endpoint
        if (pathname.endsWith('/check')) {
          const { customerId, consentType } = searchParams;

          if (!customerId || !consentType) {
            return NextResponse.json(
              { success: false, error: 'customerId and consentType are required' },
              { status: 400 }
            );
          }

          const hasConsent = await repo.hasConsent(customerId, consentType);

          return NextResponse.json({
            success: true,
            data: { hasConsent, customerId, consentType },
          });
        }

        // Check for customer summary endpoint
        const customerMatch = pathname.match(/\/customer\/([a-f0-9-]+)$/i);
        if (customerMatch) {
          const customerId = customerMatch[1];
          const summary = await repo.getCustomerConsentSummary(customerId);

          return NextResponse.json({
            success: true,
            data: summary,
          });
        }

        // Default: query consent records
        const params = QueryParamsSchema.safeParse(searchParams);

        if (!params.success) {
          return NextResponse.json(
            { success: false, error: 'Invalid query parameters', details: params.error.flatten() },
            { status: 400 }
          );
        }

        const { limit, offset, orderBy, orderDirection, ...filters } = params.data;

        const queryOptions: ConsentQueryOptions = {
          limit,
          offset,
          orderBy,
          orderDirection,
        };

        if (filters.customerId) queryOptions.customerId = filters.customerId;
        if (filters.consentType) {
          queryOptions.consentType = filters.consentType.split(',');
        }
        if (filters.consentGranted !== undefined) queryOptions.consentGranted = filters.consentGranted;
        if (filters.method) queryOptions.method = filters.method as ConsentRecord['method'];
        if (filters.legalBasis) queryOptions.legalBasis = filters.legalBasis as LegalBasis;
        if (filters.startDate) queryOptions.startDate = filters.startDate;
        if (filters.endDate) queryOptions.endDate = filters.endDate;

        const { data, total } = await repo.query(queryOptions);

        const response: PaginatedResponse<ConsentRecord> = {
          success: true,
          data,
          meta: {
            total,
            limit,
            offset,
            hasMore: offset + data.length < total,
          },
        };

        return NextResponse.json(response);
      } catch (error) {
        console.error('[Consent] GET error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch consent records' },
          { status: 500 }
        );
      }
    },

    /**
     * POST /api/compliance/consent
     * Grant consent (creates an immutable record)
     *
     * POST /api/compliance/consent/revoke
     * Revoke consent
     */
    POST: async (request: NextRequest): Promise<Response> => {
      try {
        const tenantId = await config.getTenantId(request);
        const supabase = getSupabaseClient(config);
        const repo = new ConsentRecordRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });

        const pathname = request.nextUrl.pathname;
        const body = await request.json();

        // Check for revoke endpoint
        if (pathname.endsWith('/revoke')) {
          const parsed = RevokeConsentSchema.safeParse(body);

          if (!parsed.success) {
            return NextResponse.json(
              { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          const ipAddress = parsed.data.ipAddress ||
            request.headers.get('x-forwarded-for')?.split(',')[0] ||
            undefined;

          const record = await repo.revokeConsent({
            ...parsed.data,
            ipAddress,
          });

          // Audit log
          if (config.auditLog) {
            await config.auditLog({
              action: 'consent.revoked',
              resourceType: 'consent_record',
              resourceId: record.id,
              tenantId,
              metadata: {
                customerId: parsed.data.customerId,
                consentType: parsed.data.consentType,
              },
            });
          }

          return NextResponse.json({
            success: true,
            data: record,
            message: 'Consent revoked',
          }, { status: 201 });
        }

        // Default: grant consent
        const parsed = GrantConsentSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const ipAddress = parsed.data.ipAddress ||
          request.headers.get('x-forwarded-for')?.split(',')[0] ||
          undefined;
        const userAgent = parsed.data.userAgent ||
          request.headers.get('user-agent') ||
          undefined;

        const record = await repo.grantConsent({
          ...parsed.data,
          ipAddress,
          userAgent,
        });

        // Audit log
        if (config.auditLog) {
          await config.auditLog({
            action: 'consent.granted',
            resourceType: 'consent_record',
            resourceId: record.id,
            tenantId,
            metadata: {
              customerId: parsed.data.customerId,
              consentType: parsed.data.consentType,
              legalBasis: parsed.data.legalBasis,
            },
          });
        }

        const response: APIResponse<ConsentRecord> = {
          success: true,
          data: record,
          message: 'Consent granted',
        };

        return NextResponse.json(response, { status: 201 });
      } catch (error) {
        console.error('[Consent] POST error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to process consent' },
          { status: 500 }
        );
      }
    },
  };
}
