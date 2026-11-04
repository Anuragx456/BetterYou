import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface AnimatedCalorieRingProps {
  consumed: number;
  target: number;
  remaining: number;
  size?: number;
  strokeWidth?: number;
  burnedCalories?: number;
}

export function AnimatedCalorieRing({
  consumed,
  target,
  remaining,
  size = 180,
  strokeWidth = 12,
}: AnimatedCalorieRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const targetRatio = target > 0 ? Math.min(1.5, Math.max(0, consumed / target)) : 0;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(targetRatio, {
      duration: 800,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [targetRatio, progress]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference * (1 - Math.min(1, progress.value));
    return {
      strokeDashoffset,
    };
  });

  const progressPercent = Math.round(targetRatio * 100);

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Calorie progress: ${consumed} of ${target} calories consumed, ${remaining} remaining`}
      accessibilityValue={{ min: 0, max: target, now: consumed }}
    >
      <Svg width={size} height={size}>
        {/* Background Track Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surfaceSubtle}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Animated Progress Circle */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressPercent > 100 ? colors.warning : colors.primary}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {/* Center Metrics Content */}
      <View style={styles.centerContent} pointerEvents="none">
        <Text style={styles.remainingLabel} allowFontScaling>
          Remaining
        </Text>
        <Text style={styles.remainingNumber} allowFontScaling>
          {remaining.toLocaleString()}
        </Text>
        <Text style={styles.targetLabel} allowFontScaling>
          / {target.toLocaleString()} kcal
        </Text>
        <Text style={styles.consumedLabel} allowFontScaling>
          {consumed.toLocaleString()} consumed
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerContent: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  remainingLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  remainingNumber: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginVertical: 2,
    fontVariant: ['tabular-nums'],
  },
  targetLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  consumedLabel: {
    fontSize: 11,
    color: colors.primary,
    marginTop: 4,
    fontWeight: '600',
  },
});
