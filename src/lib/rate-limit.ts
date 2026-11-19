export const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

interface RateLimitEntry {
  attempts: number;
  windowStartMs: number;
}

export interface RateLimitCheckResult {
  blocked: boolean;
  retryAfterSeconds: number;
}

export interface LoginRateLimiter {
  check(ip: string, nowMs?: number): RateLimitCheckResult;
  recordFailure(ip: string, nowMs?: number): { attempts: number; blocked: boolean };
  reset(ip: string): void;
  clear(): void;
}

export function createLoginRateLimiter(options?: {
  maxAttempts?: number;
  windowMs?: number;
}): LoginRateLimiter {
  const maxAttempts = options?.maxAttempts ?? LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
  const windowMs = options?.windowMs ?? LOGIN_RATE_LIMIT_WINDOW_MS;
  const store = new Map<string, RateLimitEntry>();

  function getActiveEntry(ip: string, nowMs: number): RateLimitEntry | null {
    const entry = store.get(ip);
    if (!entry) return null;
    if (nowMs - entry.windowStartMs >= windowMs) {
      store.delete(ip);
      return null;
    }
    return entry;
  }

  return {
    check(ip: string, nowMs = Date.now()): RateLimitCheckResult {
      const entry = getActiveEntry(ip, nowMs);
      if (!entry || entry.attempts < maxAttempts) {
        return { blocked: false, retryAfterSeconds: 0 };
      }
      const remainingMs = entry.windowStartMs + windowMs - nowMs;
      return {
        blocked: true,
        retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
      };
    },

    recordFailure(ip: string, nowMs = Date.now()) {
      const existing = getActiveEntry(ip, nowMs);
      if (!existing) {
        store.set(ip, { attempts: 1, windowStartMs: nowMs });
        return { attempts: 1, blocked: 1 >= maxAttempts };
      }
      existing.attempts += 1;
      return {
        attempts: existing.attempts,
        blocked: existing.attempts >= maxAttempts,
      };
    },

    reset(ip: string) {
      store.delete(ip);
    },

    clear() {
      store.clear();
    },
  };
}

export function extractClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
}

export const loginRateLimiter = createLoginRateLimiter();
