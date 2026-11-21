import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors } from '../../theme/theme';
import { ACTIVITY_OPTIONS, GOAL_OPTIONS } from './constants';
import type { ActivityLevel, GoalType, UserSex } from '../../utils/nutritionTargets';

interface StepSummaryCompletionProps {
  sex: UserSex | null;
  ageStr: string;
  heightStr: string;
  weightStr: string;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  customCalories: number;
  customProtein: number;
  customCarbs: number;
  customFat: number;
  isRecalculating: boolean;
  onFinish: () => void;
}

export function StepSummaryCompletion({
  sex,
  ageStr,
  heightStr,
  weightStr,
  activityLevel,
  goalType,
  customCalories,
  customProtein,
  customCarbs,
  customFat,
  isRecalculating,
  onFinish,
}: StepSummaryCompletionProps) {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const activityObj = ACTIVITY_OPTIONS.find((a) => a.key === activityLevel);
  const goalObj = GOAL_OPTIONS.find((g) => g.key === goalType);

  const proteinKcal = customProtein * 4;
  const carbsKcal = customCarbs * 4;
  const fatKcal = customFat * 9;

  return (
    <View style={styles.stepWrapper}>
      {/* Category Tag */}
      <View style={styles.badgeRow}>
        <View style={styles.badgeIconWrapper}>
          <Ionicons name="checkmark-done-circle" size={13} color={colors.success} />
        </View>
        <Text style={styles.badgeText}>SETUP COMPLETE</Text>
      </View>

      <Text style={styles.stepTitle}>Ready to Get Started!</Text>
      <Text style={styles.stepDesc}>
        Your personalized metabolic blueprint is generated. All targets and biometric records are saved locally in your private on-device SQLite database.
      </Text>

      {/* Blueprint Card */}
      <View style={styles.blueprintCard}>
        {/* Pass Header */}
        <View style={styles.passHeader}>
          <View>
            <Text style={styles.passTitle}>METABOLIC BLUEPRINT</Text>
            <Text style={styles.passSubtitle}>BetterYou Precision Engine</Text>
          </View>
          <View style={styles.passBadge}>
            <Ionicons name="hardware-chip-outline" size={12} color={colors.primary} />
            <Text style={styles.passBadgeText}>LOCAL SQLITE</Text>
          </View>
        </View>

        <View style={styles.passDivider} />

        {/* Profile Metrics Grid */}
        <View style={styles.profileGrid}>
          <View style={styles.profileItem}>
            <Text style={styles.profileItemLabel}>BIOLOGICAL PROFILE</Text>
            <Text style={styles.profileItemValue}>
              {sex === 'female' ? 'Female' : 'Male'} • {ageStr} yrs
            </Text>
          </View>

          <View style={styles.profileItem}>
            <Text style={styles.profileItemLabel}>STATURE & WEIGHT</Text>
            <Text style={styles.profileItemValue}>
              {heightStr} cm • {weightStr} kg
            </Text>
          </View>

          <View style={styles.profileItem}>
            <Text style={styles.profileItemLabel}>PHYSICAL ACTIVITY</Text>
            <Text style={styles.profileItemValue}>
              {activityObj ? activityObj.label : 'Moderate'} ({activityObj?.multiplier || '1.55×'})
            </Text>
          </View>

          <View style={styles.profileItem}>
            <Text style={styles.profileItemLabel}>TARGET OBJECTIVE</Text>
            <Text style={styles.profileItemValue}>
              {goalObj ? goalObj.label : 'Maintenance'}
            </Text>
          </View>
        </View>

        <View style={styles.passDivider} />

        {/* Target Calories Centerpiece */}
        <View style={styles.targetSection}>
          <View style={styles.targetHeader}>
            <Text style={styles.targetSectionLabel}>DAILY CALORIE BUDGET</Text>
            <View style={styles.goalPill}>
              <Text style={styles.goalPillText}>
                {goalType === 'cut' ? '-500 kcal' : goalType === 'bulk' ? '+300 kcal' : 'TDEE'}
              </Text>
            </View>
          </View>
          <View style={styles.targetCalorieRow}>
            <Text style={styles.targetCalorieNumber}>{customCalories.toLocaleString()}</Text>
            <Text style={styles.targetCalorieUnit}>kcal / day</Text>
          </View>
        </View>

        {/* Macro Bento Grid */}
        <View style={styles.macroGrid}>
          {/* Protein */}
          <View style={[styles.macroTile, { borderTopColor: colors.protein }]}>
            <Text style={styles.macroTileName}>PROTEIN</Text>
            <Text style={[styles.macroTileGrams, { color: colors.protein }]}>
              {customProtein}g
            </Text>
            <Text style={styles.macroTileKcal}>{proteinKcal} kcal</Text>
          </View>

          {/* Carbs */}
          <View style={[styles.macroTile, { borderTopColor: colors.carbs }]}>
            <Text style={styles.macroTileName}>CARBS</Text>
            <Text style={[styles.macroTileGrams, { color: colors.carbs }]}>
              {customCarbs}g
            </Text>
            <Text style={styles.macroTileKcal}>{carbsKcal} kcal</Text>
          </View>

          {/* Fat */}
          <View style={[styles.macroTile, { borderTopColor: colors.fat }]}>
            <Text style={styles.macroTileName}>FATS</Text>
            <Text style={[styles.macroTileGrams, { color: colors.fat }]}>
              {customFat}g
            </Text>
            <Text style={styles.macroTileKcal}>{fatKcal} kcal</Text>
          </View>
        </View>
      </View>

      {/* Local-First & Privacy Notice */}
      <View style={styles.privacyCard}>
        <View style={styles.privacyIconWrapper}>
          <Ionicons name="lock-closed" size={16} color={colors.primary} />
        </View>
        <View style={styles.privacyContent}>
          <Text style={styles.privacyTitle}>Private & Offline-First</Text>
          <Text style={styles.privacyText}>
            Zero cloud requirement. Your biometrics, meals, and workout logs are stored in your private local SQLite database on this device.
          </Text>
        </View>
      </View>

      {/* Medical Disclaimer */}
      <Text style={styles.disclaimerText}>
        Targets are estimates from the Mifflin-St Jeor formula, not medical advice.
      </Text>

      {/* CTA Button */}
      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
        onPress={onFinish}
        accessibilityRole="button"
        accessibilityLabel={isRecalculating ? 'Save & Update Goals' : 'Start My Journey'}
        testID="onboarding-finish-btn"
      >
        <Text style={styles.primaryBtnText}>
          {isRecalculating ? 'Save & Update Goals' : 'Start My Journey'}
        </Text>
        <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    stepWrapper: {
      paddingBottom: 28,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
    },
    badgeIconWrapper: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.9,
      color: colors.success,
    },
    stepTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.4,
      marginBottom: 8,
    },
    stepDesc: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      marginBottom: 20,
    },
    blueprintCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 18,
      marginBottom: 16,
    },
    passHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    passTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 0.8,
    },
    passSubtitle: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1,
    },
    passBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surfaceSubtle,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    passBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 0.5,
    },
    passDivider: {
      height: 1,
      backgroundColor: colors.cardBorder,
      marginVertical: 14,
    },
    profileGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    profileItem: {
      width: '47%',
    },
    profileItemLabel: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    profileItemValue: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    targetSection: {
      marginBottom: 14,
    },
    targetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    targetSectionLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.7,
    },
    goalPill: {
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    goalPillText: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.primary,
    },
    targetCalorieRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
    },
    targetCalorieNumber: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    targetCalorieUnit: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    macroGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    macroTile: {
      flex: 1,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 10,
      padding: 10,
      alignItems: 'center',
      borderTopWidth: 3,
    },
    macroTileName: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    macroTileGrams: {
      fontSize: 17,
      fontWeight: '800',
      marginBottom: 2,
    },
    macroTileKcal: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    privacyCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 14,
      borderRadius: 14,
      marginBottom: 16,
    },
    privacyIconWrapper: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    privacyContent: {
      flex: 1,
    },
    privacyTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    privacyText: {
      fontSize: 11,
      lineHeight: 16,
      color: colors.textSecondary,
    },
    disclaimerText: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 16,
      lineHeight: 16,
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
  });
}
