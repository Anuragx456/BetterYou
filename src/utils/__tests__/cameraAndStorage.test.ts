import { describe, expect, it } from 'bun:test';
import { pickPictureSize } from '../cameraPictureSize';
import { createBarcodeScanGuard } from '../barcodeScanGuard';
import { createDebouncedJsonPersistStorage, createDebouncedStateStorage } from '../debouncedStorage';
import { StateStorage } from 'zustand/middleware';

describe('Camera picture size', () => {
  it('picks a long edge near 1024px and skips full-sensor frames', () => {
    const picked = pickPictureSize(['1920x1080', '1280x720', '4000x3000', '640x480']);
    expect(picked).toBe('1280x720');
  });

  it('prefers the frame closest to 1024px when several sizes are in range', () => {
    expect(pickPictureSize(['1280x720', '1024x768', '1920x1080'])).toBe('1024x768');
  });

  it('returns undefined when the device reports no WxH sizes', () => {
    expect(pickPictureSize(['High', 'Photo'])).toBeUndefined();
  });
});

describe('Barcode scan guard', () => {
  it('drops extra frames until the in-flight scan is released', () => {
    const guard = createBarcodeScanGuard();
    expect(guard.tryAcquire()).toBe(true);
    expect(guard.tryAcquire()).toBe(false);
    guard.release();
    expect(guard.tryAcquire()).toBe(true);
  });
});

describe('Debounced workout persist', () => {
  it('holds setItem until flush writes the latest value', async () => {
    const saved = new Map<string, string>();
    const backing: StateStorage = {
      getItem: async (name) => saved.get(name) ?? null,
      setItem: async (name, value) => {
        saved.set(name, value);
      },
      removeItem: async (name) => {
        saved.delete(name);
      },
    };
    const storage = createDebouncedStateStorage(400, backing);

    await storage.setItem('betteryou-active-workout-draft', 'first');
    await storage.setItem('betteryou-active-workout-draft', 'latest');
    expect(saved.has('betteryou-active-workout-draft')).toBe(false);

    await storage.flush();
    expect(saved.get('betteryou-active-workout-draft')).toBe('latest');
  });

  it('stringifies the latest draft once when the debounce flushes', async () => {
    let writes = 0;
    const backing: StateStorage = {
      getItem: async () => null,
      setItem: async () => {
        writes += 1;
      },
      removeItem: async () => {},
    };
    const storage = createDebouncedJsonPersistStorage<{ n: number }>(400, backing);
    await storage.setItem('draft', { state: { n: 1 }, version: 0 });
    await storage.setItem('draft', { state: { n: 2 }, version: 0 });
    expect(writes).toBe(0);
    await storage.flush();
    expect(writes).toBe(1);
    const hydrated = await storage.getItem('draft');
    expect(hydrated).toBeNull();
  });
});
