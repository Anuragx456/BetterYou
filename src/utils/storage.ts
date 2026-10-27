import AsyncStorage from '@react-native-async-storage/async-storage';
import { StateStorage } from 'zustand/middleware';

/**
 * Robust AsyncStorage wrapper that gracefully absorbs storage quota exceptions,
 * SSR/native bridge latency, and parsing errors.
 */
export const safeAsyncStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(name);
    } catch (error) {
      console.warn(`[safeAsyncStorage] getItem failed for key "${name}":`, error);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch (error) {
      console.warn(`[safeAsyncStorage] setItem failed for key "${name}":`, error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(name);
    } catch (error) {
      console.warn(`[safeAsyncStorage] removeItem failed for key "${name}":`, error);
    }
  },
};
