import { describe, expect, it } from 'bun:test';
import { checkForUpdatesOnLaunch, shouldCheckForUpdates } from '../checkForUpdates';

describe('OTA Updates Gating & Check Utilities', () => {
  it('correctly gates OTA updates check with pure conditions', () => {
    // Should skip in development mode
    expect(
      shouldCheckForUpdates({ isDev: true, isEnabled: true, isMidWorkout: false })
    ).toBe(false);

    // Should skip when updates are disabled or in Expo Go
    expect(
      shouldCheckForUpdates({ isDev: false, isEnabled: false, isMidWorkout: false })
    ).toBe(false);

    // Should NEVER run mid-workout to prevent disrupting active sets/reps
    expect(
      shouldCheckForUpdates({ isDev: false, isEnabled: true, isMidWorkout: true })
    ).toBe(false);

    // Only runs in production when enabled and not mid-workout
    expect(
      shouldCheckForUpdates({ isDev: false, isEnabled: true, isMidWorkout: false })
    ).toBe(true);
  });

  it('handles update check when app is already up to date', async () => {
    const mockUpdates = {
      isEnabled: true,
      checkForUpdateAsync: async () => ({ isAvailable: false }),
      fetchUpdateAsync: async () => ({ isNew: false }),
      reloadAsync: async () => {},
    } as unknown as typeof import('expo-updates');

    // Override __DEV__ for test
    const originalDev = (globalThis as Record<string, unknown>).__DEV__;
    (globalThis as Record<string, unknown>).__DEV__ = false;

    try {
      const res = await checkForUpdatesOnLaunch(mockUpdates);
      expect(res.status).toBe('checked');
      expect(res.reason).toContain('up to date');
    } finally {
      (globalThis as Record<string, unknown>).__DEV__ = originalDev;
    }
  });

  it('downloads new update and prepares prompt when update is available', async () => {
    let reloaded = false;
    const mockUpdates = {
      isEnabled: true,
      checkForUpdateAsync: async () => ({ isAvailable: true }),
      fetchUpdateAsync: async () => ({ isNew: true }),
      reloadAsync: async () => {
        reloaded = true;
      },
    } as unknown as typeof import('expo-updates');

    const originalDev = (globalThis as Record<string, unknown>).__DEV__;
    (globalThis as Record<string, unknown>).__DEV__ = false;

    try {
      const res = await checkForUpdatesOnLaunch(mockUpdates);
      expect(res.status).toBe('downloaded');
      expect(reloaded).toBe(false); // Should prompt, never force restart automatically
    } finally {
      (globalThis as Record<string, unknown>).__DEV__ = originalDev;
    }
  });

  it('handles network / update check errors gracefully without throwing', async () => {
    const mockUpdates = {
      isEnabled: true,
      checkForUpdateAsync: async () => {
        throw new Error('EAS update server unreachable');
      },
      fetchUpdateAsync: async () => ({ isNew: false }),
      reloadAsync: async () => {},
    } as unknown as typeof import('expo-updates');

    const originalDev = (globalThis as Record<string, unknown>).__DEV__;
    (globalThis as Record<string, unknown>).__DEV__ = false;

    try {
      const res = await checkForUpdatesOnLaunch(mockUpdates);
      expect(res.status).toBe('error');
      expect(res.reason).toContain('EAS update server unreachable');
    } finally {
      (globalThis as Record<string, unknown>).__DEV__ = originalDev;
    }
  });
});
