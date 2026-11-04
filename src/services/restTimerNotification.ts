let NotificationsModule: any = null;

// Lazy load expo-notifications to prevent errors in headless Node/Bun test environments
async function getNotifications() {
  if (NotificationsModule) return NotificationsModule;
  if (typeof window !== 'undefined' || (globalThis as any).nativeCallSyncHook) {
    try {
      NotificationsModule = await import('expo-notifications');
      // Configure default notification handler
      NotificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch {
      NotificationsModule = null;
    }
  }
  return NotificationsModule;
}

async function getReactNative() {
  if (typeof window !== 'undefined' || (globalThis as any).nativeCallSyncHook) {
    try {
      return await import('react-native');
    } catch {
      return null;
    }
  }
  return null;
}

export interface RestTimerSession {
  totalSeconds: number;
  endTimeMs: number;
  notificationId?: string;
}

let activeRestSession: RestTimerSession | null = null;

/**
 * Initializes and schedules an OS-level notification for when rest timer finishes.
 * Foreground-safe: records end timestamp so backgrounding doesn't freeze the timer.
 */
export async function scheduleRestTimerNotification(
  seconds: number,
  title = 'Rest Complete!',
  body = 'Time for your next set. Stay strong!'
): Promise<string | null> {
  const endTimeMs = Date.now() + seconds * 1000;
  let notificationId: string | null = null;

  try {
    const Notifications = await getNotifications();
    const rn = await getReactNative();
    if (Notifications && rn?.Platform?.OS !== 'web') {
      const { status } = await Notifications.getPermissionsAsync();
      let hasPermission = status === 'granted';
      if (!hasPermission) {
        const { status: requestStatus } = await Notifications.requestPermissionsAsync();
        hasPermission = requestStatus === 'granted';
      }

      if (hasPermission) {
        notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: Math.max(1, Math.round(seconds)),
          },
        });
      }
    }
  } catch {
    // Graceful fallback if notifications are blocked or unavailable
  }

  activeRestSession = {
    totalSeconds: seconds,
    endTimeMs,
    notificationId: notificationId || undefined,
  };

  return notificationId;
}

/**
 * Cancels active rest notification if timer is skipped or dismissed early.
 */
export async function cancelRestTimerNotification(): Promise<void> {
  if (activeRestSession?.notificationId) {
    try {
      const Notifications = await getNotifications();
      const rn = await getReactNative();
      if (Notifications && rn?.Platform?.OS !== 'web') {
        await Notifications.cancelScheduledNotificationAsync(activeRestSession.notificationId);
      }
    } catch {
      // Ignore cancellation failure
    }
  }
  activeRestSession = null;
}

/**
 * Calculates remaining seconds based on the wall-clock timestamp.
 * Essential when returning from device background.
 */
export function getRemainingRestSeconds(): number {
  if (!activeRestSession) return 0;
  const remainingMs = activeRestSession.endTimeMs - Date.now();
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

/**
 * Subscribes to AppState changes so the app resyncs remaining seconds when foregrounded.
 */
export function subscribeToForegroundRestSync(onForegroundSync: (remainingSec: number) => void): () => void {
  let removeListener: (() => void) | null = null;

  getReactNative().then((rn) => {
    if (rn?.AppState) {
      const subscription = rn.AppState.addEventListener('change', (nextState: string) => {
        if (nextState === 'active') {
          const remaining = getRemainingRestSeconds();
          onForegroundSync(remaining);
        }
      });
      removeListener = () => subscription.remove();
    }
  }).catch(() => {});

  return () => {
    if (removeListener) removeListener();
  };
}
