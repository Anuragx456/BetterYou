export const NOTIFICATION_IDS = {
  DAILY_MEAL_REMINDER: 'betteryou-daily-meal-reminder',
  SUNDAY_WEEKLY_REVIEW: 'betteryou-sunday-weekly-review',
} as const;

let notificationsModule: any = null;

/**
 * Dependency injection helper for headless tests.
 */
export function setNotificationsModuleForTesting(moduleOverride: any) {
  notificationsModule = moduleOverride;
}

/**
 * Lazy loads expo-notifications to prevent errors in headless Node/Bun test environments
 */
async function getNotifications() {
  if (notificationsModule) return notificationsModule;
  if (typeof window !== 'undefined' || (globalThis as any).nativeCallSyncHook) {
    try {
      notificationsModule = await import('expo-notifications');
      if (typeof notificationsModule.setNotificationHandler === 'function') {
        notificationsModule.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
      }
    } catch {
      notificationsModule = null;
    }
  }
  return notificationsModule;
}

/**
 * Parses time string like "20:00" into safe 24-hour hour and minute components.
 */
export function parseNotificationTime(
  timeStr: string,
  fallbackHour = 20,
  fallbackMinute = 0
): { hour: number; minute: number } {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) {
    return { hour: fallbackHour, minute: fallbackMinute };
  }
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);

  const hour = !isNaN(h) && h >= 0 && h <= 23 ? h : fallbackHour;
  const minute = !isNaN(m) && m >= 0 && m <= 59 ? m : fallbackMinute;
  return { hour, minute };
}

/**
 * Pure calculation: computes the next Date a daily reminder will trigger given reference time.
 */
export function calculateNextDailyTrigger(
  timeStr: string,
  now: Date = new Date()
): Date {
  const { hour, minute } = parseNotificationTime(timeStr, 20, 0);
  const trigger = new Date(now.getTime());
  trigger.setHours(hour, minute, 0, 0);

  if (trigger.getTime() <= now.getTime()) {
    trigger.setDate(trigger.getDate() + 1);
  }
  return trigger;
}

/**
 * Pure calculation: computes the next Date a Sunday weekly review will trigger given reference time.
 * (Sunday is day 0 in JS Date.getDay()).
 */
export function calculateNextSundayTrigger(
  timeStr: string,
  now: Date = new Date()
): Date {
  const { hour, minute } = parseNotificationTime(timeStr, 19, 0);
  const trigger = new Date(now.getTime());
  trigger.setHours(hour, minute, 0, 0);

  const currentDay = now.getDay(); // 0 is Sunday
  let daysUntilSunday = (7 - currentDay) % 7;

  if (daysUntilSunday === 0 && trigger.getTime() <= now.getTime()) {
    daysUntilSunday = 7;
  }

  trigger.setDate(trigger.getDate() + daysUntilSunday);
  return trigger;
}

/**
 * Requests system notification permissions if not already granted.
 * Returns true if permitted, false otherwise.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const Notifications = await getNotifications();
    if (!Notifications || typeof Notifications.getPermissionsAsync !== 'function') {
      return false;
    }

    const existing = await Notifications.getPermissionsAsync();
    if (existing?.granted || existing?.status === 'granted') {
      return true;
    }

    if (typeof Notifications.requestPermissionsAsync !== 'function') {
      return false;
    }

    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true,
      },
    });

    return Boolean(requested?.granted || requested?.status === 'granted');
  } catch {
    return false;
  }
}

/**
 * Schedules daily meal reminder at the specified 24-hr time (defaults to 20:00 / 8 PM).
 */
export async function scheduleDailyMealReminder(timeStr = '20:00'): Promise<boolean> {
  const permitted = await requestNotificationPermissions();
  if (!permitted) return false;

  try {
    const Notifications = await getNotifications();
    if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') {
      return false;
    }

    // Cancel any previous daily reminder to avoid duplicates
    await cancelDailyMealReminder();

    const { hour, minute } = parseNotificationTime(timeStr, 20, 0);

    const triggerType = Notifications.SchedulableTriggerInputTypes?.DAILY || 'daily';

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_IDS.DAILY_MEAL_REMINDER,
      content: {
        title: 'Log Today’s Meals 🍽️',
        body: 'Keep your nutrition on track — take a quick snap or log what you ate today.',
        sound: true,
      },
      trigger: {
        type: triggerType,
        hour,
        minute,
      },
    });

    return true;
  } catch (err) {
    console.warn('[Notifications] Failed to schedule daily meal reminder:', err);
    return false;
  }
}

/**
 * Cancels scheduled daily meal reminder cleanly.
 */
export async function cancelDailyMealReminder(): Promise<void> {
  try {
    const Notifications = await getNotifications();
    if (Notifications && typeof Notifications.cancelScheduledNotificationAsync === 'function') {
      await Notifications.cancelScheduledNotificationAsync(
        NOTIFICATION_IDS.DAILY_MEAL_REMINDER
      );
    }
  } catch {
    // Ignore cancellation errors
  }
}

/**
 * Schedules weekly review prompt on Sunday at specified 24-hr time (defaults to 19:00 / 7 PM).
 */
export async function scheduleSundayWeeklyReview(timeStr = '19:00'): Promise<boolean> {
  const permitted = await requestNotificationPermissions();
  if (!permitted) return false;

  try {
    const Notifications = await getNotifications();
    if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') {
      return false;
    }

    // Cancel any previous weekly prompt
    await cancelSundayWeeklyReview();

    const { hour, minute } = parseNotificationTime(timeStr, 19, 0);

    const triggerType = Notifications.SchedulableTriggerInputTypes?.WEEKLY || 'weekly';

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_IDS.SUNDAY_WEEKLY_REVIEW,
      content: {
        title: 'Your Weekly Recap is Ready ✨',
        body: 'Check out your workout volume, macro consistency, and personal records this week.',
        sound: true,
      },
      trigger: {
        type: triggerType,
        weekday: 1, // 1 represents Sunday in Expo Notifications SchedulableTriggerInputTypes
        hour,
        minute,
      },
    });

    return true;
  } catch (err) {
    console.warn('[Notifications] Failed to schedule weekly review reminder:', err);
    return false;
  }
}

/**
 * Cancels scheduled Sunday weekly review prompt cleanly.
 */
export async function cancelSundayWeeklyReview(): Promise<void> {
  try {
    const Notifications = await getNotifications();
    if (Notifications && typeof Notifications.cancelScheduledNotificationAsync === 'function') {
      await Notifications.cancelScheduledNotificationAsync(
        NOTIFICATION_IDS.SUNDAY_WEEKLY_REVIEW
      );
    }
  } catch {
    // Ignore cancellation errors
  }
}

/**
 * Cancels all BetterYou opt-in reminders.
 */
export async function cancelAllReminders(): Promise<void> {
  await Promise.all([
    cancelDailyMealReminder(),
    cancelSundayWeeklyReview(),
  ]);
}
