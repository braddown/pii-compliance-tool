import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuditLogRepository } from '../../repositories/audit-log-repository';
import type { APIHandlerConfig, ResourceHandlers, APIResponse, PaginatedResponse } from '../../types/api';
import type { AuditLog, AuditLogQueryOptions } from '../../types/audit-log';

// Query parameter schemas
const QueryParamsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().uuid().optional(),
  actorType: z.enum(['user', 'system', 'api', 'workflow']).optional(),
  userId: z.string().uuid().optional(),
  gdprRelevant: z.coerce.boolean().optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  search: z.string().optional(),
  orderDirection: z.enum(['asc', 'desc']).optional().default('desc'),
});

const CreateAuditLogSchema = z.object({
  action: z.string().min(1),
  resourceType: z.string().min(1),
  resourceId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  actorType: z.enum(['user', 'system', 'api', 'workflow']).default('api'),
  oldValues: z.record(z.unknown()).optional(),
  newValues: z.record(z.unknown()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Helper to get Supabase client from config
 */
function getSupabaseClient(config: APIHandlerConfig): SupabaseClient {
  return typeof config.supabase === 'function' ? config.supabase() : config.supabase;
}

/**
 * Create handlers for audit log endpoints
 */
export function createAuditLogsHandler(config: APIHandlerConfig): ResourceHandlers {
  return {
    /**
     * GET /api/compliance/audit-logs
     * Query audit logs with filtering and pagination
     */
    GET: async (request: NextRequest): Promise<Response> => {
      try {
        const tenantId = await config.getTenantId(request);
        const supabase = getSupabaseClient(config);
        const repo = new AuditLogRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });

        // Parse query parameters
        const searchParams = Object.fromEntries(request.nextUrl.searchParams);
        const params = QueryParamsSchema.safeParse(searchParams);

        if (!params.success) {
          return NextResponse.json(
            { success: false, error: 'Invalid query parameters', details: params.error.flatten() },
            { status: 400 }
          );
        }

        const { limit, offset, orderDirection, ...filters } = params.data;

        const queryOptions: AuditLogQueryOptions = {
          limit,
          offset,
          orderDirection,
          ...filters,
        };

        const { data, total } = await repo.query(queryOptions);

        const response: PaginatedResponse<AuditLog> = {
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
        console.error('[AuditLogs] GET error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch audit logs' },
          { status: 500 }
        );
      }
    },

    /**
     * POST /api/compliance/audit-logs
     * Create a new audit log entry
     */
    POST: async (request: NextRequest): Promise<Response> => {
      try {
        const tenantId = await config.getTenantId(request);
        const supabase = getSupabaseClient(config);
        const repo = new AuditLogRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });

        const body = await request.json();
        const parsed = CreateAuditLogSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        // Get IP address and user agent from request
        const ipAddress = parsed.data.ipAddress || request.headers.get('x-forwarded-for')?.split(',')[0] || undefined;
        const userAgent = parsed.data.userAgent || request.headers.get('user-agent') || undefined;

        const auditLog = await repo.create({
          ...parsed.data,
          ipAddress,
          userAgent,
        });

        // Call custom audit callback if provided
        if (config.auditLog) {
          await config.auditLog({
            action: 'audit_log.created',
            resourceType: 'audit_log',
            resourceId: auditLog.id,
            tenantId,
          });
        }

        const response: APIResponse<AuditLog> = {
          success: true,
          data: auditLog,
          message: 'Audit log created',
        };

        return NextResponse.json(response, { status: 201 });
      } catch (error) {
        console.error('[AuditLogs] POST error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to create audit log' },
          { status: 500 }
        );
      }
    },
  };
}
