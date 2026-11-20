import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';

interface FeatureBreakdownCardProps {
  featureBreakdown: Record<string, number>;
}

export function FeatureBreakdownCard({ featureBreakdown }: FeatureBreakdownCardProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.featureBreakdownCard}>
      <Text style={styles.cardSectionTitle}>USAGE BY FEATURE</Text>
      <View style={styles.featureChipsWrap}>
        <View style={styles.featureChip}>
          <Ionicons name="restaurant-outline" size={14} color={colors.primary} />
          <Text style={styles.featureChipLabel}>Meal Vision:</Text>
          <Text style={styles.featureChipCount}>
            {featureBreakdown['meal-vision'] || 0}
          </Text>
        </View>

        <View style={styles.featureChip}>
          <Ionicons name="mic-outline" size={14} color={colors.calories} />
          <Text style={styles.featureChipLabel}>Meal Voice:</Text>
          <Text style={styles.featureChipCount}>
            {featureBreakdown['meal-voice'] || 0}
          </Text>
        </View>

        <View style={styles.featureChip}>
          <Ionicons name="document-text-outline" size={14} color={colors.protein} />
          <Text style={styles.featureChipLabel}>Ingredient OCR:</Text>
          <Text style={styles.featureChipCount}>
            {featureBreakdown['toxicity-scan'] || 0}
          </Text>
        </View>

        <View style={styles.featureChip}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.secondary} />
          <Text style={styles.featureChipLabel}>Product Voice:</Text>
          <Text style={styles.featureChipCount}>
            {featureBreakdown['toxicity-voice'] || 0}
          </Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    featureBreakdownCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: 12,
    },
    cardSectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.8,
      marginBottom: 12,
    },
    featureChipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    featureChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surfaceSubtle,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    featureChipLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    featureChipCount: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
  });
}
