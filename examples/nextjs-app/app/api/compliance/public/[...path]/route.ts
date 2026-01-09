import { NextRequest } from 'next/server';
import { createPublicRequestHandler } from 'pii-compliance-tool/api';
import { createMockSupabaseClient, MOCK_TENANT_ID } from '@/lib/mock-supabase';

/**
 * Public API routes for external data subject requests
 *
 * These endpoints allow data subjects (external users) to:
 * - Submit new GDPR requests
 * - Verify their email address
 * - Check the status of their requests
 *
 * Routes:
 * - POST /api/compliance/public/requests - Submit a new request
 * - POST /api/compliance/public/requests/verify - Verify with token
 * - GET  /api/compliance/public/requests/verify/:token - Verify via email link
 * - GET  /api/compliance/public/requests/status?email=...&requestId=... - Check status
 */

const handler = createPublicRequestHandler({
  supabase: createMockSupabaseClient,

  // For demo purposes, use a fixed tenant ID
  // In production, derive from API key, subdomain, or other identifier
  getTenantId: async () => MOCK_TENANT_ID,

  // Optional: Rate limiting
  rateLimit: {
    maxRequests: 10,
    windowSeconds: 60,
    check: async (request: NextRequest) => {
      // In production, implement proper rate limiting (e.g., with Redis)
      // For demo, always allow
      return true;
    },
  },

  // Verification email configuration
  verification: {
    // Base URL for verification links
    verificationBaseUrl: process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/verify-request`
      : 'http://localhost:3000/verify-request',

    // Token expiration (24 hours)
    tokenExpirationHours: 24,

    // Email sending callback
    sendVerificationEmail: async ({ email, requestId, verificationToken, verificationUrl, requestType, expiresAt }) => {
      // In production, integrate with your email provider (SendGrid, Resend, etc.)
      console.log('=== VERIFICATION EMAIL ===');
      console.log(`To: ${email}`);
      console.log(`Subject: Verify your ${requestType} request`);
      console.log(`Request ID: ${requestId}`);
      console.log(`Verification URL: ${verificationUrl}`);
      console.log(`Token: ${verificationToken}`);
      console.log(`Expires: ${expiresAt.toISOString()}`);
      console.log('==========================');
    },
  },

  // Audit logging callback
  auditLog: async (event) => {
    console.log('[PublicRequests Audit]', JSON.stringify(event, null, 2));
  },

  // CORS: Allow all origins for demo (restrict in production)
  // allowedOrigins: ['https://yoursite.com'],
});

export const GET = handler.GET;
export const POST = handler.POST;
export const OPTIONS = handler.OPTIONS;
