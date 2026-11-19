import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useThemeColors } from '../../theme/theme';
import { formatWorkoutTime, secondsUntil } from '../../hooks/useRestTimer';

interface DiaryTimerReadoutProps {
  endsAt: number | null;
}

export const DiaryTimerReadout = React.memo(function DiaryTimerReadout({
  endsAt,
}: DiaryTimerReadoutProps) {
  const colors = useThemeColors();
  const [trackedEndsAt, setTrackedEndsAt] = useState(endsAt);
  const [label, setLabel] = useState(() => (endsAt ? formatWorkoutTime(secondsUntil(endsAt)) : '120m'));

  if (trackedEndsAt !== endsAt) {
    setTrackedEndsAt(endsAt);
    setLabel(endsAt ? formatWorkoutTime(secondsUntil(endsAt)) : '120m');
  }

  useEffect(() => {
    if (!endsAt) return;
    const interval = setInterval(() => {
      const left = secondsUntil(endsAt);
      if (left <= 0) {
        setLabel('00:00');
        clearInterval(interval);
      } else {
        setLabel(formatWorkoutTime(left));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  return (
    <Text style={[styles.timerDurationBig, { color: colors.text }]} allowFontScaling>
      {label}
    </Text>
  );
});

const styles = StyleSheet.create({
  timerDurationBig: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
});
