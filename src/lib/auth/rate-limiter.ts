interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// In-memory IP tracking store
const ipAttempts = new Map<string, RateLimitRecord>();

/**
 * Checks whether the specified IP is currently rate-limited.
 */
export function checkRateLimit(ip: string): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const record = ipAttempts.get(ip);

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, retryAfterSeconds: 0 };
  }

  // Window expired — clear record
  if (now > record.resetAt) {
    ipAttempts.delete(ip);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, retryAfterSeconds: 0 };
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
  }

  return {
    allowed: true,
    remainingAttempts: MAX_ATTEMPTS - record.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Records a failed login attempt for the given IP address.
 */
export function recordFailedAttempt(ip: string): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const record = ipAttempts.get(ip);

  if (!record || now > record.resetAt) {
    ipAttempts.set(ip, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS - 1,
      retryAfterSeconds: 0,
    };
  }

  record.count += 1;
  const remaining = Math.max(0, MAX_ATTEMPTS - record.count);
  const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);

  return {
    allowed: record.count < MAX_ATTEMPTS,
    remainingAttempts: remaining,
    retryAfterSeconds: record.count >= MAX_ATTEMPTS ? retryAfterSeconds : 0,
  };
}

/**
 * Resets failed attempts after a successful login.
 */
export function resetRateLimit(ip: string): void {
  ipAttempts.delete(ip);
}
