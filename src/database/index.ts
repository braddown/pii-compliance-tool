/**
 * Database adapter module
 *
 * Provides a unified interface for database operations across different backends:
 * - Omnipii Cloud (default)
 * - Supabase (self-hosted or cloud)
 * - PostgreSQL (direct connection)
 * - MySQL (coming soon)
 *
 * @example
 * ```typescript
 * import { createAdapter, createSupabaseConfig } from '@omnipii/database';
 *
 * // Using Supabase
 * const { adapter } = await createAdapter({
 *   type: 'supabase',
 *   config: createSupabaseConfig(
 *     process.env.SUPABASE_URL!,
 *     process.env.SUPABASE_ANON_KEY!
 *   ),
 * });
 *
 * await adapter.setTenantContext({ tenantId: 'tenant-123' });
 * const result = await adapter.from('requests').select('*');
 * ```
 */

// Types
export * from './types';

// Adapters
export {
  SupabaseAdapter,
  type SupabaseAdapterConfig,
  OmnipiiAdapter,
  type OmnipiiAdapterConfig,
} from './adapters';

// Query builders
export { SupabaseQueryBuilder } from './query-builder';

// Metering
export { InMemoryMeteringService, createMeteringService } from './metering';

// Factory
export {
  createAdapter,
  createAdapterFromSupabaseClient,
  createOmnipiiConfig,
  createSupabaseConfig,
  inferConfigFromEnv,
} from './factory';
