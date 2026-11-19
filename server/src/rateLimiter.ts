export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  reason?: string;
}

export interface RateLimiter {
  check(deviceId: string, now?: number): Promise<RateLimitResult> | RateLimitResult;
  reset(): Promise<void> | void;
}

export interface InMemoryRateLimitEntry {
  windowStart: number;
  count: number;
  dailyWindowStart: number;
  dailyCount: number;
}

export class InMemoryRateLimiter implements RateLimiter {
  private store = new Map<string, InMemoryRateLimitEntry>();
  private readonly minuteLimit: number;
  private readonly dailyLimit: number;

  constructor(
    minuteLimit = parseInt(process.env.RATE_LIMIT_MINUTE || '15', 10),
    dailyLimit = parseInt(process.env.RATE_LIMIT_DAILY || '150', 10)
  ) {
    this.minuteLimit = minuteLimit;
    this.dailyLimit = dailyLimit;
  }

  check(deviceId: string, now: number = Date.now()): RateLimitResult {
    // Periodic cleanup of stale devices older than 24h
    if (this.store.size > 2000) {
      const expiredCutoff = now - 24 * 60 * 60 * 1000;
      for (const [id, e] of this.store.entries()) {
        if (e.dailyWindowStart < expiredCutoff) {
          this.store.delete(id);
        }
      }
    }

    let entry = this.store.get(deviceId);
    if (!entry) {
      entry = {
        windowStart: now,
        count: 0,
        dailyWindowStart: now,
        dailyCount: 0,
      };
      this.store.set(deviceId, entry);
    }

    // Reset 1-minute window
    if (now - entry.windowStart > 60 * 1000) {
      entry.windowStart = now;
      entry.count = 0;
    }

    // Reset 24-hour window
    if (now - entry.dailyWindowStart > 24 * 60 * 60 * 1000) {
      entry.dailyWindowStart = now;
      entry.dailyCount = 0;
    }

    // Check 1-minute limit
    if (entry.count >= this.minuteLimit) {
      const retryAfter = Math.ceil((60 * 1000 - (now - entry.windowStart)) / 1000);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, retryAfter),
        reason: `Rate limit exceeded: ${this.minuteLimit} requests per minute allowed per device.`,
      };
    }

    // Check 24-hour quota
    if (entry.dailyCount >= this.dailyLimit) {
      const retryAfter = Math.ceil((24 * 60 * 60 * 1000 - (now - entry.dailyWindowStart)) / 1000);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, retryAfter),
        reason: `Daily quota exceeded: ${this.dailyLimit} requests per day allowed per device.`,
      };
    }

    entry.count += 1;
    entry.dailyCount += 1;
    return { allowed: true };
  }

  reset(): void {
    this.store.clear();
  }
}

/**
 * Upstash Redis implementation for multi-instance deployments.
 * Automatically used when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
 */
export class UpstashRedisRateLimiter implements RateLimiter {
  private readonly url: string;
  private readonly token: string;
  private readonly minuteLimit: number;
  private readonly dailyLimit: number;

  constructor(
    url = process.env.UPSTASH_REDIS_REST_URL || '',
    token = process.env.UPSTASH_REDIS_REST_TOKEN || '',
    minuteLimit = parseInt(process.env.RATE_LIMIT_MINUTE || '15', 10),
    dailyLimit = parseInt(process.env.RATE_LIMIT_DAILY || '150', 10)
  ) {
    this.url = url.replace(/\/$/, '');
    this.token = token;
    this.minuteLimit = minuteLimit;
    this.dailyLimit = dailyLimit;
  }

  async check(deviceId: string, now: number = Date.now()): Promise<RateLimitResult> {
    if (!this.url || !this.token) {
      // Fallback to in-memory if unconfigured
      return new InMemoryRateLimiter(this.minuteLimit, this.dailyLimit).check(deviceId, now);
    }

    const minKey = `rate:min:${deviceId}:${Math.floor(now / 60000)}`;
    const dayKey = `rate:day:${deviceId}:${Math.floor(now / 86400000)}`;

    try {
      const pipelineCommands = [
        ['INCR', minKey],
        ['EXPIRE', minKey, 65],
        ['INCR', dayKey],
        ['EXPIRE', dayKey, 86500],
      ];

      const res = await fetch(`${this.url}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pipelineCommands),
      });

      if (!res.ok) {
        console.warn('[UpstashRateLimiter] HTTP error from Redis pipeline:', res.status);
        return { allowed: true }; // Fail-open to avoid service outage if Redis is down
      }

      const results = (await res.json()) as { result: number }[];
      const minCount = results[0]?.result ?? 1;
      const dayCount = results[2]?.result ?? 1;

      if (minCount > this.minuteLimit) {
        return {
          allowed: false,
          retryAfterSeconds: 60 - Math.floor((now % 60000) / 1000),
          reason: `Rate limit exceeded: ${this.minuteLimit} requests per minute allowed per device.`,
        };
      }

      if (dayCount > this.dailyLimit) {
        return {
          allowed: false,
          retryAfterSeconds: 86400 - Math.floor((now % 86400000) / 1000),
          reason: `Daily quota exceeded: ${this.dailyLimit} requests per day allowed per device.`,
        };
      }

      return { allowed: true };
    } catch (err: unknown) {
      console.warn('[UpstashRateLimiter] Exception checking Redis rate limit:', err);
      return { allowed: true };
    }
  }

  async reset(): Promise<void> {
    // In Upstash, keys expire with TTL; reset is a no-op or handled via FLUSHDB if necessary
  }
}

export function createRateLimiter(): RateLimiter {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new UpstashRedisRateLimiter();
  }
  return new InMemoryRateLimiter();
}
