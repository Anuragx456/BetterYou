import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  cancelRestTimerNotification,
  scheduleRestTimerNotification,
  subscribeToForegroundRestSync,
} from '../../services/restTimerNotification';
import { useThemeColors } from '../../theme/theme';
import { safeHaptics } from '../../utils/haptics';
import { formatWorkoutTime, secondsUntil } from '../../hooks/useRestTimer';

const REST_PRESETS = [60, 90, 120];

export interface FloatingRestTimerProps {
  endsAt: number;
  totalSeconds: number;
  onDismiss: () => void;
  onAdjust: (delta: number) => void;
  onPreset: (sec: number) => void;
}

export const FloatingRestTimer = React.memo(function FloatingRestTimer({
  endsAt,
  totalSeconds,
  onDismiss,
  onAdjust,
  onPreset,
}: FloatingRestTimerProps) {
  const colors = useThemeColors();
  const [trackedEndsAt, setTrackedEndsAt] = useState(endsAt);
  const [seconds, setSeconds] = useState(() => secondsUntil(endsAt));
  const [isFinished, setIsFinished] = useState(false);
  const onDismissRef = useRef(onDismiss);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (trackedEndsAt !== endsAt) {
    setTrackedEndsAt(endsAt);
    setSeconds(secondsUntil(endsAt));
    setIsFinished(false);
  }

  // Pulse animation using Reanimated on the native UI thread
  const pulseOpacity = useSharedValue(0.4);
  useEffect(() => {
    pulseOpacity.set(
      withRepeat(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  }, [pulseOpacity]);

  const animatedPulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.get(),
  }));

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const remainingNow = secondsUntil(endsAt);
    if (remainingNow <= 0) {
      onDismissRef.current();
      return;
    }

    scheduleRestTimerNotification(remainingNow);
    const unsubscribeSync = subscribeToForegroundRestSync((remaining) => {
      setSeconds(remaining);
      if (remaining <= 0) {
        setIsFinished(true);
        safeHaptics.timerFinished();
      }
    });

    const interval = setInterval(() => {
      const left = secondsUntil(endsAt);
      setSeconds(left);
      if (left <= 0) {
        clearInterval(interval);
        setIsFinished(true);
        safeHaptics.timerFinished();
        finishTimeoutRef.current = setTimeout(() => {
          onDismissRef.current();
        }, 2800);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      unsubscribeSync();
      if (finishTimeoutRef.current) {
        clearTimeout(finishTimeoutRef.current);
        finishTimeoutRef.current = null;
      }
    };
  }, [endsAt]);

  const handleDismissTimer = () => {
    cancelRestTimerNotification();
    onDismissRef.current();
  };

  if (isFinished) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.floatingRestTimer,
          styles.floatingRestTimerFinished,
          {
            backgroundColor: colors.softGreen,
            borderColor: colors.safetyClean,
          },
          pressed && styles.pressed,
        ]}
        onPress={handleDismissTimer}
        accessibilityRole="button"
        accessibilityLabel="Rest complete! Tap to dismiss timer."
      >
        <View style={styles.restFinishedRow}>
          <View
            style={[
              styles.restFinishedIconBox,
              { backgroundColor: colors.softGreenBorder },
            ]}
          >
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.restFinishedTitle, { color: colors.safetyClean }]}
              allowFontScaling
            >
              REST COMPLETE!
            </Text>
            <Text
              style={[styles.restFinishedSub, { color: colors.textSecondary }]}
              allowFontScaling
            >
              Ready for your next set • Tap to dismiss
            </Text>
          </View>
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </View>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.floatingRestTimer,
        {
          backgroundColor: colors.cardElevated,
          borderColor: colors.cardBorder,
          shadowColor: colors.black,
        },
      ]}
    >
      <View style={styles.restTimerContentRow}>
        <View style={styles.restTimerLeft}>
          <Animated.View
            style={[
              styles.restTimerPulseDot,
              { backgroundColor: colors.primary },
              animatedPulseStyle,
            ]}
          />
          <View>
            <Text
              style={[styles.restTimerTitle, { color: colors.textMuted }]}
              allowFontScaling
            >
              REST TIMER
            </Text>
            <Text
              style={[styles.restTimerTimeText, { color: colors.text }]}
              allowFontScaling
            >
              {formatWorkoutTime(seconds)}
            </Text>
          </View>
        </View>

        {/* Quick Stepper +30s / -15s / Skip */}
        <View style={styles.restTimerControlsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.restTimerAdjustBtn,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.hairline,
              },
              pressed && styles.pressed,
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            onPress={() => {
              safeHaptics.selection();
              onAdjust(-15);
            }}
            accessibilityRole="button"
            accessibilityLabel="Subtract 15 seconds from rest timer"
          >
            <Text
              style={[styles.restTimerAdjustText, { color: colors.textSecondary }]}
            >
              -15s
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.restTimerAdjustBtn,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.hairline,
              },
              pressed && styles.pressed,
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            onPress={() => {
              safeHaptics.selection();
              onAdjust(30);
            }}
            accessibilityRole="button"
            accessibilityLabel="Add 30 seconds to rest timer"
          >
            <Text
              style={[styles.restTimerAdjustText, { color: colors.textSecondary }]}
            >
              +30s
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.restTimerSkipBtn,
              { backgroundColor: colors.surfaceSubtle },
              pressed && styles.pressed,
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={handleDismissTimer}
            accessibilityRole="button"
            accessibilityLabel="Skip rest timer"
          >
            <Text
              style={[styles.restTimerSkipText, { color: colors.text }]}
            >
              Skip
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Rest Presets (60s / 90s / 120s) */}
      <View style={styles.restPresetsRow}>
        {REST_PRESETS.map((sec) => (
          <Pressable
            key={sec}
            style={({ pressed }) => [
              styles.restPresetBtn,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.hairline,
              },
              totalSeconds === sec && {
                backgroundColor: colors.primaryMuted,
                borderColor: colors.primary,
              },
              pressed && styles.pressed,
            ]}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            onPress={() => {
              safeHaptics.selection();
              onPreset(sec);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Set rest timer to ${sec} seconds`}
          >
            <Text
              style={[
                styles.restPresetBtnText,
                { color: colors.textMuted },
                totalSeconds === sec && { color: colors.primary },
              ]}
              allowFontScaling
            >
              {sec}s
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  floatingRestTimer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 16,
    right: 16,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  floatingRestTimerFinished: {
    borderWidth: 1.5,
  },
  restFinishedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  restFinishedIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restFinishedTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  restFinishedSub: {
    fontSize: 11,
    marginTop: 2,
  },
  restTimerContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  restTimerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restTimerPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  restTimerTitle: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  restTimerTimeText: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  restTimerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  restTimerAdjustBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
    minWidth: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restTimerAdjustText: {
    fontSize: 11,
    fontWeight: '600',
  },
  restTimerSkipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restTimerSkipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  restPresetsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  restPresetBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 36,
  },
  restPresetBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
});
