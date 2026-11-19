import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AnimatedCalorieRing } from '../AnimatedCalorieRing';
import { AnimatedMacroBar } from '../AnimatedMacroBar';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import { DailyGoals, MacroBreakdown } from '../../types';

interface CalorieHeroCardProps {
  consumedCalories: number;
  calorieTarget: number;
  todayCaloriesBurned: number;
  todayTotals: MacroBreakdown;
  dailyGoals: DailyGoals;
  onScanMeal: () => void;
  onCheckIngredients: () => void;
}

export const CalorieHeroCard = React.memo(function CalorieHeroCard({
  consumedCalories,
  calorieTarget,
  todayCaloriesBurned,
  todayTotals,
  dailyGoals,
  onScanMeal,
  onCheckIngredients,
}: CalorieHeroCardProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const remainingCalories = Math.max(0, calorieTarget - consumedCalories);

  return (
    <View style={styles.heroCard}>
      <Pressable
        style={({ pressed }) => [styles.ringContainer, pressed && styles.pressed]}
        onPress={() => router.push('/nutrition-target')}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Calorie Progress: ${consumedCalories} of ${calorieTarget} calories consumed. Tap to change goals.`}
      >
        <AnimatedCalorieRing
          consumed={consumedCalories}
          target={calorieTarget}
          remaining={remainingCalories}
          size={184}
          strokeWidth={14}
        />
      </Pressable>

      {/* Inline Macro Bars */}
      <View style={styles.macroRow}>
        <View style={styles.macroCol}>
          <View style={styles.macroHeader}>
            <Text style={styles.macroTitle}>Protein</Text>
            <Text style={styles.macroGramText}>
              {Math.round(todayTotals.protein)}
              <Text style={styles.macroTargetText}>/{dailyGoals.proteinTargetGrams}g</Text>
            </Text>
          </View>
          <AnimatedMacroBar
            label="Protein"
            consumedGrams={todayTotals.protein}
            targetGrams={dailyGoals.proteinTargetGrams}
            barColor={colors.protein}
          />
        </View>

        <View style={styles.macroCol}>
          <View style={styles.macroHeader}>
            <Text style={styles.macroTitle}>Carbs</Text>
            <Text style={styles.macroGramText}>
              {Math.round(todayTotals.carbs)}
              <Text style={styles.macroTargetText}>/{dailyGoals.carbsTargetGrams}g</Text>
            </Text>
          </View>
          <AnimatedMacroBar
            label="Carbs"
            consumedGrams={todayTotals.carbs}
            targetGrams={dailyGoals.carbsTargetGrams}
            barColor={colors.carbs}
          />
        </View>

        <View style={styles.macroCol}>
          <View style={styles.macroHeader}>
            <Text style={styles.macroTitle}>Fat</Text>
            <Text style={styles.macroGramText}>
              {Math.round(todayTotals.fat)}
              <Text style={styles.macroTargetText}>/{dailyGoals.fatTargetGrams}g</Text>
            </Text>
          </View>
          <AnimatedMacroBar
            label="Fat"
            consumedGrams={todayTotals.fat}
            targetGrams={dailyGoals.fatTargetGrams}
            barColor={colors.fat}
          />
        </View>
      </View>

      {/* Unified Action Capsule Button */}
      <View style={styles.unifiedActionCapsule}>
        <Pressable
          style={({ pressed }) => [styles.capsuleHalfBtn, pressed && styles.pressed]}
          onPress={onScanMeal}
          accessibilityRole="button"
          accessibilityLabel="Scan Meal with AI camera"
        >
          <Ionicons name="camera" size={16} color={colors.primary} />
          <Text style={styles.capsuleBtnTextPrimary}>Scan Meal</Text>
        </Pressable>

        <View style={styles.capsuleDivider} />

        <Pressable
          style={({ pressed }) => [styles.capsuleHalfBtn, pressed && styles.pressed]}
          onPress={onCheckIngredients}
          accessibilityRole="button"
          accessibilityLabel="Screen Product Toxicity"
        >
          <Ionicons name="shield-checkmark" size={16} color={colors.textSecondary} />
          <Text style={styles.capsuleBtnTextSecondary}>Check Ingredients</Text>
        </Pressable>
      </View>
    </View>
  );
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    heroCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 20,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
    },
    ringContainer: {
      marginVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    macroRow: {
      flexDirection: 'row',
      width: '100%',
      gap: 12,
      marginTop: 14,
      marginBottom: 16,
    },
    macroCol: {
      flex: 1,
    },
    macroHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 5,
    },
    macroTitle: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    macroGramText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    macroTargetText: {
      fontSize: 10,
      fontWeight: '400',
      color: colors.textMuted,
    },
    unifiedActionCapsule: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      width: '100%',
      height: 48,
      overflow: 'hidden',
    },
    capsuleHalfBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: '100%',
    },
    capsuleDivider: {
      width: 1,
      height: 22,
      backgroundColor: colors.hairline,
    },
    capsuleBtnTextPrimary: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    capsuleBtnTextSecondary: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
