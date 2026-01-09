import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DataSubjectRequestRepository } from '../../repositories/dsr-repository';
import type { ResourceHandlers } from '../../types/api';
import type { VerificationCallbackConfig } from '../../types/data-subject-request';

/**
 * Configuration for public request endpoints
 */
export interface PublicRequestHandlerConfig {
  /**
   * Supabase client or factory function
   */
  supabase: SupabaseClient | (() => SupabaseClient);

  /**
   * Function to get tenant ID from request
   * For public endpoints, this might be based on API key, subdomain, or origin
   */
  getTenantId: (request: NextRequest) => Promise<string>;

  /**
   * Table prefix for database queries
   */
  tablePrefix?: string;

  /**
   * Rate limiting configuration
   */
  rateLimit?: {
    /** Max requests per window */
    maxRequests: number;
    /** Window duration in seconds */
    windowSeconds: number;
    /** Function to check rate limit */
    check: (request: NextRequest) => Promise<boolean>;
  };

  /**
   * Verification configuration
   */
  verification?: VerificationCallbackConfig;

  /**
   * Audit logging callback
   */
  auditLog?: (event: {
    action: string;
    resourceType: string;
    resourceId: string;
    tenantId: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;

  /**
   * Allowed origins for CORS (default: all)
   */
  allowedOrigins?: string[];
}

// Validation schemas
const SubmitRequestSchema = z.object({
  requestType: z.enum(['access', 'rectification', 'erasure', 'restriction', 'portability', 'objection', 'consent']),
  email: z.string().email(),
  name: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
});

const VerifyRequestSchema = z.object({
  token: z.string().min(32).max(64),
});

const StatusQuerySchema = z.object({
  email: z.string().email(),
  requestId: z.string().uuid(),
});

/**
 * Generate a secure random token
 */
function generateVerificationToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Get client IP from request
 */
function getClientIp(request: NextRequest): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  );
}

function getSupabaseClient(config: PublicRequestHandlerConfig): SupabaseClient {
  return typeof config.supabase === 'function' ? config.supabase() : config.supabase;
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: Response, config: PublicRequestHandlerConfig, request: NextRequest): Response {
  const origin = request.headers.get('origin');
  const headers = new Headers(response.headers);

  if (config.allowedOrigins) {
    if (origin && config.allowedOrigins.includes(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
    }
  } else {
    headers.set('Access-Control-Allow-Origin', '*');
  }

  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Create handlers for public request submission endpoints
 *
 * These endpoints are designed for external parties (data subjects) to:
 * 1. Submit new GDPR requests
 * 2. Verify their email address
 * 3. Check request status
 *
 * @example
 * ```typescript
 * // app/api/privacy/[...path]/route.ts
 * import { createPublicRequestHandler } from '@conversr/compliance/api';
 *
 * const handler = createPublicRequestHandler({
 *   supabase: getSupabaseClient(),
 *   getTenantId: async () => 'your-tenant-id',
 *   verification: {
 *     verificationBaseUrl: 'https://yoursite.com/verify-request',
 *     sendVerificationEmail: async ({ email, verificationUrl }) => {
 *       await sendEmail(email, 'Verify your request', verificationUrl);
 *     },
 *   },
 * });
 *
 * export const GET = handler.GET;
 * export const POST = handler.POST;
 * export const OPTIONS = handler.OPTIONS;
 * ```
 */
export function createPublicRequestHandler(config: PublicRequestHandlerConfig): ResourceHandlers & { OPTIONS?: (req: NextRequest) => Promise<Response> } {
  return {
    /**
     * OPTIONS - CORS preflight
     */
    OPTIONS: async (request: NextRequest): Promise<Response> => {
      const response = new Response(null, { status: 204 });
      return addCorsHeaders(response, config, request);
    },

    /**
     * GET /api/compliance/public/requests/status?email=...&requestId=...
     * Check status of a submitted request (requires email match for privacy)
     */
    GET: async (request: NextRequest): Promise<Response> => {
      try {
        const tenantId = await config.getTenantId(request);
        const supabase = getSupabaseClient(config);
        const repo = new DataSubjectRequestRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });

        // Check for verify endpoint: /public/requests/verify/:token
        const pathParts = request.nextUrl.pathname.split('/');
        const lastPart = pathParts[pathParts.length - 1];
        const secondLastPart = pathParts[pathParts.length - 2];

        if (secondLastPart === 'verify' && lastPart) {
          // Verify request by token (GET for email link clicks)
          const token = lastPart;

          // Find request with this verification token
          const { data: requests } = await repo.query({
            status: ['pending_verification'],
            limit: 100,
          });

          const matchingRequest = requests.find(
            (r) => r.metadata?.verificationToken === token
          );

          if (!matchingRequest) {
            const response = NextResponse.json(
              { success: false, error: 'Invalid or expired verification token' },
              { status: 400 }
            );
            return addCorsHeaders(response, config, request);
          }

          // Check expiration
          const expiresAt = matchingRequest.metadata?.verificationExpiresAt;
          if (expiresAt && new Date(expiresAt) < new Date()) {
            const response = NextResponse.json(
              { success: false, error: 'Verification token has expired' },
              { status: 400 }
            );
            return addCorsHeaders(response, config, request);
          }

          // Verify the request
          await repo.update(matchingRequest.id, {
            status: 'pending',
            verificationMethod: 'email',
            verifiedAt: new Date(),
            metadata: {
              ...matchingRequest.metadata,
              verificationToken: undefined,
              verificationExpiresAt: undefined,
              verifiedAt: new Date().toISOString(),
            },
          });

          if (config.auditLog) {
            await config.auditLog({
              action: 'public_request.verified',
              resourceType: 'gdpr_request',
              resourceId: matchingRequest.id,
              tenantId,
              metadata: { method: 'email_link' },
            });
          }

          // Return success page or redirect
          const response = NextResponse.json({
            success: true,
            message: 'Your request has been verified and is now being processed.',
            requestId: matchingRequest.id,
          });
          return addCorsHeaders(response, config, request);
        }

        // Status check endpoint
        const searchParams = Object.fromEntries(request.nextUrl.searchParams);
        const parsed = StatusQuerySchema.safeParse(searchParams);

        if (!parsed.success) {
          const response = NextResponse.json(
            { success: false, error: 'Email and requestId are required' },
            { status: 400 }
          );
          return addCorsHeaders(response, config, request);
        }

        const gdprRequest = await repo.findById(parsed.data.requestId);

        if (!gdprRequest || gdprRequest.requesterEmail !== parsed.data.email) {
          const response = NextResponse.json(
            { success: false, error: 'Request not found' },
            { status: 404 }
          );
          return addCorsHeaders(response, config, request);
        }

        // Return limited public information
        const response = NextResponse.json({
          success: true,
          data: {
            requestId: gdprRequest.id,
            requestType: gdprRequest.requestType,
            status: gdprRequest.status,
            submittedAt: gdprRequest.createdAt,
            dueDate: gdprRequest.dueDate,
            isVerified: gdprRequest.status !== 'pending_verification',
          },
        });
        return addCorsHeaders(response, config, request);
      } catch (error) {
        console.error('[PublicRequests] GET error:', error);
        const response = NextResponse.json(
          { success: false, error: 'Failed to process request' },
          { status: 500 }
        );
        return addCorsHeaders(response, config, request);
      }
    },

    /**
     * POST /api/compliance/public/requests
     * Submit a new GDPR request
     *
     * POST /api/compliance/public/requests/verify
     * Verify a request with token (alternative to GET)
     */
    POST: async (request: NextRequest): Promise<Response> => {
      try {
        // Rate limiting
        if (config.rateLimit) {
          const allowed = await config.rateLimit.check(request);
          if (!allowed) {
            const response = NextResponse.json(
              { success: false, error: 'Too many requests. Please try again later.' },
              { status: 429 }
            );
            return addCorsHeaders(response, config, request);
          }
        }

        const tenantId = await config.getTenantId(request);
        const supabase = getSupabaseClient(config);
        const repo = new DataSubjectRequestRepository(supabase, tenantId, {
          tablePrefix: config.tablePrefix,
        });

        // Check for verify endpoint
        const pathParts = request.nextUrl.pathname.split('/');
        const lastPart = pathParts[pathParts.length - 1];

        if (lastPart === 'verify') {
          // Verify request by token
          const body = await request.json();
          const parsed = VerifyRequestSchema.safeParse(body);

          if (!parsed.success) {
            const response = NextResponse.json(
              { success: false, error: 'Invalid verification token' },
              { status: 400 }
            );
            return addCorsHeaders(response, config, request);
          }

          // Find request with this verification token
          const { data: requests } = await repo.query({
            status: ['pending_verification'],
            limit: 100,
          });

          const matchingRequest = requests.find(
            (r) => r.metadata?.verificationToken === parsed.data.token
          );

          if (!matchingRequest) {
            const response = NextResponse.json(
              { success: false, error: 'Invalid or expired verification token' },
              { status: 400 }
            );
            return addCorsHeaders(response, config, request);
          }

          // Check expiration
          const expiresAt = matchingRequest.metadata?.verificationExpiresAt;
          if (expiresAt && new Date(expiresAt) < new Date()) {
            const response = NextResponse.json(
              { success: false, error: 'Verification token has expired. Please submit a new request.' },
              { status: 400 }
            );
            return addCorsHeaders(response, config, request);
          }

          // Verify the request
          await repo.update(matchingRequest.id, {
            status: 'pending',
            verificationMethod: 'email',
            verifiedAt: new Date(),
            metadata: {
              ...matchingRequest.metadata,
              verificationToken: undefined,
              verificationExpiresAt: undefined,
              verifiedAt: new Date().toISOString(),
            },
          });

          if (config.auditLog) {
            await config.auditLog({
              action: 'public_request.verified',
              resourceType: 'gdpr_request',
              resourceId: matchingRequest.id,
              tenantId,
              metadata: { method: 'token_post' },
            });
          }

          const response = NextResponse.json({
            success: true,
            message: 'Your request has been verified and is now being processed.',
            requestId: matchingRequest.id,
          });
          return addCorsHeaders(response, config, request);
        }

        // Submit new request
        const body = await request.json();
        const parsed = SubmitRequestSchema.safeParse(body);

        if (!parsed.success) {
          const response = NextResponse.json(
            { success: false, error: 'Invalid request', details: parsed.error.flatten() },
            { status: 400 }
          );
          return addCorsHeaders(response, config, request);
        }

        // Check for existing pending_verification request from same email
        const { data: existingRequests } = await repo.query({
          status: ['pending_verification'],
          limit: 10,
        });

        const duplicatePending = existingRequests.find(
          (r) => r.requesterEmail === parsed.data.email && r.requestType === parsed.data.requestType
        );

        if (duplicatePending) {
          // Resend verification for existing request
          const expirationHours = config.verification?.tokenExpirationHours ?? 24;
          const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);
          const verificationToken = generateVerificationToken();

          await repo.update(duplicatePending.id, {
            metadata: {
              ...duplicatePending.metadata,
              verificationToken,
              verificationExpiresAt: expiresAt.toISOString(),
            },
          });

          // Send verification email
          if (config.verification?.sendVerificationEmail) {
            const verificationUrl = config.verification.verificationBaseUrl
              ? `${config.verification.verificationBaseUrl}?token=${verificationToken}`
              : `verify/${verificationToken}`;

            await config.verification.sendVerificationEmail({
              email: parsed.data.email,
              requestId: duplicatePending.id,
              verificationToken,
              verificationUrl,
              requestType: parsed.data.requestType,
              expiresAt,
            });
          }

          const response = NextResponse.json({
            success: true,
            message: 'A verification email has been sent. Please check your inbox.',
            requestId: duplicatePending.id,
            verificationRequired: true,
            expiresAt: expiresAt.toISOString(),
          });
          return addCorsHeaders(response, config, request);
        }

        // Generate verification token
        const verificationToken = generateVerificationToken();
        const expirationHours = config.verification?.tokenExpirationHours ?? 24;
        const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

        // Create the request
        const gdprRequest = await repo.create({
          requestType: parsed.data.requestType,
          requesterEmail: parsed.data.email,
          notes: parsed.data.description,
          metadata: {
            verificationToken,
            verificationExpiresAt: expiresAt.toISOString(),
            submissionSource: 'public_api',
            submitterName: parsed.data.name,
            submitterIpAddress: getClientIp(request) ?? undefined,
            submitterUserAgent: request.headers.get('user-agent') ?? undefined,
          },
        });

        // Override status to pending_verification
        await repo.update(gdprRequest.id, {
          status: 'pending_verification',
        });

        // Send verification email
        if (config.verification?.sendVerificationEmail) {
          const verificationUrl = config.verification.verificationBaseUrl
            ? `${config.verification.verificationBaseUrl}?token=${verificationToken}`
            : `verify/${verificationToken}`;

          await config.verification.sendVerificationEmail({
            email: parsed.data.email,
            requestId: gdprRequest.id,
            verificationToken,
            verificationUrl,
            requestType: parsed.data.requestType,
            expiresAt,
          });
        }

        if (config.auditLog) {
          await config.auditLog({
            action: 'public_request.submitted',
            resourceType: 'gdpr_request',
            resourceId: gdprRequest.id,
            tenantId,
            metadata: {
              requestType: parsed.data.requestType,
              source: 'public_api',
            },
          });
        }

        const response = NextResponse.json(
          {
            success: true,
            message: 'Your request has been submitted. Please check your email to verify your request.',
            requestId: gdprRequest.id,
            verificationRequired: true,
            expiresAt: expiresAt.toISOString(),
          },
          { status: 201 }
        );
        return addCorsHeaders(response, config, request);
      } catch (error) {
        console.error('[PublicRequests] POST error:', error);
        const response = NextResponse.json(
          { success: false, error: 'Failed to submit request' },
          { status: 500 }
        );
        return addCorsHeaders(response, config, request);
      }
    },
  };
}
