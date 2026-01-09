import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PIILocationRepository } from '../../repositories/pii-location-repository';
import type { APIHandlerConfig, ResourceHandlers, APIResponse, PaginatedResponse } from '../../types/api';
import type { PIILocation, PIILocationQueryOptions } from '../../types/pii-location';

// Query parameter schemas
const QueryParamsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  systemType: z.string().optional(),
  executionType: z.string().optional(),
  supportedRequestType: z.enum(['access', 'rectification', 'erasure', 'restriction', 'portability', 'objection']).optional(),
  isActive: z.coerce.boolean().optional(),
  ownerTeam: z.string().optional(),
  search: z.string().optional(),
  orderBy: z.enum(['name', 'priorityOrder', 'createdAt', 'updatedAt']).optional().default('priorityOrder'),
  orderDirection: z.enum(['asc', 'desc']).optional().default('asc'),
});

// Manual instruction schema
const ManualInstructionSchema = z.object({
  step: z.number(),
  title: z.string(),
  description: z.string(),
  screenshotUrl: z.string().optional(),
  warning: z.string().optional(),
  expectedResult: z.string().optional(),
});

// Automated action config schema
const AutomatedActionConfigSchema = z.object({
  endpoint: z.object({
    url: z.string().url(),
    method: z.enum(['DELETE', 'POST', 'PUT', 'PATCH', 'GET']),
    headers: z.record(z.string()).optional(),
    authType: z.enum(['bearer', 'api_key', 'oauth2', 'basic', 'none']),
    authConfig: z.object({
      headerName: z.string().optional(),
      secretRef: z.string().optional(),
      oauth2: z.object({
        tokenUrl: z.string(),
        clientIdRef: z.string(),
        clientSecretRef: z.string(),
        scope: z.string().optional(),
      }).optional(),
      basicAuth: z.object({
        usernameRef: z.string(),
        passwordRef: z.string(),
      }).optional(),
    }).optional(),
    timeout: z.number().optional(),
    retryPolicy: z.object({
      maxRetries: z.number(),
      backoffMultiplier: z.number(),
      initialDelayMs: z.number().optional(),
    }).optional(),
  }),
  requestBody: z.object({
    template: z.record(z.unknown()),
    placeholders: z.array(z.string()),
  }).optional(),
  successCondition: z.object({
    httpStatus: z.array(z.number()),
    responseBodyMatch: z.object({
      path: z.string(),
      value: z.union([z.string(), z.boolean(), z.number()]),
    }).optional(),
  }).optional(),
  webhook: z.object({
    enabled: z.boolean(),
    callbackPath: z.string(),
    expectedWithin: z.number(),
    secretRef: z.string().optional(),
  }).optional(),
});

// Manual action config schema
const ManualActionConfigSchema = z.object({
  instructions: z.array(ManualInstructionSchema),
  estimatedMinutes: z.number().optional(),
  requiredRole: z.string().optional(),
  documentationUrl: z.string().optional(),
  verificationChecklist: z.array(z.string()).optional(),
});

// Action config is either automated or manual
const ActionConfigSchema = z.union([AutomatedActionConfigSchema, ManualActionConfigSchema]);

const CreateLocationSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  systemType: z.enum(['database', 'api', 'manual', 'file_storage', 'third_party']),
  executionType: z.enum(['automated', 'semi_automated', 'manual']),
  supportedRequestTypes: z.array(z.enum(['access', 'rectification', 'erasure', 'restriction', 'portability', 'objection'])).optional(),
  priorityOrder: z.number().min(1).max(1000).optional(),
  actionConfig: ActionConfigSchema,
  ownerEmail: z.string().email().optional(),
  ownerTeam: z.string().optional(),
  piiFields: z.array(z.string()).optional(),
  dataCategories: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateLocationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  executionType: z.enum(['automated', 'semi_automated', 'manual']).optional(),
  supportedRequestTypes: z.array(z.enum(['access', 'rectification', 'erasure', 'restriction', 'portability', 'objection'])).optional(),
  priorityOrder: z.number().min(1).max(1000).optional(),
  actionConfig: ActionConfigSchema.optional(),
  ownerEmail: z.string().email().nullable().optional(),
  ownerTeam: z.string().nullable().optional(),
  piiFields: z.array(z.string()).optional(),
  dataCategories: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

function getSupabaseClient(config: APIHandlerConfig): SupabaseClient {
  return typeof config.supabase === 'function' ? config.supabase() : config.supabase;
}

/**
 * Create handlers for PII location endpoints
 */
export function createPIILocationsHandler(config: APIHandlerConfig): ResourceHandlers {
  return {
    /**
     * GET /api/compliance/pii-locations
     * GET /api/compliance/pii-locations/:id
     */
    GET: async (request: NextRequest): Promise<Response> => {
      try {
        const tenantId = await config.getTenantId(request);
        const supabase = getSupabaseClient(config);
        const repo = new PIILocationRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });

        // Check if requesting a specific ID
        const pathParts = request.nextUrl.pathname.split('/');
        const locationId = pathParts[pathParts.length - 1];

        if (locationId && locationId !== 'pii-locations' && z.string().uuid().safeParse(locationId).success) {
          // Get single location
          const location = await repo.findById(locationId);

          if (!location) {
            return NextResponse.json(
              { success: false, error: 'PII location not found' },
              { status: 404 }
            );
          }

          return NextResponse.json({ success: true, data: location });
        }

        // Check for summary endpoint
        if (locationId === 'summary') {
          const summary = await repo.getSummary();
          return NextResponse.json({ success: true, data: summary });
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

        const queryOptions: PIILocationQueryOptions = {
          limit,
          offset,
          orderBy,
          orderDirection,
        };

        if (filters.systemType) {
          queryOptions.systemType = filters.systemType.split(',') as PIILocation['systemType'][];
        }
        if (filters.executionType) {
          queryOptions.executionType = filters.executionType.split(',') as PIILocation['executionType'][];
        }
        if (filters.supportedRequestType) queryOptions.supportedRequestType = filters.supportedRequestType;
        if (filters.isActive !== undefined) queryOptions.isActive = filters.isActive;
        if (filters.ownerTeam) queryOptions.ownerTeam = filters.ownerTeam;
        if (filters.search) queryOptions.search = filters.search;

        const { data, total } = await repo.query(queryOptions);

        const response: PaginatedResponse<PIILocation> = {
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
        console.error('[PIILocations] GET error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch PII locations' },
          { status: 500 }
        );
      }
    },

    /**
     * POST /api/compliance/pii-locations
     * POST /api/compliance/pii-locations/:id/verify
     */
    POST: async (request: NextRequest): Promise<Response> => {
      try {
        const tenantId = await config.getTenantId(request);
        const supabase = getSupabaseClient(config);
        const repo = new PIILocationRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });

        // Check for verify action
        const pathParts = request.nextUrl.pathname.split('/');
        const action = pathParts[pathParts.length - 1];
        const locationId = pathParts[pathParts.length - 2];

        if (action === 'verify' && z.string().uuid().safeParse(locationId).success) {
          const location = await repo.markVerified(locationId);

          // Audit log
          if (config.auditLog) {
            await config.auditLog({
              action: 'pii_location.verified',
              resourceType: 'pii_location',
              resourceId: location.id,
              tenantId,
            });
          }

          return NextResponse.json({ success: true, data: location });
        }

        // Create new location
        const body = await request.json();
        const parsed = CreateLocationSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const location = await repo.create(parsed.data);

        // Audit log
        if (config.auditLog) {
          await config.auditLog({
            action: 'pii_location.created',
            resourceType: 'pii_location',
            resourceId: location.id,
            tenantId,
            metadata: {
              name: location.name,
              systemType: location.systemType,
              executionType: location.executionType,
            },
          });
        }

        return NextResponse.json({ success: true, data: location }, { status: 201 });
      } catch (error) {
        console.error('[PIILocations] POST error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to create PII location' },
          { status: 500 }
        );
      }
    },

    /**
     * PUT /api/compliance/pii-locations/:id
     */
    PUT: async (request: NextRequest): Promise<Response> => {
      try {
        const tenantId = await config.getTenantId(request);
        const supabase = getSupabaseClient(config);
        const repo = new PIILocationRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });

        // Extract location ID from path
        const pathParts = request.nextUrl.pathname.split('/');
        const locationId = pathParts[pathParts.length - 1];

        if (!z.string().uuid().safeParse(locationId).success) {
          return NextResponse.json(
            { success: false, error: 'Invalid location ID' },
            { status: 400 }
          );
        }

        const body = await request.json();
        const parsed = UpdateLocationSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const location = await repo.update(locationId, parsed.data);

        // Audit log
        if (config.auditLog) {
          await config.auditLog({
            action: 'pii_location.updated',
            resourceType: 'pii_location',
            resourceId: location.id,
            tenantId,
            metadata: { updatedFields: Object.keys(parsed.data) },
          });
        }

        return NextResponse.json({ success: true, data: location });
      } catch (error) {
        console.error('[PIILocations] PUT error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to update PII location' },
          { status: 500 }
        );
      }
    },

    /**
     * DELETE /api/compliance/pii-locations/:id
     */
    DELETE: async (request: NextRequest): Promise<Response> => {
      try {
        const tenantId = await config.getTenantId(request);
        const supabase = getSupabaseClient(config);
        const repo = new PIILocationRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });

        // Extract location ID from path
        const pathParts = request.nextUrl.pathname.split('/');
        const locationId = pathParts[pathParts.length - 1];

        if (!z.string().uuid().safeParse(locationId).success) {
          return NextResponse.json(
            { success: false, error: 'Invalid location ID' },
            { status: 400 }
          );
        }

        await repo.delete(locationId);

        // Audit log
        if (config.auditLog) {
          await config.auditLog({
            action: 'pii_location.deleted',
            resourceType: 'pii_location',
            resourceId: locationId,
            tenantId,
          });
        }

        return NextResponse.json({ success: true, message: 'PII location deactivated' });
      } catch (error) {
        console.error('[PIILocations] DELETE error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to delete PII location' },
          { status: 500 }
        );
      }
    },
  };
}
