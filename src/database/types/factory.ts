/**
 * Database configuration and factory types
 */

import type { DatabaseAdapterType, DatabaseAdapterConfig } from './adapter';

/**
 * Omnipii Cloud configuration
 */
export interface OmnipiiConfig {
  /** API key from omnipii.com dashboard */
  apiKey: string;
  /** API region (default: 'us-east') */
  region?: 'us-east' | 'eu-west' | 'ap-southeast';
  /** Base URL override for development/testing */
  baseUrl?: string;
}

/**
 * Supabase configuration
 */
export interface SupabaseConfig {
  /** Supabase project URL */
  url: string;
  /** Supabase anon/public key */
  anonKey: string;
  /** Supabase service role key (for admin operations) */
  serviceRoleKey?: string;
}

/**
 * PostgreSQL direct connection configuration
 */
export interface PostgreSQLConfig {
  /** Database host */
  host: string;
  /** Database port (default: 5432) */
  port?: number;
  /** Database name */
  database: string;
  /** Database username */
  username: string;
  /** Database password */
  password: string;
  /** Use SSL connection */
  ssl?: boolean | {
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
  /** Connection pool size (default: 10) */
  poolSize?: number;
}

/**
 * MySQL direct connection configuration
 */
export interface MySQLConfig {
  /** Database host */
  host: string;
  /** Database port (default: 3306) */
  port?: number;
  /** Database name */
  database: string;
  /** Database username */
  username: string;
  /** Database password */
  password: string;
  /** Use SSL connection */
  ssl?: boolean | {
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
  /** Connection pool size (default: 10) */
  poolSize?: number;
}

/**
 * Database configuration union type
 * Each adapter type has its specific configuration
 */
export type DatabaseConfiguration =
  | { type: 'omnipii'; config: OmnipiiConfig }
  | { type: 'supabase'; config: SupabaseConfig }
  | { type: 'postgresql'; config: PostgreSQLConfig }
  | { type: 'mysql'; config: MySQLConfig };

/**
 * Extract config type for a specific adapter type
 */
export type ConfigForAdapter<T extends DatabaseAdapterType> =
  T extends 'omnipii' ? OmnipiiConfig :
  T extends 'supabase' ? SupabaseConfig :
  T extends 'postgresql' ? PostgreSQLConfig :
  T extends 'mysql' ? MySQLConfig :
  never;

/**
 * Factory options for creating database adapters
 */
export interface DatabaseFactoryOptions {
  /** Table name prefix (default: 'compliance_') */
  tablePrefix?: string;
  /** Enable debug/query logging */
  debug?: boolean;
  /** Auto-initialize on creation */
  autoInitialize?: boolean;
}

/**
 * Result from adapter factory
 */
export interface AdapterFactoryResult {
  /** The created adapter instance */
  adapter: import('./adapter').DatabaseAdapter;
  /** Whether the adapter was auto-initialized */
  initialized: boolean;
  /** Connection info for display purposes */
  connectionInfo: {
    type: DatabaseAdapterType;
    displayName: string;
    region?: string;
  };
}

/**
 * Default configuration for Omnipii Cloud
 */
export const DEFAULT_OMNIPII_REGION = 'us-east' as const;
export const DEFAULT_OMNIPII_BASE_URL = 'https://api.omnipii.com' as const;

/**
 * Region-specific API URLs
 */
export const OMNIPII_REGION_URLS: Record<NonNullable<OmnipiiConfig['region']>, string> = {
  'us-east': 'https://api.omnipii.com',
  'eu-west': 'https://eu.api.omnipii.com',
  'ap-southeast': 'https://ap.api.omnipii.com',
};

/**
 * Validate Omnipii API key format
 * Format: op_<mode>_<tenant_id>_<random>
 * Example: op_live_abc123_xyzrandom
 */
export function isValidOmnipiiApiKey(apiKey: string): boolean {
  const pattern = /^op_(live|test)_[a-zA-Z0-9]+_[a-zA-Z0-9]{32}$/;
  return pattern.test(apiKey);
}

/**
 * Parse Omnipii API key to extract metadata
 */
export function parseOmnipiiApiKey(apiKey: string): {
  valid: boolean;
  mode?: 'live' | 'test';
  tenantId?: string;
} {
  const match = apiKey.match(/^op_(live|test)_([a-zA-Z0-9]+)_[a-zA-Z0-9]{32}$/);
  if (!match) {
    return { valid: false };
  }
  return {
    valid: true,
    mode: match[1] as 'live' | 'test',
    tenantId: match[2],
  };
}
