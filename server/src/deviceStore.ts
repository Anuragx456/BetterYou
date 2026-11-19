import { createHash } from 'crypto';

export interface DeviceRecord {
  deviceId: string;
  secret: string;
  secretHash: string;
  registeredAt: number;
}

export interface DeviceStore {
  registerDevice(deviceId: string, secret: string): Promise<DeviceRecord> | DeviceRecord;
  getDevice(deviceId: string): Promise<DeviceRecord | null> | DeviceRecord | null;
  reset(): Promise<void> | void;
}

export class InMemoryDeviceStore implements DeviceStore {
  private devices = new Map<string, DeviceRecord>();

  registerDevice(deviceId: string, secret: string): DeviceRecord {
    const secretHash = createHash('sha256').update(secret).digest('hex');
    const record: DeviceRecord = {
      deviceId,
      secret,
      secretHash,
      registeredAt: Date.now(),
    };
    this.devices.set(deviceId, record);
    return record;
  }

  getDevice(deviceId: string): DeviceRecord | null {
    return this.devices.get(deviceId) ?? null;
  }

  reset(): void {
    this.devices.clear();
  }
}

/**
 * Upstash Redis Device Store implementation for multi-instance deployments.
 */
export class UpstashRedisDeviceStore implements DeviceStore {
  private readonly url: string;
  private readonly token: string;
  private inMemoryFallback = new InMemoryDeviceStore();

  constructor(
    url = process.env.UPSTASH_REDIS_REST_URL || '',
    token = process.env.UPSTASH_REDIS_REST_TOKEN || ''
  ) {
    this.url = url.replace(/\/$/, '');
    this.token = token;
  }

  async registerDevice(deviceId: string, secret: string): Promise<DeviceRecord> {
    const secretHash = createHash('sha256').update(secret).digest('hex');
    const record: DeviceRecord = {
      deviceId,
      secret,
      secretHash,
      registeredAt: Date.now(),
    };

    if (!this.url || !this.token) {
      return this.inMemoryFallback.registerDevice(deviceId, secret);
    }

    try {
      await fetch(`${this.url}/set/device:${encodeURIComponent(deviceId)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(JSON.stringify(record)),
      });
    } catch (err: unknown) {
      console.warn('[UpstashDeviceStore] Failed to write to Redis:', err);
      return this.inMemoryFallback.registerDevice(deviceId, secret);
    }

    return record;
  }

  async getDevice(deviceId: string): Promise<DeviceRecord | null> {
    if (!this.url || !this.token) {
      return this.inMemoryFallback.getDevice(deviceId);
    }

    try {
      const res = await fetch(`${this.url}/get/device:${encodeURIComponent(deviceId)}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!res.ok) {
        return this.inMemoryFallback.getDevice(deviceId);
      }

      const json = (await res.json()) as { result: string | null };
      if (!json.result) return null;
      return JSON.parse(json.result) as DeviceRecord;
    } catch (err: unknown) {
      console.warn('[UpstashDeviceStore] Failed to read from Redis:', err);
      return this.inMemoryFallback.getDevice(deviceId);
    }
  }

  async reset(): Promise<void> {
    this.inMemoryFallback.reset();
  }
}

export function createDeviceStore(): DeviceStore {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new UpstashRedisDeviceStore();
  }
  return new InMemoryDeviceStore();
}
