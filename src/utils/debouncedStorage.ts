import { PersistStorage, StateStorage, StorageValue } from 'zustand/middleware';
import type { WorkoutSession } from '../types';
import { safeAsyncStorage } from './storage';

export interface DebouncedStateStorage extends StateStorage {
  flush: () => Promise<void>;
}

/**
 * Delays setItem so a burst of active-workout edits becomes one disk write.
 * flush() writes the latest pending value immediately.
 */
export function createDebouncedStateStorage(
  delayMs: number,
  backing: StateStorage = safeAsyncStorage
): DebouncedStateStorage {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { name: string; value: string } | null = null;

  const flush = async (): Promise<void> => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const current = pending;
    pending = null;
    if (!current) return;
    await backing.setItem(current.name, current.value);
  };

  return {
    getItem: (name) => backing.getItem(name),
    setItem: (name, value) => {
      pending = { name, value };
      if (delayMs <= 0) {
        return flush();
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void flush();
      }, delayMs);
      return Promise.resolve();
    },
    removeItem: async (name) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pending = null;
      await backing.removeItem(name);
    },
    flush,
  };
}

const persistDelay =
  typeof window === 'undefined' && !(globalThis as Record<string, unknown>).nativeCallSyncHook
    ? 0
    : 400;

export const activeWorkoutStorage = createDebouncedStateStorage(persistDelay);

interface ActiveWorkoutPersisted {
  activeWorkout: WorkoutSession | null;
  streakDays: number;
  lastActiveWorkoutDate?: string;
}

/**
 * Zustand persist stringifies before calling StateStorage. This storage keeps the
 * latest draft object and JSON.stringifies once, when the debounce flushes.
 */
export function createDebouncedJsonPersistStorage<S>(
  delayMs: number,
  backing: StateStorage = safeAsyncStorage
): PersistStorage<S> & { flush: () => Promise<void> } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { name: string; value: StorageValue<S> } | null = null;

  const flush = async (): Promise<void> => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const current = pending;
    pending = null;
    if (!current) return;
    await backing.setItem(current.name, JSON.stringify(current.value));
  };

  return {
    getItem: async (name) => {
      if (pending?.name === name) return pending.value;
      const raw = await backing.getItem(name);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StorageValue<S>;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      pending = { name, value };
      if (delayMs <= 0) {
        return flush();
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void flush();
      }, delayMs);
      return Promise.resolve();
    },
    removeItem: async (name) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (pending?.name === name) pending = null;
      await backing.removeItem(name);
    },
    flush,
  };
}

export const activeWorkoutPersistStorage =
  createDebouncedJsonPersistStorage<ActiveWorkoutPersisted>(persistDelay);

export function flushActiveWorkoutPersist(): Promise<void> {
  return activeWorkoutPersistStorage.flush();
}
