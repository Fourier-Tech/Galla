interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// Tier 1: Email + Password (5 attempts per 15 minutes)
const EMAIL_MAX_ATTEMPTS = 5;
const EMAIL_WINDOW_MS = 15 * 60 * 1000;
const emailAttempts = new Map<string, RateLimitRecord>();

// Tier 2: Role Code / PIN (5 attempts per 10 minutes)
const PIN_MAX_ATTEMPTS = 5;
const PIN_WINDOW_MS = 10 * 60 * 1000;
const pinAttempts = new Map<string, RateLimitRecord>();

// Generic helper
function checkStore(
  store: Map<string, RateLimitRecord>,
  key: string,
  maxAttempts: number
) {
  const now = Date.now();
  const record = store.get(key);

  if (!record) {
    return { allowed: true, remainingAttempts: maxAttempts, retryAfterSeconds: 0 };
  }

  if (now > record.resetAt) {
    store.delete(key);
    return { allowed: true, remainingAttempts: maxAttempts, retryAfterSeconds: 0 };
  }

  if (record.count >= maxAttempts) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
  }

  return {
    allowed: true,
    remainingAttempts: maxAttempts - record.count,
    retryAfterSeconds: 0,
  };
}

function recordFailInStore(
  store: Map<string, RateLimitRecord>,
  key: string,
  maxAttempts: number,
  windowMs: number
) {
  const now = Date.now();
  const record = store.get(key);

  if (!record || now > record.resetAt) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remainingAttempts: maxAttempts - 1,
      retryAfterSeconds: 0,
    };
  }

  record.count += 1;
  const remaining = Math.max(0, maxAttempts - record.count);
  const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);

  return {
    allowed: record.count < maxAttempts,
    remainingAttempts: remaining,
    retryAfterSeconds: record.count >= maxAttempts ? retryAfterSeconds : 0,
  };
}

/* =========================================================================
   Tier 1: Email + Password Rate Limiting
   ========================================================================= */

export function checkEmailLoginRateLimit(identifier: string) {
  return checkStore(emailAttempts, identifier, EMAIL_MAX_ATTEMPTS);
}

export function recordFailedEmailLogin(identifier: string) {
  return recordFailInStore(emailAttempts, identifier, EMAIL_MAX_ATTEMPTS, EMAIL_WINDOW_MS);
}

export function resetEmailLoginRateLimit(identifier: string): void {
  emailAttempts.delete(identifier);
}

/* =========================================================================
   Tier 2: Role Code / PIN Rate Limiting
   ========================================================================= */

export function checkRolePinRateLimit(identifier: string) {
  return checkStore(pinAttempts, identifier, PIN_MAX_ATTEMPTS);
}

export function recordFailedRolePin(identifier: string) {
  return recordFailInStore(pinAttempts, identifier, PIN_MAX_ATTEMPTS, PIN_WINDOW_MS);
}

export function resetRolePinRateLimit(identifier: string): void {
  pinAttempts.delete(identifier);
}

// Backward compatibility aliases
export const checkRateLimit = checkEmailLoginRateLimit;
export const recordFailedAttempt = recordFailedEmailLogin;
export const resetRateLimit = resetEmailLoginRateLimit;
