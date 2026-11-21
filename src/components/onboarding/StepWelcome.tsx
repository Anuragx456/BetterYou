import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors } from '../../theme/theme';
import { safeHaptics } from '../../utils/haptics';

interface StepWelcomeProps {
  onGetStarted: () => void;
  onSkip: () => void;
}

export const StepWelcome: React.FC<StepWelcomeProps> = ({ onGetStarted, onSkip }) => {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const valueProps = [
    {
      icon: 'camera' as const,
      text: 'Snap a meal, get its macros',
      color: colors.primary,
    },
    {
      icon: 'shield-checkmark' as const,
      text: "Know what's really in your food",
      color: colors.success,
    },
    {
      icon: 'barbell' as const,
      text: 'Track workouts and hit your goals',
      color: colors.protein,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* App Icon */}
        <Image
          source={require('../../../assets/images/icon.png')}
          style={styles.appIcon}
          resizeMode="cover"
        />

        <Text style={styles.title}>Welcome to BetterYou</Text>
        <Text style={styles.subtitle}>
          Your private, offline-first companion for fitness, nutrition, and metabolic science.
        </Text>

        {/* 3 Value Props */}
        <View style={styles.propsContainer}>
          {valueProps.map((prop, idx) => (
            <View key={idx} style={styles.propRow}>
              <View style={[styles.propIconWrapper, { backgroundColor: colors.surfaceSubtle }]}>
                <Ionicons name={prop.icon} size={20} color={prop.color} />
              </View>
              <Text style={styles.propText}>{prop.text}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.buttonGroup}>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
          onPress={() => {
            safeHaptics.selection();
            onGetStarted();
          }}
          accessibilityRole="button"
          accessibilityLabel="Get Started"
          testID="welcome-get-started-btn"
        >
          <Text style={styles.primaryBtnText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </Pressable>

        <Pressable
          style={styles.skipBtn}
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip for now"
          testID="welcome-skip-btn"
        >
          <Text style={styles.skipBtnText}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingTop: 48,
      paddingBottom: 24,
      backgroundColor: colors.background,
    },
    content: {
      alignItems: 'center',
    },
    appIcon: {
      width: 72,
      height: 72,
      borderRadius: 18,
      marginBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
      textAlign: 'center',
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 8,
      marginBottom: 36,
    },
    propsContainer: {
      width: '100%',
      gap: 16,
    },
    propRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    propIconWrapper: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    propText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    buttonGroup: {
      width: '100%',
      gap: 12,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      gap: 8,
    },
    btnPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.99 }],
    },
    primaryBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    skipBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
    },
    skipBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
    },
  });
}
