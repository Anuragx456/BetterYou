import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/theme';

interface LoadingSkeletonProps {
  style?: ViewStyle;
  height?: number;
  width?: number | `${number}%`;
  borderRadius?: number;
}

export function LoadingSkeleton({
  style,
  height = 20,
  width = '100%',
  borderRadius = 8,
}: LoadingSkeletonProps) {
  const styles = useThemedStyles(createStyles);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.set(
      withRepeat(
        withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { height, width, borderRadius },
        style,
        animatedStyle,
      ]}
      accessible
      accessibilityLabel="Loading content..."
      accessibilityRole="none"
    />
  );
}

export function DashboardHeroSkeleton() {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.cardContainer}>
      <View style={styles.centerRow}>
        <LoadingSkeleton height={140} width={140} borderRadius={70} />
      </View>
      <View style={styles.macroRow}>
        <LoadingSkeleton height={35} width="30%" borderRadius={8} />
        <LoadingSkeleton height={35} width="30%" borderRadius={8} />
        <LoadingSkeleton height={35} width="30%" borderRadius={8} />
      </View>
    </View>
  );
}

export function ListCardSkeleton() {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.cardContainer}>
      <View style={styles.topRow}>
        <LoadingSkeleton height={18} width="50%" borderRadius={6} />
        <LoadingSkeleton height={18} width="20%" borderRadius={6} />
      </View>
      <LoadingSkeleton height={12} width="80%" borderRadius={4} style={{ marginTop: 8 }} />
      <LoadingSkeleton height={12} width="40%" borderRadius={4} style={{ marginTop: 6 }} />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  skeleton: {
    backgroundColor: colors.surfaceSubtle,
  },
  cardContainer: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  centerRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
}

