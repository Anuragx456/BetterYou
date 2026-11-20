import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';

interface HeroTargetCardProps {
  calorieTarget?: number;
}

export function HeroTargetCard({ calorieTarget }: HeroTargetCardProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroTopRow}>
        <View style={styles.heroIconBadge}>
          <Ionicons name="flame" size={22} color={colors.calories} />
        </View>
        <View style={styles.heroTextCol}>
          <Text style={styles.heroLabel}>CURRENT DAILY TARGET</Text>
          <Text style={styles.heroValue}>
            {calorieTarget?.toLocaleString() ?? 2200}{' '}
            <Text style={styles.heroUnit}>kcal</Text>
          </Text>
        </View>
      </View>
      <Text style={styles.heroDesc}>
        {"Calibrates the circular progress ring and remaining calories on Today's dashboard."}
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    heroCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 18,
      marginBottom: 24,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 10,
    },
    heroIconBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.softOrange,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTextCol: {
      flex: 1,
    },
    heroLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      color: colors.textMuted,
    },
    heroValue: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      fontVariant: ['tabular-nums'],
      marginTop: 2,
    },
    heroUnit: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.calories,
    },
    heroDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
    },
  });
}
