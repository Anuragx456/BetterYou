import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Storage representation of an active registered device.
 *
 * DUAL STORAGE REDESIGN JUSTIFICATION:
 * Previously, DeviceRecord stored both `secret` and `secretHash` (sha256(secret)).
 * This dual storage was redundant and provided zero architectural benefit:
 * 1. HMAC-SHA256 signature verification in the proxy middleware requires the plaintext
 *    device secret to compute createHmac('sha256', secret) over canonical request data.
 *    A one-way SHA-256 hash cannot be used to sign or verify arbitrary HMAC requests.
 * 2. Storing both secret and secretHash together on the same record created an illusion of
 *    security without protection: if the record was compromised, the raw secret was exposed;
 *    and if only secretHash were kept, request authentication would be mathematically impossible.
 *
 * Therefore, we retain exactly one representation: `secret`.
 * In-memory dev store holds this secret in process RAM only.
 * In multi-instance / production environments (Upstash Redis), the secret is NEVER stored in
 * plaintext: it is encrypted at rest using AES-256-GCM with a server-held DEVICE_STORE_ENCRYPTION_KEY,
 * storing only iv, ciphertext, and authTag.
 */
export interface DeviceRecord {
  deviceId: string;
  secret: string;
  registeredAt: number;
}

export interface EncryptedDevicePayload {
  deviceId: string;
  registeredAt: number;
  encrypted: {
    iv: string;         // hex (12 bytes)
    ciphertext: string; // hex
    tag: string;        // hex (16 bytes)
  };
}

export interface DeviceStore {
  registerDevice(deviceId: string, secret: string): Promise<DeviceRecord> | DeviceRecord;
  getDevice(deviceId: string): Promise<DeviceRecord | null> | DeviceRecord | null;
  reset(): Promise<void> | void;
}

/**
 * Parses a 32-byte encryption key from hex (64 chars), base64 (44 chars), or raw 32-byte string.
 */
export function parseEncryptionKey(rawKey?: string): Buffer | null {
  if (!rawKey) return null;
  const trimmed = rawKey.trim();
  if (trimmed.length === 64 && /^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  if (trimmed.length === 44 && /^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    const buf = Buffer.from(trimmed, 'base64');
    if (buf.length === 32) return buf;
  }
  if (Buffer.byteLength(trimmed, 'utf8') === 32) {
    return Buffer.from(trimmed, 'utf8');
  }
  return null;
}

/**
 * Encrypts a device secret using AES-256-GCM.
 */
export function encryptDeviceSecret(
  secret: string,
  key: Buffer
): { iv: string; ciphertext: string; tag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encryptedBuf = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    ciphertext: encryptedBuf.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypts a device secret using AES-256-GCM.
 * Fails closed and returns null if tampering, corruption, or invalid authTag is detected.
 */
export function decryptDeviceSecret(
  encrypted: { iv: string; ciphertext: string; tag: string },
  key: Buffer
): string | null {
  try {
    const ivBuf = Buffer.from(encrypted.iv, 'hex');
    const ciphertextBuf = Buffer.from(encrypted.ciphertext, 'hex');
    const tagBuf = Buffer.from(encrypted.tag, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, ivBuf);
    decipher.setAuthTag(tagBuf);
    const decryptedBuf = Buffer.concat([decipher.update(ciphertextBuf), decipher.final()]);
    return decryptedBuf.toString('utf8');
  } catch (err: unknown) {
    console.warn('[DeviceStore] Failed to decrypt device secret (tampered ciphertext or auth tag):', err);
    return null;
  }
}

export class InMemoryDeviceStore implements DeviceStore {
  private devices = new Map<string, DeviceRecord>();

  registerDevice(deviceId: string, secret: string): DeviceRecord {
    const record: DeviceRecord = {
      deviceId,
      secret,
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
 * Encrypts every secret at rest with AES-256-GCM using DEVICE_STORE_ENCRYPTION_KEY.
 * Never writes raw secrets to Redis.
 */
export class UpstashRedisDeviceStore implements DeviceStore {
  private readonly url: string;
  private readonly token: string;
  private readonly encryptionKey: Buffer | null;
  private inMemoryFallback = new InMemoryDeviceStore();

  constructor(
    url = process.env.UPSTASH_REDIS_REST_URL || '',
    token = process.env.UPSTASH_REDIS_REST_TOKEN || '',
    encryptionKey = process.env.DEVICE_STORE_ENCRYPTION_KEY || ''
  ) {
    this.url = url.replace(/\/$/, '');
    this.token = token;
    this.encryptionKey = parseEncryptionKey(encryptionKey);
  }

  async registerDevice(deviceId: string, secret: string): Promise<DeviceRecord> {
    const isProduction =
      process.env.NODE_ENV === 'production' || process.env.PROXY_ENV === 'production';

    if (!this.url || !this.token) {
      return this.inMemoryFallback.registerDevice(deviceId, secret);
    }

    if (!this.encryptionKey) {
      if (isProduction) {
        throw new Error(
          '[UpstashDeviceStore] Fail closed: DEVICE_STORE_ENCRYPTION_KEY (32-byte hex/base64) is required in production.'
        );
      }
      console.warn(
        '[UpstashDeviceStore] DEVICE_STORE_ENCRYPTION_KEY not set. Falling back to in-memory store in dev.'
      );
      return this.inMemoryFallback.registerDevice(deviceId, secret);
    }

    const encrypted = encryptDeviceSecret(secret, this.encryptionKey);
    const payload: EncryptedDevicePayload = {
      deviceId,
      registeredAt: Date.now(),
      encrypted,
    };

    try {
      await fetch(`${this.url}/set/device:${encodeURIComponent(deviceId)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(JSON.stringify(payload)),
      });
    } catch (err: unknown) {
      console.warn('[UpstashDeviceStore] Failed to write to Redis:', err);
      return this.inMemoryFallback.registerDevice(deviceId, secret);
    }

    return {
      deviceId,
      secret,
      registeredAt: payload.registeredAt,
    };
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

      const parsed = JSON.parse(json.result) as EncryptedDevicePayload | (DeviceRecord & { encrypted?: unknown });

      // If stored with AES-256-GCM encryption payload
      if ('encrypted' in parsed && parsed.encrypted && typeof parsed.encrypted === 'object') {
        if (!this.encryptionKey) {
          console.warn('[UpstashDeviceStore] Cannot decrypt record: DEVICE_STORE_ENCRYPTION_KEY not set.');
          return null;
        }
        const secret = decryptDeviceSecret(
          parsed.encrypted as { iv: string; ciphertext: string; tag: string },
          this.encryptionKey
        );
        if (!secret) {
          // Tampered ciphertext or authentication tag mismatch: fail closed!
          return null;
        }
        return {
          deviceId: parsed.deviceId,
          secret,
          registeredAt: parsed.registeredAt,
        };
      }

      // Legacy unencrypted record: reject in production
      const isProduction =
        process.env.NODE_ENV === 'production' || process.env.PROXY_ENV === 'production';
      if (isProduction) {
        console.warn('[UpstashDeviceStore] Rejecting legacy unencrypted device record in production.');
        return null;
      }

      return parsed as DeviceRecord;
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
