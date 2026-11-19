import { useCallback, useRef, useState } from 'react';
import { cancelRestTimerNotification } from '../services/restTimerNotification';
import { safeHaptics } from '../utils/haptics';

export function secondsUntil(endsAt: number): number {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

export function formatWorkoutTime(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export interface RestSession {
  endsAt: number;
  total: number;
}

export function useRestTimer() {
  const [restSession, setRestSession] = useState<RestSession | null>(null);
  const preferredRestSeconds = useRef(90);

  const triggerRestTimer = useCallback((seconds: number = preferredRestSeconds.current) => {
    const safe = Math.max(1, Math.round(seconds));
    preferredRestSeconds.current = safe;
    setRestSession({ endsAt: Date.now() + safe * 1000, total: safe });
  }, []);

  const handleAdjustRestTimer = useCallback((delta: number) => {
    safeHaptics.selection();
    setRestSession((prev) => {
      if (!prev) return prev;
      const remaining = Math.max(0, secondsUntil(prev.endsAt) + delta);
      const total = Math.max(15, prev.total + delta);
      preferredRestSeconds.current = total;
      return { endsAt: Date.now() + remaining * 1000, total };
    });
  }, []);

  const handlePresetRestTimer = useCallback((sec: number) => {
    safeHaptics.selection();
    const safe = Math.max(15, sec);
    preferredRestSeconds.current = safe;
    setRestSession({ endsAt: Date.now() + safe * 1000, total: safe });
  }, []);

  const handleDismissRestTimer = useCallback(() => {
    cancelRestTimerNotification();
    setRestSession(null);
  }, []);

  return {
    restSession,
    preferredRestSeconds,
    triggerRestTimer,
    handleAdjustRestTimer,
    handlePresetRestTimer,
    handleDismissRestTimer,
  };
}
