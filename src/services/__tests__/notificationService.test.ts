import { beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  calculateNextDailyTrigger,
  calculateNextSundayTrigger,
  cancelAllReminders,
  cancelDailyMealReminder,
  cancelSundayWeeklyReview,
  NOTIFICATION_IDS,
  parseNotificationTime,
  requestNotificationPermissions,
  scheduleDailyMealReminder,
  scheduleSundayWeeklyReview,
  setNotificationsModuleForTesting,
} from '../notificationService';

// Set up mock for expo-notifications
const mockScheduleNotificationAsync = mock(() => Promise.resolve('notif-id-123'));
const mockCancelScheduledNotificationAsync = mock(() => Promise.resolve());
const mockGetPermissionsAsync = mock(() => Promise.resolve({ granted: true, status: 'granted' }));
const mockRequestPermissionsAsync = mock(() => Promise.resolve({ granted: true, status: 'granted' }));

const mockNotificationsModule = {
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    WEEKLY: 'weekly',
  },
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  cancelScheduledNotificationAsync: mockCancelScheduledNotificationAsync,
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  setNotificationHandler: mock(() => {}),
};

describe('Notification Service (notificationService.ts)', () => {
  beforeEach(() => {
    mockScheduleNotificationAsync.mockClear();
    mockCancelScheduledNotificationAsync.mockClear();
    mockGetPermissionsAsync.mockClear();
    mockRequestPermissionsAsync.mockClear();
    setNotificationsModuleForTesting(mockNotificationsModule);
  });

  describe('parseNotificationTime', () => {
    it('parses valid 24-hr time strings correctly', () => {
      expect(parseNotificationTime('20:00')).toEqual({ hour: 20, minute: 0 });
      expect(parseNotificationTime('07:45')).toEqual({ hour: 7, minute: 45 });
      expect(parseNotificationTime('23:59')).toEqual({ hour: 23, minute: 59 });
      expect(parseNotificationTime('00:00')).toEqual({ hour: 0, minute: 0 });
    });

    it('falls back safely on invalid strings, empty input or out-of-range values', () => {
      expect(parseNotificationTime('', 20, 0)).toEqual({ hour: 20, minute: 0 });
      expect(parseNotificationTime('invalid', 20, 0)).toEqual({ hour: 20, minute: 0 });
      expect(parseNotificationTime('25:99', 19, 0)).toEqual({ hour: 19, minute: 0 });
      expect(parseNotificationTime('-5:-10', 8, 30)).toEqual({ hour: 8, minute: 30 });
    });
  });

  describe('calculateNextDailyTrigger', () => {
    it('schedules for today if time is still in the future', () => {
      const now = new Date('2026-11-15T14:30:00');
      const next = calculateNextDailyTrigger('20:00', now);

      expect(next.getFullYear()).toBe(2026);
      expect(next.getMonth()).toBe(10); // November (0-indexed 10)
      expect(next.getDate()).toBe(15);
      expect(next.getHours()).toBe(20);
      expect(next.getMinutes()).toBe(0);
    });

    it('schedules for tomorrow if time has already passed today', () => {
      const now = new Date('2026-11-15T21:30:00');
      const next = calculateNextDailyTrigger('20:00', now);

      expect(next.getDate()).toBe(16);
      expect(next.getHours()).toBe(20);
      expect(next.getMinutes()).toBe(0);
    });
  });

  describe('calculateNextSundayTrigger', () => {
    it('schedules for today if today is Sunday and target time is in the future', () => {
      // 2026-11-15 is a Sunday
      const sundayNoon = new Date('2026-11-15T12:00:00');
      expect(sundayNoon.getDay()).toBe(0);

      const next = calculateNextSundayTrigger('19:00', sundayNoon);
      expect(next.getDate()).toBe(15);
      expect(next.getHours()).toBe(19);
      expect(next.getMinutes()).toBe(0);
    });

    it('schedules for next Sunday if today is Sunday and target time has passed', () => {
      const sundayNight = new Date('2026-11-15T20:00:00');
      const next = calculateNextSundayTrigger('19:00', sundayNight);

      expect(next.getDate()).toBe(22); // Next Sunday (15 + 7)
      expect(next.getHours()).toBe(19);
    });

    it('schedules for upcoming Sunday from mid-week (e.g. Wednesday)', () => {
      // 2026-11-18 is Wednesday (day 3)
      const wednesday = new Date('2026-11-18T10:00:00');
      expect(wednesday.getDay()).toBe(3);

      const next = calculateNextSundayTrigger('19:00', wednesday);
      expect(next.getDate()).toBe(22); // Upcoming Sunday
      expect(next.getHours()).toBe(19);
    });
  });

  describe('Notification Gating & Scheduling', () => {
    it('requests system permissions and reports grant status', async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'undetermined' } as any);
      mockRequestPermissionsAsync.mockResolvedValueOnce({ granted: true, status: 'granted' } as any);

      const granted = await requestNotificationPermissions();
      expect(granted).toBe(true);
      expect(mockRequestPermissionsAsync).toHaveBeenCalled();
    });

    it('refuses to schedule if permissions are denied', async () => {
      mockGetPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied' } as any);
      mockRequestPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied' } as any);

      const scheduled = await scheduleDailyMealReminder('20:00');
      expect(scheduled).toBe(false);
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('cancels previous daily reminder and schedules new daily notification with correct parameters', async () => {
      const success = await scheduleDailyMealReminder('20:30');
      expect(success).toBe(true);

      // Verifies prior cancellation
      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
        NOTIFICATION_IDS.DAILY_MEAL_REMINDER
      );

      // Verifies schedule call
      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
        identifier: NOTIFICATION_IDS.DAILY_MEAL_REMINDER,
        content: {
          title: 'Log Today’s Meals 🍽️',
          body: 'Keep your nutrition on track — take a quick snap or log what you ate today.',
          sound: true,
        },
        trigger: {
          type: 'daily',
          hour: 20,
          minute: 30,
        },
      });
    });

    it('schedules weekly Sunday review with weekday: 1 (Sunday in Expo)', async () => {
      const success = await scheduleSundayWeeklyReview('19:00');
      expect(success).toBe(true);

      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
        NOTIFICATION_IDS.SUNDAY_WEEKLY_REVIEW
      );

      expect(mockScheduleNotificationAsync).toHaveBeenCalledWith({
        identifier: NOTIFICATION_IDS.SUNDAY_WEEKLY_REVIEW,
        content: {
          title: 'Your Weekly Recap is Ready ✨',
          body: 'Check out your workout volume, macro consistency, and personal records this week.',
          sound: true,
        },
        trigger: {
          type: 'weekly',
          weekday: 1,
          hour: 19,
          minute: 0,
        },
      });
    });

    it('cancels reminders cleanly when toggled off', async () => {
      await cancelDailyMealReminder();
      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
        NOTIFICATION_IDS.DAILY_MEAL_REMINDER
      );

      await cancelSundayWeeklyReview();
      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
        NOTIFICATION_IDS.SUNDAY_WEEKLY_REVIEW
      );

      mockCancelScheduledNotificationAsync.mockClear();
      await cancelAllReminders();
      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    });
  });
});
