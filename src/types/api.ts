import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuditEventCallback } from './config';

/**
 * Standard API response wrapper
 */
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: APIMeta;
}

/**
 * API response metadata
 */
export interface APIMeta {
  total?: number;
  limit?: number;
  offset?: number;
  hasMore?: boolean;
  page?: number;
  totalPages?: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> extends APIResponse<T[]> {
  meta: APIMeta & {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * API error with status code
 */
export interface APIError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

/**
 * API route handler configuration
 */
export interface APIHandlerConfig {
  /**
   * Supabase client or factory function
   */
  supabase: SupabaseClient | (() => SupabaseClient);

  /**
   * Function to extract tenant ID from request
   */
  getTenantId: (request: NextRequest) => Promise<string>;

  /**
   * Function to extract user ID from request (optional)
   */
  getUserId?: (request: NextRequest) => Promise<string | null>;

  /**
   * Function to validate user permissions (optional)
   */
  validatePermissions?: (
    request: NextRequest,
    requiredPermission: string
  ) => Promise<boolean>;

  /**
   * Custom audit logging callback
   */
  auditLog?: (event: AuditEventCallback & { tenantId: string }) => Promise<void>;

  /**
   * Rate limiter (optional)
   */
  rateLimiter?: RateLimiter;

  /**
   * Table prefix for database queries
   */
  tablePrefix?: string;

  /**
   * Enable/disable specific endpoints
   */
  enabledEndpoints?: {
    auditLogs?: boolean;
    gdprRequests?: boolean;
    consent?: boolean;
    reports?: boolean;
    metrics?: boolean;
  };
}

/**
 * Rate limiter interface
 */
export interface RateLimiter {
  /**
   * Check if request should be rate limited
   * @returns true if request is allowed, false if rate limited
   */
  check(request: NextRequest): Promise<boolean>;

  /**
   * Get remaining requests in the current window
   */
  remaining(request: NextRequest): Promise<number>;
}

/**
 * Route handler type
 */
export type RouteHandler = (request: NextRequest) => Promise<Response>;

/**
 * Route handlers for a resource
 */
export interface ResourceHandlers {
  GET?: RouteHandler;
  POST?: RouteHandler;
  PUT?: RouteHandler;
  PATCH?: RouteHandler;
  DELETE?: RouteHandler;
}

/**
 * Compliance router that handles all routes
 */
export interface ComplianceRouter {
  handleRequest: RouteHandler;
  handlers: {
    auditLogs: ResourceHandlers;
    gdprRequests: ResourceHandlers;
    consent: ResourceHandlers;
    reports: ResourceHandlers;
    metrics: ResourceHandlers;
  };
}

/**
 * Report generation options
 */
export interface ReportGenerationOptions {
  reportType: 'gdpr-compliance' | 'audit-summary' | 'retention-status' | 'consent-overview';
  format: 'json' | 'csv' | 'pdf';
  startDate?: Date;
  endDate?: Date;
  filters?: Record<string, unknown>;
}

/**
 * Generated report
 */
export interface GeneratedReport {
  id: string;
  type: string;
  format: string;
  generatedAt: Date;
  generatedBy: string;
  data: unknown;
  downloadUrl?: string;
}
