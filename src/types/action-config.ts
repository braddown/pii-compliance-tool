/**
 * Action configuration types for PII locations
 *
 * Defines how actions (erasure, access, etc.) are executed against each PII location.
 * Supports both automated API-based execution and manual human-driven processes.
 */

// =====================================================
// AUTOMATED ACTION CONFIG
// =====================================================

/**
 * Authentication methods for API endpoints
 */
export type AuthType = 'bearer' | 'api_key' | 'oauth2' | 'basic' | 'none';

/**
 * HTTP methods for API calls
 */
export type HttpMethod = 'DELETE' | 'POST' | 'PUT' | 'PATCH' | 'GET';

/**
 * OAuth2 configuration
 */
export interface OAuth2Config {
  /** Token endpoint URL */
  tokenUrl: string;
  /** Reference to client ID in secret store */
  clientIdRef: string;
  /** Reference to client secret in secret store */
  clientSecretRef: string;
  /** OAuth2 scope */
  scope?: string;
}

/**
 * Basic auth configuration
 */
export interface BasicAuthConfig {
  /** Reference to username in secret store */
  usernameRef: string;
  /** Reference to password in secret store */
  passwordRef: string;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /** Header name for API key auth (e.g., "X-API-Key") */
  headerName?: string;
  /** Reference to secret in secret store (e.g., "vault:crm_api_key") */
  secretRef?: string;
  /** OAuth2 configuration */
  oauth2?: OAuth2Config;
  /** Basic auth configuration */
  basicAuth?: BasicAuthConfig;
}

/**
 * Retry policy for failed requests
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Initial delay in milliseconds */
  initialDelayMs?: number;
}

/**
 * Success condition for API responses
 */
export interface SuccessCondition {
  /** Acceptable HTTP status codes */
  httpStatus: number[];
  /** Optional response body validation */
  responseBodyMatch?: {
    /** JSONPath to the value */
    path: string;
    /** Expected value */
    value: string | boolean | number;
  };
}

/**
 * Webhook callback configuration
 */
export interface WebhookConfig {
  /** Whether webhook callbacks are enabled */
  enabled: boolean;
  /** Path to receive callbacks (appended to base URL) */
  callbackPath: string;
  /** Expected callback within X minutes */
  expectedWithin: number;
  /** Reference to webhook signature secret */
  secretRef?: string;
}

/**
 * Request body template configuration
 */
export interface RequestBodyTemplate {
  /** Template object with placeholders */
  template: Record<string, unknown>;
  /** List of placeholder names (e.g., ["{{customer_id}}", "{{email}}"]) */
  placeholders: string[];
}

/**
 * API endpoint configuration
 */
export interface EndpointConfig {
  /** URL with optional placeholders (e.g., "https://api.crm.com/contacts/{{customer_id}}") */
  url: string;
  /** HTTP method */
  method: HttpMethod;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Authentication type */
  authType: AuthType;
  /** Authentication configuration */
  authConfig?: AuthConfig;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Retry policy for failed requests */
  retryPolicy?: RetryPolicy;
}

/**
 * Configuration for automated API-based actions
 *
 * @example
 * ```typescript
 * const config: AutomatedActionConfig = {
 *   endpoint: {
 *     url: 'https://api.crm.com/v1/contacts/{{customer_id}}',
 *     method: 'DELETE',
 *     authType: 'bearer',
 *     authConfig: { secretRef: 'vault:crm_bearer_token' },
 *     timeout: 30000
 *   },
 *   successCondition: {
 *     httpStatus: [200, 204, 404]
 *   }
 * };
 * ```
 */
export interface AutomatedActionConfig {
  /** API endpoint configuration */
  endpoint: EndpointConfig;
  /** Request body template (for POST/PUT/PATCH) */
  requestBody?: RequestBodyTemplate;
  /** Conditions that indicate success */
  successCondition?: SuccessCondition;
  /** Webhook callback configuration */
  webhook?: WebhookConfig;
}

// =====================================================
// MANUAL ACTION CONFIG
// =====================================================

/**
 * Single instruction step for manual actions
 */
export interface ManualInstruction {
  /** Step number (for ordering) */
  step: number;
  /** Short title for the step */
  title: string;
  /** Detailed description of what to do */
  description: string;
  /** Optional screenshot or image URL */
  screenshotUrl?: string;
  /** Warning or caution message */
  warning?: string;
  /** Expected result after completing this step */
  expectedResult?: string;
}

/**
 * Configuration for manual human-driven actions
 *
 * @example
 * ```typescript
 * const config: ManualActionConfig = {
 *   instructions: [
 *     {
 *       step: 1,
 *       title: 'Log into Salesforce',
 *       description: 'Navigate to https://login.salesforce.com and log in with admin credentials'
 *     },
 *     {
 *       step: 2,
 *       title: 'Search for contact',
 *       description: 'Use Global Search to find the contact by email: {{email}}',
 *       screenshotUrl: '/docs/screenshots/sf-search.png'
 *     },
 *     {
 *       step: 3,
 *       title: 'Delete contact record',
 *       description: 'Click the dropdown arrow and select "Delete". Confirm deletion.',
 *       warning: 'Ensure you have backed up any necessary information first'
 *     }
 *   ],
 *   estimatedMinutes: 15,
 *   requiredRole: 'salesforce_admin',
 *   verificationChecklist: ['Contact record deleted', 'Related cases handled']
 * };
 * ```
 */
export interface ManualActionConfig {
  /** Step-by-step instructions */
  instructions: ManualInstruction[];
  /** Estimated time to complete in minutes */
  estimatedMinutes?: number;
  /** Required role or permission to execute */
  requiredRole?: string;
  /** Link to detailed documentation */
  documentationUrl?: string;
  /** Checklist items that must be confirmed */
  verificationChecklist?: string[];
}

// =====================================================
// TYPE GUARDS
// =====================================================

/**
 * Type guard to check if config is for automated execution
 */
export function isAutomatedConfig(
  config: AutomatedActionConfig | ManualActionConfig
): config is AutomatedActionConfig {
  return 'endpoint' in config;
}

/**
 * Type guard to check if config is for manual execution
 */
export function isManualConfig(
  config: AutomatedActionConfig | ManualActionConfig
): config is ManualActionConfig {
  return 'instructions' in config;
}

// =====================================================
// UNION TYPE
// =====================================================

/**
 * Action configuration - either automated or manual
 */
export type ActionConfig = AutomatedActionConfig | ManualActionConfig;
