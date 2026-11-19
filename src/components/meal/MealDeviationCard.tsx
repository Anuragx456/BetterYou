import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../theme/theme';
import { safeHaptics } from '../../utils/haptics';

export interface MealDeviationCardProps {
  deviationMessage?: string;
  referenceCalories: number;
  referenceProtein: number;
  referenceCarbs: number;
  referenceFat: number;
  provenance: string;
  portionMultiplier: number;
  onApplyReference: (unscaled: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    provenance: string;
  }) => void;
  onDismissDeviation: () => void;
}

export const MealDeviationCard = React.memo(function MealDeviationCard({
  deviationMessage,
  referenceCalories,
  referenceProtein,
  referenceCarbs,
  referenceFat,
  provenance,
  portionMultiplier,
  onApplyReference,
  onDismissDeviation,
}: MealDeviationCardProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.deviationCard}>
      <View style={styles.deviationHeader}>
        <Ionicons name="alert-circle" size={16} color={colors.warning} />
        <Text style={[styles.deviationTitle, { color: colors.warning }]}>
          Macro Deviation Alert (&gt;35%)
        </Text>
      </View>
      <Text style={[styles.deviationMessage, { color: colors.text }]}>
        {deviationMessage}
      </Text>
      <View style={styles.deviationActionsRow}>
        <Pressable
          style={({ pressed }) => [
            styles.useReferenceBtn,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
          ]}
          onPress={() => {
            safeHaptics.success();
            const unscaledCalories = Math.round(referenceCalories / portionMultiplier);
            const unscaledProtein = Math.round((referenceProtein / portionMultiplier) * 10) / 10;
            const unscaledCarbs = Math.round((referenceCarbs / portionMultiplier) * 10) / 10;
            const unscaledFat = Math.round((referenceFat / portionMultiplier) * 10) / 10;
            onApplyReference({
              calories: unscaledCalories,
              protein: unscaledProtein,
              carbs: unscaledCarbs,
              fat: unscaledFat,
              provenance,
            });
          }}
          accessibilityRole="button"
          accessibilityLabel="Use reference values"
        >
          <Ionicons name="checkmark-done" size={14} color="#FFFFFF" />
          <Text style={styles.useReferenceBtnText}>Use reference values</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.keepAiBtn,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            pressed && styles.pressed,
          ]}
          onPress={() => {
            safeHaptics.selection();
            onDismissDeviation();
          }}
          accessibilityRole="button"
          accessibilityLabel="Keep AI estimate"
        >
          <Text style={[styles.keepAiBtnText, { color: colors.textSecondary }]}>
            Keep AI estimate
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  deviationCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  deviationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  deviationTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  deviationMessage: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  deviationActionsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  useReferenceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    minHeight: 38,
  },
  useReferenceBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  keepAiBtn: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    minHeight: 38,
    justifyContent: 'center',
  },
  keepAiBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.8,
  },
});
