import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';

function WaveformBar({
  isListening,
  delay,
  minHeight,
  maxHeight,
}: {
  isListening: boolean;
  delay: number;
  minHeight: number;
  maxHeight: number;
}) {
  const styles = useThemedStyles(createStyles);
  const minScale = Math.max(0.1, minHeight / maxHeight);
  const scaleAnim = useSharedValue(minScale);

  useEffect(() => {
    if (isListening) {
      scaleAnim.set(
        withDelay(
          delay,
          withRepeat(
            withSequence(
              withTiming(1, { duration: 320, easing: Easing.inOut(Easing.ease) }),
              withTiming(minScale, { duration: 320, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
          )
        )
      );
    } else {
      scaleAnim.set(withTiming(minScale, { duration: 250 }));
    }
  }, [isListening, delay, minScale, scaleAnim]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scaleAnim.get() }],
  }));

  return (
    <Animated.View
      style={[styles.waveBar, { height: maxHeight, transformOrigin: 'bottom' }, barStyle]}
    />
  );
}

interface VoiceWaveformVisualizerProps {
  isListening: boolean;
  statusMessage: string;
  onToggleListening: () => void;
}

export function VoiceWaveformVisualizer({
  isListening,
  statusMessage,
  onToggleListening,
}: VoiceWaveformVisualizerProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);

  useEffect(() => {
    if (isListening) {
      pulseScale.set(
        withRepeat(
          withTiming(1.35, { duration: 1100, easing: Easing.out(Easing.ease) }),
          -1,
          false
        )
      );
      pulseOpacity.set(
        withRepeat(
          withSequence(
            withTiming(0.6, { duration: 400 }),
            withTiming(0, { duration: 700 })
          ),
          -1,
          false
        )
      );
    } else {
      pulseScale.set(withTiming(1, { duration: 200 }));
      pulseOpacity.set(withTiming(0, { duration: 200 }));
    }
  }, [isListening, pulseScale, pulseOpacity]);

  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.get() }],
    opacity: pulseOpacity.get(),
  }));

  return (
    <View style={styles.visualizerContainer}>
      {/* Concentric Pulse Ring */}
      <Animated.View style={[styles.pulseRing, pulseRingStyle]} />

      {/* Main Glowing Mic Button */}
      <Pressable
        style={({ pressed }) => [
          styles.micButton,
          isListening && styles.micButtonListening,
          pressed && styles.pressed,
        ]}
        onPress={onToggleListening}
        accessibilityRole="button"
        accessibilityLabel={isListening ? 'Stop listening' : 'Start listening'}
      >
        <Ionicons
          name={isListening ? 'mic' : 'mic-outline'}
          size={36}
          color={isListening ? colors.textInverse : colors.primary}
        />
      </Pressable>

      {/* Waveform Bars */}
      <View style={styles.waveformContainer}>
        <WaveformBar isListening={isListening} delay={0} minHeight={6} maxHeight={28} />
        <WaveformBar isListening={isListening} delay={70} minHeight={8} maxHeight={36} />
        <WaveformBar isListening={isListening} delay={140} minHeight={10} maxHeight={44} />
        <WaveformBar isListening={isListening} delay={210} minHeight={8} maxHeight={34} />
        <WaveformBar isListening={isListening} delay={280} minHeight={6} maxHeight={26} />
      </View>

      {/* Status Pill */}
      <View
        style={[
          styles.statusPill,
          isListening && styles.statusPillActive,
        ]}
      >
        <View
          style={[
            styles.statusDot,
            isListening && styles.statusDotActive,
          ]}
        />
        <Text style={styles.statusText}>{statusMessage}</Text>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    visualizerContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
      position: 'relative',
    },
    pulseRing: {
      position: 'absolute',
      width: 110,
      height: 110,
      borderRadius: 55,
      backgroundColor: colors.primaryMuted,
      top: 19,
    },
    micButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
    },
    micButtonListening: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      shadowOpacity: 0.45,
      shadowRadius: 12,
    },
    waveformContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 6,
      height: 48,
      marginTop: 20,
      marginBottom: 16,
    },
    waveBar: {
      width: 5,
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
    },
    statusPillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: colors.textMuted,
    },
    statusDotActive: {
      backgroundColor: colors.primary,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
