import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../theme/theme';
import { formatWorkoutTime } from '../../hooks/useRestTimer';

interface WorkoutTimerBadgeProps {
  startedAt: string;
}

export const WorkoutTimerBadge = React.memo(function WorkoutTimerBadge({
  startedAt,
}: WorkoutTimerBadgeProps) {
  const colors = useThemeColors();
  const [seconds, setSeconds] = useState<number>(() => {
    return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  });

  useEffect(() => {
    const startTime = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      setSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <View style={[styles.timerBadge, { backgroundColor: colors.surfaceSubtle, borderColor: colors.hairline }]}>
      <Ionicons name="time-outline" size={14} color={colors.primary} />
      <Text style={[styles.timerBadgeText, { color: colors.text }]} allowFontScaling>
        {formatWorkoutTime(seconds)}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  timerBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
