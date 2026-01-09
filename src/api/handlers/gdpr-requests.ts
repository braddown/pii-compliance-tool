import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DataSubjectRequestRepository } from '../../repositories/dsr-repository';
import type { APIHandlerConfig, ResourceHandlers, APIResponse, PaginatedResponse } from '../../types/api';
import type { GDPRRequest, GDPRRequestQueryOptions } from '../../types/gdpr-request';

// Query parameter schemas
const QueryParamsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  status: z.string().optional(),
  requestType: z.string().optional(),
  priority: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  overdue: z.coerce.boolean().optional(),
  dueSoon: z.coerce.boolean().optional(),
  search: z.string().optional(),
  orderBy: z.enum(['createdAt', 'dueDate', 'priority', 'status']).optional().default('createdAt'),
  orderDirection: z.enum(['asc', 'desc']).optional().default('desc'),
});

const CreateRequestSchema = z.object({
  customerId: z.string().uuid().optional(),
  requestType: z.enum(['access', 'rectification', 'erasure', 'restriction', 'portability', 'objection']),
  requesterEmail: z.string().email(),
  requesterPhone: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateRequestSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'review', 'completed', 'rejected', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  verificationMethod: z.enum(['email', 'phone', 'in_person', 'verified_id', 'two_factor']).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

function getSupabaseClient(config: APIHandlerConfig): SupabaseClient {
  return typeof config.supabase === 'function' ? config.supabase() : config.supabase;
}

/**
 * Create handlers for GDPR request endpoints
 */
export function createGDPRRequestsHandler(config: APIHandlerConfig): ResourceHandlers {
  return {
    /**
     * GET /api/compliance/gdpr-requests
     * Query GDPR requests with filtering and pagination
     */
    GET: async (request: NextRequest): Promise<Response> => {
      try {
        const tenantId = await config.getTenantId(request);
        const supabase = getSupabaseClient(config);
        const repo = new DataSubjectRequestRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });

        // Check if requesting a specific ID
        const pathParts = request.nextUrl.pathname.split('/');
        const requestId = pathParts[pathParts.length - 1];

        if (requestId && requestId !== 'gdpr-requests' && z.string().uuid().safeParse(requestId).success) {
          // Get single request
          const gdprRequest = await repo.findById(requestId);

          if (!gdprRequest) {
            return NextResponse.json(
              { success: false, error: 'GDPR request not found' },
              { status: 404 }
            );
          }

          return NextResponse.json({ success: true, data: gdprRequest });
        }

        // Parse query parameters
        const searchParams = Object.fromEntries(request.nextUrl.searchParams);
        const params = QueryParamsSchema.safeParse(searchParams);

        if (!params.success) {
          return NextResponse.json(
            { success: false, error: 'Invalid query parameters', details: params.error.flatten() },
            { status: 400 }
          );
        }

        const { limit, offset, orderBy, orderDirection, ...filters } = params.data;

        // Parse array filters
        const queryOptions: GDPRRequestQueryOptions = {
          limit,
          offset,
          orderBy,
          orderDirection,
        };

        if (filters.status) {
          queryOptions.status = filters.status.split(',') as GDPRRequest['status'][];
        }
        if (filters.requestType) {
          queryOptions.requestType = filters.requestType.split(',') as GDPRRequest['requestType'][];
        }
        if (filters.priority) {
          queryOptions.priority = filters.priority.split(',') as GDPRRequest['priority'][];
        }
        if (filters.assignedTo) queryOptions.assignedTo = filters.assignedTo;
        if (filters.customerId) queryOptions.customerId = filters.customerId;
        if (filters.overdue) queryOptions.overdue = filters.overdue;
        if (filters.dueSoon) queryOptions.dueSoon = filters.dueSoon;
        if (filters.search) queryOptions.search = filters.search;

        const { data, total } = await repo.query(queryOptions);

        const response: PaginatedResponse<GDPRRequest> = {
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
        console.error('[GDPRRequests] GET error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch GDPR requests' },
          { status: 500 }
        );
      }
    },

    /**
     * POST /api/compliance/gdpr-requests
     * Create a new GDPR request
     */
    POST: async (request: NextRequest): Promise<Response> => {
      try {
        const tenantId = await config.getTenantId(request);
        const supabase = getSupabaseClient(config);
        const repo = new DataSubjectRequestRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });

        const body = await request.json();
        const parsed = CreateRequestSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const gdprRequest = await repo.create(parsed.data);

        // Audit log
        if (config.auditLog) {
          await config.auditLog({
            action: 'gdpr_request.created',
            resourceType: 'gdpr_request',
            resourceId: gdprRequest.id,
            tenantId,
            metadata: { requestType: gdprRequest.requestType },
          });
        }

        const response: APIResponse<GDPRRequest> = {
          success: true,
          data: gdprRequest,
          message: 'GDPR request created',
        };

        return NextResponse.json(response, { status: 201 });
      } catch (error) {
        console.error('[GDPRRequests] POST error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to create GDPR request' },
          { status: 500 }
        );
      }
    },

    /**
     * PUT /api/compliance/gdpr-requests/[id]
     * Update a GDPR request
     */
    PUT: async (request: NextRequest): Promise<Response> => {
      try {
        const tenantId = await config.getTenantId(request);
        const supabase = getSupabaseClient(config);
        const repo = new DataSubjectRequestRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });

        // Extract ID from path
        const pathParts = request.nextUrl.pathname.split('/');
        const requestId = pathParts[pathParts.length - 1];

        if (!requestId || !z.string().uuid().safeParse(requestId).success) {
          return NextResponse.json(
            { success: false, error: 'Invalid request ID' },
            { status: 400 }
          );
        }

        const body = await request.json();
        const parsed = UpdateRequestSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const gdprRequest = await repo.update(requestId, parsed.data);

        // Audit log
        if (config.auditLog) {
          await config.auditLog({
            action: 'gdpr_request.updated',
            resourceType: 'gdpr_request',
            resourceId: gdprRequest.id,
            tenantId,
            metadata: { status: gdprRequest.status },
          });
        }

        const response: APIResponse<GDPRRequest> = {
          success: true,
          data: gdprRequest,
          message: 'GDPR request updated',
        };

        return NextResponse.json(response);
      } catch (error) {
        console.error('[GDPRRequests] PUT error:', error);
        if ((error as Error).name === 'NotFoundError') {
          return NextResponse.json(
            { success: false, error: 'GDPR request not found' },
            { status: 404 }
          );
        }
        return NextResponse.json(
          { success: false, error: 'Failed to update GDPR request' },
          { status: 500 }
        );
      }
    },

    /**
     * PATCH - alias for PUT
     */
    PATCH: async (request: NextRequest): Promise<Response> => {
      return createGDPRRequestsHandler(config).PUT!(request);
    },
  };
}
