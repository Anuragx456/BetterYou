let HapticsModule: any = null;

async function getHaptics() {
  if (HapticsModule) return HapticsModule;
  if (typeof window !== 'undefined' || (globalThis as any).nativeCallSyncHook) {
    try {
      HapticsModule = await import('expo-haptics');
    } catch {
      HapticsModule = null;
    }
  }
  return HapticsModule;
}

/**
 * Safe, platform-guarded haptics utility.
 * Silently catches errors in unsupported environments (e.g. web, simulators, headless tests).
 */
export const safeHaptics = {
  impactLight: async (): Promise<void> => {
    try {
      const Haptics = await getHaptics();
      if (Haptics?.impactAsync) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Light ?? 'light');
      }
    } catch {
      // Ignore unsupported devices
    }
  },

  impactMedium: async (): Promise<void> => {
    try {
      const Haptics = await getHaptics();
      if (Haptics?.impactAsync) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Medium ?? 'medium');
      }
    } catch {
      // Ignore unsupported devices
    }
  },

  impactHeavy: async (): Promise<void> => {
    try {
      const Haptics = await getHaptics();
      if (Haptics?.impactAsync) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Heavy ?? 'heavy');
      }
    } catch {
      // Ignore unsupported devices
    }
  },

  selection: async (): Promise<void> => {
    try {
      const Haptics = await getHaptics();
      if (Haptics?.selectionAsync) {
        await Haptics.selectionAsync();
      }
    } catch {
      // Ignore unsupported devices
    }
  },

  success: async (): Promise<void> => {
    try {
      const Haptics = await getHaptics();
      if (Haptics?.notificationAsync) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Success ?? 'success');
      }
    } catch {
      // Ignore unsupported devices
    }
  },

  warning: async (): Promise<void> => {
    try {
      const Haptics = await getHaptics();
      if (Haptics?.notificationAsync) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Warning ?? 'warning');
      }
    } catch {
      // Ignore unsupported devices
    }
  },

  error: async (): Promise<void> => {
    try {
      const Haptics = await getHaptics();
      if (Haptics?.notificationAsync) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Error ?? 'error');
      }
    } catch {
      // Ignore unsupported devices
    }
  },

  /**
   * Double-pulse celebration or timer finished alert
   */
  timerFinished: async (): Promise<void> => {
    try {
      const Haptics = await getHaptics();
      if (Haptics?.notificationAsync) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType?.Success ?? 'success');
        setTimeout(async () => {
          try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle?.Heavy ?? 'heavy');
          } catch {
            // Ignore
          }
        }, 250);
      }
    } catch {
      // Ignore
    }
  },
};
