import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ActionTaskRepository } from '../../repositories/action-task-repository';
import { PIILocationRepository } from '../../repositories/pii-location-repository';
import type { APIHandlerConfig, ResourceHandlers, PaginatedResponse } from '../../types/api';
import type { ActionTask, ActionTaskQueryOptions } from '../../types/action-task';

// Query parameter schemas
const QueryParamsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  dsrRequestId: z.string().uuid().optional(),
  piiLocationId: z.string().uuid().optional(),
  taskType: z.string().optional(),
  status: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  hasErrors: z.coerce.boolean().optional(),
  needsRetry: z.coerce.boolean().optional(),
  awaitingCallback: z.coerce.boolean().optional(),
  orderBy: z.enum(['createdAt', 'status', 'priorityOrder']).optional().default('createdAt'),
  orderDirection: z.enum(['asc', 'desc']).optional().default('desc'),
});

const CreateTaskSchema = z.object({
  dsrRequestId: z.string().uuid(),
  piiLocationId: z.string().uuid(),
  taskType: z.enum(['access', 'rectification', 'erasure', 'restriction', 'portability', 'objection']),
  assignedTo: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const UpdateTaskSchema = z.object({
  status: z.enum([
    'pending', 'in_progress', 'awaiting_callback', 'manual_action',
    'verification', 'completed', 'failed', 'blocked', 'skipped'
  ]).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  executionResult: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
  verifiedBy: z.string().uuid().optional(),
  verificationNotes: z.string().optional(),
});

const CompleteTaskSchema = z.object({
  result: z.object({
    apiResponse: z.unknown().optional(),
    httpStatus: z.number().optional(),
    recordsAffected: z.number().optional(),
    errorMessage: z.string().nullable().optional(),
    manualConfirmation: z.string().optional(),
    checklistCompleted: z.record(z.boolean()).optional(),
  }),
  notes: z.string().optional(),
});

const FailTaskSchema = z.object({
  errorMessage: z.string(),
  scheduleRetry: z.boolean().optional(),
  notes: z.string().optional(),
});

const SkipTaskSchema = z.object({
  reason: z.string(),
});

const VerifyTaskSchema = z.object({
  notes: z.string().optional(),
});

const WebhookCallbackSchema = z.object({
  correlationId: z.string().uuid(),
  status: z.enum(['success', 'failure']),
  payload: z.unknown().optional(),
});

const InitiateActionsSchema = z.object({
  dsrRequestId: z.string().uuid(),
  requestType: z.enum(['access', 'rectification', 'erasure', 'restriction', 'portability', 'objection']),
});

function getSupabaseClient(config: APIHandlerConfig): SupabaseClient {
  return typeof config.supabase === 'function' ? config.supabase() : config.supabase;
}

/**
 * Create handlers for action task endpoints
 */
export function createActionTasksHandler(config: APIHandlerConfig): ResourceHandlers {
  return {
    /**
     * GET /api/compliance/action-tasks
     * GET /api/compliance/action-tasks/:id
     * GET /api/compliance/action-tasks/summary/:dsrRequestId
     */
    GET: async (request: NextRequest): Promise<Response> => {
      try {
        const tenantId = await config.getTenantId(request);
        const supabase = getSupabaseClient(config);
        const repo = new ActionTaskRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });

        const pathParts = request.nextUrl.pathname.split('/');
        const lastPart = pathParts[pathParts.length - 1];
        const secondLastPart = pathParts[pathParts.length - 2];

        // Check for summary endpoint: /action-tasks/summary/:dsrRequestId
        if (secondLastPart === 'summary' && z.string().uuid().safeParse(lastPart).success) {
          const summary = await repo.getSummaryForRequest(lastPart);
          return NextResponse.json({ success: true, data: summary });
        }

        // Check if requesting a specific task by ID
        if (lastPart && lastPart !== 'action-tasks' && z.string().uuid().safeParse(lastPart).success) {
          const task = await repo.findById(lastPart);

          if (!task) {
            return NextResponse.json(
              { success: false, error: 'Action task not found' },
              { status: 404 }
            );
          }

          return NextResponse.json({ success: true, data: task });
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

        const queryOptions: ActionTaskQueryOptions = {
          limit,
          offset,
          orderBy,
          orderDirection,
        };

        if (filters.dsrRequestId) queryOptions.dsrRequestId = filters.dsrRequestId;
        if (filters.piiLocationId) queryOptions.piiLocationId = filters.piiLocationId;
        if (filters.taskType) {
          queryOptions.taskType = filters.taskType.split(',') as ActionTask['taskType'][];
        }
        if (filters.status) {
          queryOptions.status = filters.status.split(',') as ActionTask['status'][];
        }
        if (filters.assignedTo) queryOptions.assignedTo = filters.assignedTo;
        if (filters.hasErrors) queryOptions.hasErrors = filters.hasErrors;
        if (filters.needsRetry) queryOptions.needsRetry = filters.needsRetry;
        if (filters.awaitingCallback) queryOptions.awaitingCallback = filters.awaitingCallback;

        const { data, total } = await repo.query(queryOptions);

        const response: PaginatedResponse<ActionTask> = {
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
        console.error('[ActionTasks] GET error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch action tasks' },
          { status: 500 }
        );
      }
    },

    /**
     * POST /api/compliance/action-tasks
     * POST /api/compliance/action-tasks/initiate
     * POST /api/compliance/action-tasks/:id/start
     * POST /api/compliance/action-tasks/:id/complete
     * POST /api/compliance/action-tasks/:id/fail
     * POST /api/compliance/action-tasks/:id/skip
     * POST /api/compliance/action-tasks/:id/verify
     * POST /api/compliance/action-tasks/:id/retry
     * POST /api/compliance/action-tasks/webhook/callback
     */
    POST: async (request: NextRequest): Promise<Response> => {
      try {
        const tenantId = await config.getTenantId(request);
        const supabase = getSupabaseClient(config);
        const repo = new ActionTaskRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });

        const pathParts = request.nextUrl.pathname.split('/');
        const action = pathParts[pathParts.length - 1];
        const taskId = pathParts[pathParts.length - 2];

        // Handle webhook callback: /action-tasks/webhook/callback
        if (action === 'callback' && taskId === 'webhook') {
          const body = await request.json();
          const parsed = WebhookCallbackSchema.safeParse(body);

          if (!parsed.success) {
            return NextResponse.json(
              { success: false, error: 'Invalid webhook payload', details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          const task = await repo.handleWebhookCallback(
            parsed.data.correlationId,
            parsed.data.payload,
            parsed.data.status === 'success'
          );

          if (config.auditLog) {
            await config.auditLog({
              action: 'action_task.webhook_received',
              resourceType: 'action_task',
              resourceId: task.id,
              tenantId,
              metadata: {
                correlationId: parsed.data.correlationId,
                status: parsed.data.status,
              },
            });
          }

          return NextResponse.json({ success: true, data: task });
        }

        // Handle initiate actions: /action-tasks/initiate
        if (action === 'initiate') {
          const body = await request.json();
          const parsed = InitiateActionsSchema.safeParse(body);

          if (!parsed.success) {
            return NextResponse.json(
              { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          const tasks = await repo.createTasksForRequest(
            parsed.data.dsrRequestId,
            parsed.data.requestType
          );

          if (config.auditLog) {
            await config.auditLog({
              action: 'action_tasks.initiated',
              resourceType: 'gdpr_request',
              resourceId: parsed.data.dsrRequestId,
              tenantId,
              metadata: {
                requestType: parsed.data.requestType,
                taskCount: tasks.length,
              },
            });
          }

          return NextResponse.json({ success: true, data: tasks }, { status: 201 });
        }

        // Handle task-specific actions
        if (z.string().uuid().safeParse(taskId).success) {
          const userId = config.getUserId ? await config.getUserId(request) : null;

          switch (action) {
            case 'start': {
              const task = await repo.startTask(taskId, userId ?? undefined);

              if (config.auditLog) {
                await config.auditLog({
                  action: 'action_task.started',
                  resourceType: 'action_task',
                  resourceId: task.id,
                  tenantId,
                  metadata: { correlationId: task.correlationId },
                });
              }

              return NextResponse.json({ success: true, data: task });
            }

            case 'complete': {
              const body = await request.json();
              const parsed = CompleteTaskSchema.safeParse(body);

              if (!parsed.success) {
                return NextResponse.json(
                  { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
                  { status: 400 }
                );
              }

              const task = await repo.completeTask(taskId, parsed.data);

              if (config.auditLog) {
                await config.auditLog({
                  action: 'action_task.completed',
                  resourceType: 'action_task',
                  resourceId: task.id,
                  tenantId,
                  metadata: {
                    correlationId: task.correlationId,
                    recordsAffected: parsed.data.result.recordsAffected,
                  },
                });
              }

              return NextResponse.json({ success: true, data: task });
            }

            case 'fail': {
              const body = await request.json();
              const parsed = FailTaskSchema.safeParse(body);

              if (!parsed.success) {
                return NextResponse.json(
                  { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
                  { status: 400 }
                );
              }

              const task = await repo.failTask(taskId, parsed.data);

              if (config.auditLog) {
                await config.auditLog({
                  action: 'action_task.failed',
                  resourceType: 'action_task',
                  resourceId: task.id,
                  tenantId,
                  metadata: {
                    correlationId: task.correlationId,
                    errorMessage: parsed.data.errorMessage,
                  },
                });
              }

              return NextResponse.json({ success: true, data: task });
            }

            case 'skip': {
              const body = await request.json();
              const parsed = SkipTaskSchema.safeParse(body);

              if (!parsed.success) {
                return NextResponse.json(
                  { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
                  { status: 400 }
                );
              }

              const task = await repo.skipTask(taskId, parsed.data.reason);

              if (config.auditLog) {
                await config.auditLog({
                  action: 'action_task.skipped',
                  resourceType: 'action_task',
                  resourceId: task.id,
                  tenantId,
                  metadata: {
                    correlationId: task.correlationId,
                    reason: parsed.data.reason,
                  },
                });
              }

              return NextResponse.json({ success: true, data: task });
            }

            case 'verify': {
              if (!userId) {
                return NextResponse.json(
                  { success: false, error: 'User ID required for verification' },
                  { status: 400 }
                );
              }

              const body = await request.json().catch(() => ({}));
              const parsed = VerifyTaskSchema.safeParse(body);

              const task = await repo.verifyTask(
                taskId,
                userId,
                parsed.success ? parsed.data.notes : undefined
              );

              if (config.auditLog) {
                await config.auditLog({
                  action: 'action_task.verified',
                  resourceType: 'action_task',
                  resourceId: task.id,
                  tenantId,
                  metadata: { correlationId: task.correlationId, verifiedBy: userId },
                });
              }

              return NextResponse.json({ success: true, data: task });
            }

            case 'retry': {
              const task = await repo.retryTask(taskId);

              if (config.auditLog) {
                await config.auditLog({
                  action: 'action_task.retried',
                  resourceType: 'action_task',
                  resourceId: task.id,
                  tenantId,
                  metadata: { correlationId: task.correlationId },
                });
              }

              return NextResponse.json({ success: true, data: task });
            }
          }
        }

        // Create new task (direct creation - usually tasks are created via initiate)
        const body = await request.json();
        const parsed = CreateTaskSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const task = await repo.create(parsed.data);

        if (config.auditLog) {
          await config.auditLog({
            action: 'action_task.created',
            resourceType: 'action_task',
            resourceId: task.id,
            tenantId,
            metadata: {
              dsrRequestId: task.dsrRequestId,
              piiLocationId: task.piiLocationId,
              taskType: task.taskType,
            },
          });
        }

        return NextResponse.json({ success: true, data: task }, { status: 201 });
      } catch (error) {
        console.error('[ActionTasks] POST error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to process action task request' },
          { status: 500 }
        );
      }
    },

    /**
     * PUT /api/compliance/action-tasks/:id
     */
    PUT: async (request: NextRequest): Promise<Response> => {
      try {
        const tenantId = await config.getTenantId(request);
        const supabase = getSupabaseClient(config);
        const repo = new ActionTaskRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });

        const pathParts = request.nextUrl.pathname.split('/');
        const taskId = pathParts[pathParts.length - 1];

        if (!z.string().uuid().safeParse(taskId).success) {
          return NextResponse.json(
            { success: false, error: 'Invalid task ID' },
            { status: 400 }
          );
        }

        const body = await request.json();
        const parsed = UpdateTaskSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const task = await repo.update(taskId, parsed.data);

        if (config.auditLog) {
          await config.auditLog({
            action: 'action_task.updated',
            resourceType: 'action_task',
            resourceId: task.id,
            tenantId,
            metadata: {
              correlationId: task.correlationId,
              updatedFields: Object.keys(parsed.data),
            },
          });
        }

        return NextResponse.json({ success: true, data: task });
      } catch (error) {
        console.error('[ActionTasks] PUT error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to update action task' },
          { status: 500 }
        );
      }
    },
  };
}
