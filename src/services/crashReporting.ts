import * as Sentry from '@sentry/react';

/**
 * Lightweight crash reporting, called from the existing ErrorBoundary's
 * componentDidCatch (src/components/ErrorBoundary.tsx) — this file only
 * supplies the "send it somewhere" half; the boundary's own structure is
 * untouched.
 *
 * Inert unless VITE_SENTRY_DSN is configured: no DSN means initCrashReporting()
 * and reportError() are both no-ops, so nothing changes for anyone who
 * hasn't set one up. No fabricated credentials, no new required config.
 */
let initialized = false;

export function initCrashReporting(): void {
  const dsn = import.meta.env?.VITE_SENTRY_DSN;
  if (!dsn || initialized) return;
  Sentry.init({ dsn });
  initialized = true;
}

export function reportError(error: Error, errorInfo?: { componentStack?: string | null }): void {
  if (!initialized) return;
  Sentry.captureException(error, {
    extra: errorInfo?.componentStack ? { componentStack: errorInfo.componentStack } : undefined,
  });
}
