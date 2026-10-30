import AsyncStorage from '@react-native-async-storage/async-storage';
import { StateStorage } from 'zustand/middleware';

const memoryFallback = new Map<string, string>();

/**
 * Robust AsyncStorage wrapper that gracefully absorbs storage quota exceptions,
 * SSR/node/native bridge latency, and test environment limits.
 */
export const safeAsyncStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      if (typeof window === 'undefined' && !(globalThis as Record<string, unknown>).nativeCallSyncHook) {
        return memoryFallback.get(name) ?? null;
      }
      return await AsyncStorage.getItem(name);
    } catch {
      return memoryFallback.get(name) ?? null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      memoryFallback.set(name, value);
      if (typeof window === 'undefined' && !(globalThis as Record<string, unknown>).nativeCallSyncHook) {
        return;
      }
      await AsyncStorage.setItem(name, value);
    } catch {
      // Retained in memory fallback
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      memoryFallback.delete(name);
      if (typeof window === 'undefined' && !(globalThis as Record<string, unknown>).nativeCallSyncHook) {
        return;
      }
      await AsyncStorage.removeItem(name);
    } catch {
      // Retained in memory fallback
    }
  },
};
