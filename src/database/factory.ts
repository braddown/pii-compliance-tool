/**
 * Database adapter factory
 * Creates the appropriate adapter based on configuration
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseAdapter } from './types/adapter';
import type {
  DatabaseConfiguration,
  DatabaseFactoryOptions,
  AdapterFactoryResult,
  OmnipiiConfig,
  SupabaseConfig,
} from './types/factory';
import { SupabaseAdapter } from './adapters/supabase-adapter';
import { OmnipiiAdapter } from './adapters/omnipii-adapter';
import { OMNIPII_REGION_URLS, DEFAULT_OMNIPII_REGION } from './types/factory';

/**
 * Create a database adapter from configuration
 */
export async function createAdapter(
  config: DatabaseConfiguration,
  options: DatabaseFactoryOptions = {}
): Promise<AdapterFactoryResult> {
  const { tablePrefix = 'compliance_', debug = false, autoInitialize = true } = options;

  let adapter: DatabaseAdapter;
  let displayName: string;
  let region: string | undefined;

  switch (config.type) {
    case 'omnipii': {
      adapter = new OmnipiiAdapter();
      displayName = 'Omnipii Cloud';
      region = config.config.region ?? DEFAULT_OMNIPII_REGION;

      if (autoInitialize) {
        await adapter.initialize({
          connection: config.config,
          tablePrefix,
          debug,
        });
      }
      break;
    }

    case 'supabase': {
      adapter = new SupabaseAdapter();
      displayName = 'Supabase';

      if (autoInitialize) {
        await adapter.initialize({
          connection: config.config,
          tablePrefix,
          debug,
        });
      }
      break;
    }

    case 'postgresql': {
      // PostgreSQL direct adapter (to be implemented)
      throw new Error(
        'PostgreSQL adapter not yet implemented. ' +
        'Use Supabase adapter or contact support for Enterprise features.'
      );
    }

    case 'mysql': {
      // MySQL adapter (to be implemented)
      throw new Error(
        'MySQL adapter not yet implemented. ' +
        'Use Supabase adapter or contact support for Enterprise features.'
      );
    }

    default: {
      throw new Error(`Unknown database type: ${(config as any).type}`);
    }
  }

  return {
    adapter,
    initialized: autoInitialize,
    connectionInfo: {
      type: config.type,
      displayName,
      region,
    },
  };
}

/**
 * Create a Supabase adapter from an existing client
 * This is for backwards compatibility with existing code
 */
export function createAdapterFromSupabaseClient(
  client: SupabaseClient,
  options: DatabaseFactoryOptions = {}
): DatabaseAdapter {
  return SupabaseAdapter.fromClient(client, {
    tablePrefix: options.tablePrefix,
    debug: options.debug,
  });
}

/**
 * Create an Omnipii Cloud configuration from API key
 */
export function createOmnipiiConfig(apiKey: string, region?: OmnipiiConfig['region']): OmnipiiConfig {
  return {
    apiKey,
    region: region ?? DEFAULT_OMNIPII_REGION,
    baseUrl: OMNIPII_REGION_URLS[region ?? DEFAULT_OMNIPII_REGION],
  };
}

/**
 * Create a Supabase configuration
 */
export function createSupabaseConfig(
  url: string,
  anonKey: string,
  serviceRoleKey?: string
): SupabaseConfig {
  return {
    url,
    anonKey,
    serviceRoleKey,
  };
}

/**
 * Infer database configuration from environment variables
 */
export function inferConfigFromEnv(): DatabaseConfiguration | null {
  // Check for Omnipii API key first
  const omnipiiKey = process.env.OMNIPII_API_KEY;
  if (omnipiiKey) {
    return {
      type: 'omnipii',
      config: createOmnipiiConfig(
        omnipiiKey,
        (process.env.OMNIPII_REGION as OmnipiiConfig['region']) ?? undefined
      ),
    };
  }

  // Check for Supabase configuration
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    return {
      type: 'supabase',
      config: createSupabaseConfig(supabaseUrl, supabaseAnonKey, supabaseServiceKey),
    };
  }

  return null;
}
