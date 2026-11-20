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
  onNext: () => void;
}

export const StepActivityGoal: React.FC<StepActivityGoalProps> = ({
  activityLevel,
  setActivityLevel,
  goalType,
  setGoalType,
  onNext,
}) => {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.stepWrapper}>
      <View style={styles.badgeRow}>
        <Ionicons name="fitness" size={14} color={colors.primary} />
        <Text style={styles.badgeText}>ENERGY & OBJECTIVES</Text>
      </View>
      <Text style={styles.stepTitle}>Lifestyle & Primary Goal</Text>
      <Text style={styles.stepDesc}>
        Your activity level determines your Total Daily Energy Expenditure (TDEE). Your goal adjusts target calories and protein intake.
      </Text>

      {/* Activity Level */}
      <Text style={styles.inputLabel}>Activity Level</Text>
      <View style={styles.optionsList}>
        {ACTIVITY_OPTIONS.map((opt) => {
          const isSelected = activityLevel === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[styles.optionCard, isSelected && styles.optionCardSelected]}
              onPress={() => {
                safeHaptics.selection();
                setActivityLevel(opt.key);
              }}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.optionHeader}>
                  <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.multiplierBadge}>{opt.multiplier}</Text>
                </View>
                <Text style={styles.optionDesc}>{opt.desc}</Text>
              </View>
              <Ionicons
                name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={isSelected ? colors.primary : colors.textMuted}
              />
            </Pressable>
          );
        })}
      </View>

      {/* Goal Type */}
      <Text style={[styles.inputLabel, { marginTop: 16 }]}>Primary Goal</Text>
      <View style={styles.optionsList}>
        {GOAL_OPTIONS.map((opt) => {
          const isSelected = goalType === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[styles.optionCard, isSelected && styles.optionCardSelected]}
              onPress={() => {
                safeHaptics.selection();
                setGoalType(opt.key);
              }}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
            >
              <Ionicons
                name={opt.icon}
                size={22}
                color={isSelected ? colors.primary : colors.textMuted}
                style={{ marginRight: 10 }}
              />
              <View style={{ flex: 1 }}>
                <View style={styles.optionHeader}>
                  <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.multiplierBadge}>{opt.badge}</Text>
                </View>
                <Text style={styles.optionDesc}>{opt.desc}</Text>
              </View>
              <Ionicons
                name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={isSelected ? colors.primary : colors.textMuted}
              />
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel="Calculate Nutrition Targets"
      >
        <Text style={styles.primaryBtnText}>Calculate Nutrition Targets</Text>
        <Ionicons name="sparkles" size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    stepWrapper: {
      paddingBottom: 24,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      color: colors.primary,
    },
    stepTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
    },
    stepDesc: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    optionsList: {
      gap: 10,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
    },
    optionCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceSubtle,
    },
    optionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginRight: 8,
      marginBottom: 4,
    },
    optionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    optionTitleSelected: {
      color: colors.primary,
    },
    multiplierBadge: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      backgroundColor: colors.card,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    optionDesc: {
      fontSize: 13,
      color: colors.textMuted,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      gap: 8,
      marginTop: 20,
    },
    btnPressed: {
      opacity: 0.88,
    },
    primaryBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
}
