import { describe, it, expect, beforeEach } from 'bun:test';
import {
  scheduleRestTimerNotification,
  cancelRestTimerNotification,
  getRemainingRestSeconds,
} from '../restTimerNotification';

describe('Foreground-Safe Rest Timer Notification (restTimerNotification.ts)', () => {
  beforeEach(async () => {
    await cancelRestTimerNotification();
  });

  it('starts with 0 remaining seconds when no rest session is active', () => {
    expect(getRemainingRestSeconds()).toBe(0);
  });

  it('schedules a rest session and calculates remaining seconds from wall clock', async () => {
    await scheduleRestTimerNotification(60, 'Rest Complete', 'Next set ready');
    const remaining = getRemainingRestSeconds();

    // Should be approximately 60 seconds (between 58 and 60)
    expect(remaining).toBeGreaterThanOrEqual(58);
    expect(remaining).toBeLessThanOrEqual(60);
  });

  it('cancels the active rest session cleanly', async () => {
    await scheduleRestTimerNotification(90);
    expect(getRemainingRestSeconds()).toBeGreaterThan(0);

    await cancelRestTimerNotification();
    expect(getRemainingRestSeconds()).toBe(0);
  });

  it('handles zero or negative duration safely', async () => {
    await scheduleRestTimerNotification(0);
    expect(getRemainingRestSeconds()).toBeLessThanOrEqual(1);
  });
});
