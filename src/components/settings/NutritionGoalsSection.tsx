import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../theme/theme';

export interface NutritionGoalsSectionProps {
  calorieTarget: number;
  onNavigateNutritionTarget: () => void;
  onNavigateRecalculateBmr: () => void;
}

export const NutritionGoalsSection = React.memo(function NutritionGoalsSection({
  calorieTarget,
  onNavigateNutritionTarget,
  onNavigateRecalculateBmr,
}: NutritionGoalsSectionProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]} allowFontScaling>
        NUTRITION & GOALS
      </Text>
      <View
        style={[
          styles.cardGroup,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        <Pressable
          style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
          onPress={onNavigateNutritionTarget}
          accessibilityRole="button"
          accessibilityLabel="Edit daily nutrition targets"
        >
          <View style={[styles.iconBadge, { backgroundColor: colors.softOrange }]}>
            <Ionicons name="flame" size={18} color={colors.calories} />
          </View>
          <View style={styles.navRowMeta}>
            <Text style={[styles.navRowTitle, { color: colors.text }]} allowFontScaling>
              Daily Nutrition Target
            </Text>
            <Text style={[styles.navRowSubtitle, { color: colors.textSecondary }]} allowFontScaling>
              Calorie and macronutrient goals
            </Text>
          </View>
          <View style={styles.navRight}>
            <View style={[styles.valueBadge, { backgroundColor: colors.surfaceSubtle }]}>
              <Text style={[styles.valueBadgeText, { color: colors.calories }]} allowFontScaling>
                {calorieTarget.toLocaleString()} kcal
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Pressable>

        <View style={[styles.rowDivider, { backgroundColor: colors.cardBorder }]} />

        <Pressable
          style={({ pressed }) => [styles.navRow, pressed && styles.pressed]}
          onPress={onNavigateRecalculateBmr}
          accessibilityRole="button"
          accessibilityLabel="Recalculate targets using BMR and TDEE"
        >
          <View style={[styles.iconBadge, { backgroundColor: colors.softBlue }]}>
            <Ionicons name="calculator" size={18} color={colors.primary} />
          </View>
          <View style={styles.navRowMeta}>
            <Text style={[styles.navRowTitle, { color: colors.text }]} allowFontScaling>
              Recalculate Targets (BMR / TDEE)
            </Text>
            <Text style={[styles.navRowSubtitle, { color: colors.textSecondary }]} allowFontScaling>
              Update weight, activity & Mifflin-St Jeor formula
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  cardGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    gap: 12,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRowMeta: {
    flex: 1,
  },
  navRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  navRowSubtitle: {
    fontSize: 12,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  valueBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rowDivider: {
    height: 1,
    marginLeft: 62,
  },
  pressed: {
    opacity: 0.8,
  },
});
