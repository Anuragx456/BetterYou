import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ActivityLevel, GoalType } from '../../utils/nutritionTargets';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors } from '../../theme/theme';
import { safeHaptics } from '../../utils/haptics';
import { ACTIVITY_OPTIONS, GOAL_OPTIONS } from './constants';

interface StepActivityGoalProps {
  activityLevel: ActivityLevel;
  setActivityLevel: (level: ActivityLevel) => void;
  goalType: GoalType;
  setGoalType: (goal: GoalType) => void;
  bmi?: number;
  onNext: () => void;
}

export const StepActivityGoal: React.FC<StepActivityGoalProps> = ({
  activityLevel,
  setActivityLevel,
  goalType,
  setGoalType,
  bmi,
  onNext,
}) => {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  const isUnderweightCut = Boolean(bmi && bmi > 0 && bmi < 18.5 && goalType === 'cut');

  return (
    <View style={styles.stepWrapper}>
      {/* Category Tag */}
      <View style={styles.badgeRow}>
        <View style={styles.badgeIconWrapper}>
          <Ionicons name="fitness" size={13} color={colors.primary} />
        </View>
        <Text style={styles.badgeText}>ENERGY & OBJECTIVES</Text>
      </View>

      <Text style={styles.stepTitle}>Lifestyle & Primary Goal</Text>
      <Text style={styles.stepDesc}>
        Your activity multiplier establishes Total Daily Energy Expenditure (TDEE). Your objective guides the caloric adjustment and protein synthesis targets.
      </Text>

      {/* Activity Level Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.inputLabel}>Activity Level</Text>
        <Text style={styles.sectionHint}>Physical exertion factor</Text>
      </View>

      <View style={styles.optionsList}>
        {ACTIVITY_OPTIONS.map((opt) => {
          const isSelected = activityLevel === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[styles.activityCard, isSelected && styles.cardSelected]}
              onPress={() => {
                safeHaptics.selection();
                setActivityLevel(opt.key);
              }}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              testID={`onboarding-activity-${opt.key}`}
            >
              <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                {isSelected && <View style={styles.radioDot} />}
              </View>

              <View style={styles.activityInfo}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                    {opt.label}
                  </Text>
                </View>

                <Text style={styles.cardDesc}>{opt.desc}</Text>

                {/* Activity Intensity Meter */}
                <View style={styles.intensityRow}>
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <View
                      key={lvl}
                      style={[
                        styles.intensityDot,
                        lvl <= opt.level
                          ? isSelected
                            ? styles.intensityDotActive
                            : styles.intensityDotFilled
                          : styles.intensityDotInactive,
                      ]}
                    />
                  ))}
                  <Text style={styles.frequencyText}>{opt.frequency}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Primary Goal Section */}
      <View style={[styles.sectionHeader, { marginTop: 22 }]}>
        <Text style={styles.inputLabel}>Primary Goal</Text>
        <Text style={styles.sectionHint}>Target energy balance</Text>
      </View>

      <View style={styles.optionsList}>
        {GOAL_OPTIONS.map((opt) => {
          const isSelected = goalType === opt.key;

          // Theme colors for goal badges
          const iconColor =
            opt.key === 'cut'
              ? colors.primary
              : opt.key === 'maintain'
              ? colors.carbs
              : colors.protein;

          const iconBg =
            opt.key === 'cut'
              ? colors.primaryMuted
              : opt.key === 'maintain'
              ? colors.softGreen
              : colors.softBlue;

          return (
            <Pressable
              key={opt.key}
              style={[styles.goalCard, isSelected && styles.cardSelected]}
              onPress={() => {
                safeHaptics.selection();
                setGoalType(opt.key);
              }}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              testID={`onboarding-goal-${opt.key}`}
            >
              <View style={[styles.goalIconCircle, { backgroundColor: iconBg }]}>
                <Ionicons name={opt.icon} size={22} color={iconColor} />
              </View>

              <View style={styles.goalInfo}>
                <View style={styles.cardTitleRow}>
                  <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                    {opt.label}
                  </Text>
                  <View style={[styles.goalBadge, isSelected && styles.goalBadgeSelected]}>
                    <Text style={[styles.goalBadgeText, isSelected && styles.goalBadgeTextSelected]}>
                      {opt.badge}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardDesc}>{opt.desc}</Text>
                <Text style={styles.proteinHint}>{opt.proteinGuide}</Text>
              </View>

              <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                {isSelected && <View style={styles.radioDot} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Underweight + Cut warning box */}
      {isUnderweightCut && (
        <View style={styles.underweightWarning}>
          <Ionicons name="warning-outline" size={18} color={colors.warning} />
          <Text style={styles.underweightWarningText}>
            {"Your BMI is in the underweight range — a calorie deficit isn't recommended. Consider Maintain or Bulk, and talk to a doctor for personal advice."}
          </Text>
        </View>
      )}

      {/* CTA Button */}
      <Pressable
        style={({ pressed }) => [
          styles.primaryBtn,
          isUnderweightCut && styles.primaryBtnDisabled,
          pressed && !isUnderweightCut && styles.btnPressed,
        ]}
        onPress={onNext}
        disabled={isUnderweightCut}
        accessibilityRole="button"
        accessibilityLabel="Calculate nutrition targets"
        testID="onboarding-step2-next"
      >
        <Text style={styles.primaryBtnText}>Calculate Nutrition Targets</Text>
        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );
};

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
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.9,
      color: colors.primary,
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
      marginBottom: 22,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 10,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    sectionHint: {
      fontSize: 11,
      color: colors.textMuted,
    },
    optionsList: {
      gap: 10,
    },
    activityCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      gap: 12,
    },
    goalCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      gap: 12,
    },
    cardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceSubtle,
    },
    activityInfo: {
      flex: 1,
    },
    goalInfo: {
      flex: 1,
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    cardTitleSelected: {
      color: colors.primary,
    },
    cardDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    proteinHint: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: 4,
    },
    goalBadge: {
      backgroundColor: colors.surfaceSubtle,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    goalBadgeSelected: {
      backgroundColor: colors.primaryMuted,
    },
    goalBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    goalBadgeTextSelected: {
      color: colors.primary,
    },
    intensityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 8,
    },
    intensityDot: {
      width: 12,
      height: 4,
      borderRadius: 2,
    },
    intensityDotInactive: {
      backgroundColor: colors.cardBorder,
    },
    intensityDotFilled: {
      backgroundColor: colors.textMuted,
    },
    intensityDotActive: {
      backgroundColor: colors.primary,
    },
    frequencyText: {
      fontSize: 10,
      color: colors.textMuted,
      marginLeft: 6,
      fontWeight: '600',
    },
    goalIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    radioCircleSelected: {
      borderColor: colors.primary,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    underweightWarning: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.3)',
      borderRadius: 12,
      padding: 12,
      marginTop: 16,
    },
    underweightWarningText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      color: colors.warning,
      fontWeight: '600',
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      gap: 8,
      marginTop: 22,
    },
    primaryBtnDisabled: {
      opacity: 0.45,
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
