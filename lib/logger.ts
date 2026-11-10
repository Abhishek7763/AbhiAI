import * as Sentry from '@sentry/nextjs';

const isDevelopment = process.env.NODE_ENV !== 'production';
const sentryConfigured = Boolean(
  process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
);

function normalizeError(value: unknown): Error | null {
  if (value instanceof Error) return value;
  if (value === undefined || value === null) return null;
  return new Error(typeof value === 'string' ? value : String(value));
}

function captureWarning(message: string, error?: unknown) {
  if (!sentryConfigured) return;
  const normalized = normalizeError(error);
  if (normalized) {
    Sentry.captureException(normalized, {
      level: 'warning',
      tags: { source: 'abhiai-logger' },
    });
    return;
  }
  Sentry.captureMessage(message, {
    level: 'warning',
    tags: { source: 'abhiai-logger' },
  });
}

function captureError(message: string, error?: unknown) {
  if (!sentryConfigured) return;
  const normalized = normalizeError(error);
  if (normalized) {
    Sentry.captureException(normalized, {
      level: 'error',
      tags: { source: 'abhiai-logger' },
    });
    return;
  }
  Sentry.captureMessage(message, {
    level: 'error',
    tags: { source: 'abhiai-logger' },
  });
}

export const logger = {
  debug(message: string, ...details: unknown[]) {
    if (isDevelopment) console.debug(`[AbhiAI] ${message}`, ...details);
  },
  info(message: string, ...details: unknown[]) {
    if (isDevelopment) console.info(`[AbhiAI] ${message}`, ...details);
  },
  warn(message: string, error?: unknown) {
    console.warn(`[AbhiAI] ${message}`, error ?? '');
    captureWarning(message, error);
  },
  error(message: string, error?: unknown) {
    console.error(`[AbhiAI] ${message}`, error ?? '');
    captureError(message, error);
  },
};
