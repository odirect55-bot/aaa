/**
 * Logging shim.
 *
 * Scheduling problems are surfaced to the user through the store's
 * `lastSyncError`, so this only has to keep the developer console useful and
 * stay silent in release builds.
 */

export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

export const logger = {
  info(scope: string, message: string) {
    if (__DEV__) {
      console.log(`[${scope}] ${message}`);
    }
  },
  warn(scope: string, message: string) {
    if (__DEV__) {
      console.warn(`[${scope}] ${message}`);
    }
  },
  error(scope: string, error: unknown) {
    if (__DEV__) {
      console.error(`[${scope}] ${describeError(error)}`);
    }
  },
};
