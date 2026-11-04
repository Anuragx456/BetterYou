import type * as SentryTypes from '@sentry/react-native';

/**
 * PII redaction patterns:
 * 1. Google Gemini / API keys (AIza...)
 * 2. General bearer / private tokens
 * 3. Local filesystem image paths (meals/scans/file://)
 * 4. Base64 encoded payload previews
 * 5. Device UUIDs / identifiers
 */
const SENSITIVE_PATTERNS: { regex: RegExp; replacement: string }[] = [
  // Gemini API Keys (starts with AIza, followed by 30-40 characters)
  { regex: /AIza[0-9A-Za-z\-_]{30,45}/g, replacement: '[REDACTED_GEMINI_API_KEY]' },
  // Generic API Keys & Bearer tokens
  { regex: /Bearer\s+[A-Za-z0-9\-_.]+/gi, replacement: 'Bearer [REDACTED_TOKEN]' },
  { regex: /(?:api[_-]?key|secret|token)["']?\s*[:=]\s*["']?([A-Za-z0-9_\-]{16,})["']?/gi, replacement: 'key=[REDACTED_SECRET]' },
  // Local image paths and filesystem URIs
  { regex: /file:\/\/[^\s"',]+\.(?:jpg|jpeg|png|webp)/gi, replacement: '[REDACTED_LOCAL_IMAGE_URI]' },
  { regex: /(?:\/data\/user\/\d+\/[^\s"',]+|\/var\/mobile\/Containers\/[^\s"',]+)/gi, replacement: '[REDACTED_DEVICE_PATH]' },
  { regex: /(?:meals|scans)\/(?:meal|scan)_[a-zA-Z0-9_\-]+\.(?:jpg|jpeg|png|webp)/gi, replacement: '[REDACTED_IMAGE_RELPATH]' },
  // Base64 data strings
  { regex: /data:image\/[a-zA-Z0-9.+_-]+;base64,[A-Za-z0-9+/=]{20,}/gi, replacement: '[REDACTED_BASE64_IMAGE]' },
  // UUIDs representing device tokens
  { regex: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, replacement: '[REDACTED_UUID]' },
];

/**
 * Scrubs any sensitive PII strings from a given text.
 */
export function scrubText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let sanitized = text;
  for (const { regex, replacement } of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(regex, replacement);
  }
  return sanitized;
}

/**
 * Recursively sanitizes arbitrary objects, arrays, and primitive values.
 */
export function scrubPII<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return scrubText(value) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubPII(item)) as unknown as T;
  }

  if (typeof value === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const lowerKey = key.toLowerCase();
      // Block known PII keys entirely
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('token') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('api_key') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('signature') ||
        lowerKey.includes('deviceid') ||
        lowerKey.includes('device_id')
      ) {
        sanitizedObj[key] = '[REDACTED]';
      } else if (lowerKey === 'headers' && typeof val === 'object' && val !== null) {
        // Redact authorization or signature headers specifically
        const sanitizedHeaders: Record<string, unknown> = {};
        for (const [hKey, hVal] of Object.entries(val as Record<string, unknown>)) {
          const lhk = hKey.toLowerCase();
          if (lhk === 'authorization' || lhk === 'x-betteryou-signature' || lhk === 'x-betteryou-device-id') {
            sanitizedHeaders[hKey] = '[REDACTED]';
          } else {
            sanitizedHeaders[hKey] = scrubPII(hVal);
          }
        }
        sanitizedObj[key] = sanitizedHeaders;
      } else {
        sanitizedObj[key] = scrubPII(val);
      }
    }
    return sanitizedObj as T;
  }

  return value;
}

export type SentrySeverity = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';

export interface SentryBreadcrumbLike {
  message?: string;
  data?: Record<string, unknown>;
  category?: string;
  level?: SentrySeverity;
  timestamp?: number;
}

export interface SentryEventLike {
  user?: { id?: string; email?: string; username?: string; ip_address?: string };
  exception?: {
    values?: {
      value?: string;
      stacktrace?: {
        frames?: {
          filename?: string;
          function?: string;
        }[];
      };
    }[];
  };
  message?: string;
  extra?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  breadcrumbs?: SentryBreadcrumbLike[];
}

/**
 * Sentry beforeSend event filter: scrubs any PII from messages, stack traces, and extras,
 * and clears user identification (IP, username, email).
 */
export function scrubSentryEvent<T extends SentryEventLike>(event: T): T | null {
  if (!event) return null;

  // 1. Scrub user metadata: enforce total anonymity
  event.user = undefined;

  // 2. Scrub exception values and stack traces
  if (event.exception?.values) {
    for (const exception of event.exception.values) {
      if (exception.value) {
        exception.value = scrubText(exception.value);
      }
      if (exception.stacktrace?.frames) {
        for (const frame of exception.stacktrace.frames) {
          if (frame.filename) {
            frame.filename = scrubText(frame.filename);
          }
          if (frame.function) {
            frame.function = scrubText(frame.function);
          }
        }
      }
    }
  }

  // 3. Scrub top-level message
  if (event.message) {
    event.message = scrubText(event.message);
  }

  // 4. Scrub extra context and tags
  if (event.extra) {
    event.extra = scrubPII(event.extra);
  }
  if (event.tags) {
    event.tags = scrubPII(event.tags);
  }

  // 5. Scrub breadcrumbs attached to the event
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => scrubSentryBreadcrumb(crumb));
  }

  return event;
}

/**
 * Sentry beforeBreadcrumb filter: scrubs URLs, request bodies, and messages in breadcrumbs
 */
export function scrubSentryBreadcrumb<T extends SentryBreadcrumbLike>(breadcrumb: T): T {
  if (breadcrumb.message) {
    breadcrumb.message = scrubText(breadcrumb.message);
  }
  if (breadcrumb.data) {
    breadcrumb.data = scrubPII(breadcrumb.data);
  }
  return breadcrumb;
}

let isInitialized = false;

export interface TelemetryConfig {
  dsn?: string;
  enabled?: boolean;
}

/**
 * Initializes privacy-safe Sentry error monitoring
 */
export function initTelemetry(config?: TelemetryConfig): void {
  const dsn = config?.dsn || process.env.EXPO_PUBLIC_SENTRY_DSN;
  const isEnabled = config?.enabled ?? (Boolean(dsn) && !__DEV__);

  if (isInitialized || !isEnabled || !dsn) {
    return;
  }

  import('@sentry/react-native')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        debug: false,
        sendDefaultPii: false,
        enableAutoSessionTracking: true,
        tracesSampleRate: 0.1,
        beforeSend: (event) => scrubSentryEvent(event as unknown as SentryEventLike) as unknown as SentryTypes.ErrorEvent,
        beforeBreadcrumb: (breadcrumb) => scrubSentryBreadcrumb(breadcrumb as unknown as SentryBreadcrumbLike) as unknown as SentryTypes.Breadcrumb,
      });
      isInitialized = true;
    })
    .catch((error) => {
      console.warn('[Telemetry] Sentry initialization skipped or failed:', error);
    });
}

/**
 * Safe exception reporter that scrubs error messages before reporting
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  try {
    const sanitizedContext = context ? scrubPII(context) : undefined;
    if (isInitialized) {
      import('@sentry/react-native')
        .then((Sentry) => {
          Sentry.captureException(error, sanitizedContext ? { extra: sanitizedContext } : undefined);
        })
        .catch(() => {});
    } else if (__DEV__) {
      console.error('[Telemetry Mock Error]:', error, sanitizedContext);
    }
  } catch {
    // Never crash on telemetry failures
  }
}

/**
 * Safe message logger for notable non-error events
 */
export function captureMessage(message: string, level: SentrySeverity = 'info'): void {
  try {
    const cleanMessage = scrubText(message);
    if (isInitialized) {
      import('@sentry/react-native')
        .then((Sentry) => {
          Sentry.captureMessage(cleanMessage, level as SentryTypes.SeverityLevel);
        })
        .catch(() => {});
    } else if (__DEV__) {
      console.log(`[Telemetry ${level.toUpperCase()}]:`, cleanMessage);
    }
  } catch {
    // Fail silently
  }
}

export function isTelemetryInitialized(): boolean {
  return isInitialized;
}
