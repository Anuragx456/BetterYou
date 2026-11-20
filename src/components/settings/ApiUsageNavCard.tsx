import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';

export function ApiUsageNavCard() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();

  return (
    <View style={styles.section}>
      <Pressable
        style={({ pressed }) => [styles.usageNavCard, pressed && styles.pressed]}
        onPress={() => router.push('/api-usage')}
        accessibilityRole="button"
        accessibilityLabel="View detailed Gemini API usage and token metrics"
      >
        <View style={styles.usageNavCardLeft}>
          <View style={styles.usageNavIconCircle}>
            <Ionicons name="speedometer-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.usageNavMeta}>
            <Text style={styles.usageNavTitle}>Detailed API Usage & Quota</Text>
            <Text style={styles.usageNavSubtitle}>
              View scans, token consumption, and rate limits
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: {
      marginBottom: 24,
    },
    usageNavCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 16,
    },
    usageNavCardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    usageNavIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    usageNavMeta: {
      flex: 1,
    },
    usageNavTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    usageNavSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
