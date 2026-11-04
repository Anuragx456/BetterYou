import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../theme/colors';

interface AnimatedMacroBarProps {
  label: string;
  consumedGrams: number;
  targetGrams: number;
  barColor: string;
}

export function AnimatedMacroBar({
  label,
  consumedGrams,
  targetGrams,
  barColor,
}: AnimatedMacroBarProps) {
  const targetSafe = Math.max(1, targetGrams);
  const ratio = Math.min(1, Math.max(0, consumedGrams / targetSafe));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(ratio, {
      duration: 700,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [ratio, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value * 100}%`,
    };
  });

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}: ${consumedGrams}g of ${targetGrams}g`}
      accessibilityValue={{ min: 0, max: targetGrams, now: consumedGrams }}
    >
      <View style={styles.header}>
        <Text style={styles.title} allowFontScaling>
          {label}
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            { backgroundColor: barColor },
            animatedStyle,
          ]}
        />
      </View>
      <Text style={styles.gramText} allowFontScaling>
        {consumedGrams}g <Text style={styles.targetText}>/ {targetGrams}g</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  header: {
    marginBottom: 6,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  track: {
    width: '100%',
    height: 7,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  gramText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  targetText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
  },
});
