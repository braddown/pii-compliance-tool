import { NextRequest, NextResponse } from 'next/server';
import { createComplianceRouter } from 'omnipii/api';
import { createMockSupabaseClient, MOCK_TENANT_ID } from '@/lib/mock-supabase';

// Create mock Supabase client
const supabase = createMockSupabaseClient();

// Create the compliance router
const router = createComplianceRouter({
  supabase,
  getTenantId: async () => MOCK_TENANT_ID,
  getUserId: async () => 'mock-admin-user-001',
});

// Export route handlers
export const GET = router.handleRequest;
export const POST = router.handleRequest;
export const PUT = router.handleRequest;
export const PATCH = router.handleRequest;
export const DELETE = router.handleRequest;
