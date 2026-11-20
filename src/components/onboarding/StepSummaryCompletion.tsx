import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors } from '../../theme/theme';
import { ACTIVITY_OPTIONS, GOAL_OPTIONS } from './constants';
import type { ActivityLevel, GoalType } from '../../utils/nutritionTargets';

interface StepSummaryCompletionProps {
  sex: 'male' | 'female';
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

  return (
    <View style={styles.stepWrapper}>
      <View style={styles.badgeRow}>
        <Ionicons name="checkmark-done-circle" size={14} color="#10B981" />
        <Text style={[styles.badgeText, { color: '#10B981' }]}>SETUP COMPLETE</Text>
      </View>
      <Text style={styles.stepTitle}>Ready to Get Started!</Text>
      <Text style={styles.stepDesc}>
        Your personalized profile and nutrition goals will be securely stored in your local on-device SQLite database.
      </Text>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summarySection}>
          <Text style={styles.summarySectionTitle}>Profile Summary</Text>
          <Text style={styles.summaryText}>
            {sex === 'male' ? 'Male' : 'Female'} • {ageStr} yrs • {heightStr} cm • {weightStr} kg
          </Text>
          <Text style={styles.summarySubtext}>
            Activity: {ACTIVITY_OPTIONS.find((a) => a.key === activityLevel)?.label}
          </Text>
          <Text style={styles.summarySubtext}>
            Objective: {GOAL_OPTIONS.find((g) => g.key === goalType)?.label}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.summarySection}>
          <Text style={styles.summarySectionTitle}>Active Daily Targets</Text>
          <View style={styles.macroSummaryGrid}>
            <View style={styles.macroBox}>
              <Text style={styles.macroBoxVal}>{customCalories}</Text>
              <Text style={styles.macroBoxLbl}>CALORIES</Text>
            </View>
            <View style={styles.macroBox}>
              <Text style={[styles.macroBoxVal, { color: '#3B82F6' }]}>{customProtein}g</Text>
              <Text style={styles.macroBoxLbl}>PROTEIN</Text>
            </View>
            <View style={styles.macroBox}>
              <Text style={[styles.macroBoxVal, { color: '#F59E0B' }]}>{customCarbs}g</Text>
              <Text style={styles.macroBoxLbl}>CARBS</Text>
            </View>
            <View style={styles.macroBox}>
              <Text style={[styles.macroBoxVal, { color: '#EF4444' }]}>{customFat}g</Text>
              <Text style={styles.macroBoxLbl}>FATS</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.privacyNotice}>
        <Ionicons name="lock-closed" size={16} color={colors.primary} />
        <Text style={styles.privacyNoticeText}>
          BetterYou is strictly local-first. Your metrics and photos remain completely private on your device.
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
        onPress={onFinish}
        accessibilityRole="button"
      >
        <Text style={styles.primaryBtnText}>
          {isRecalculating ? 'Save & Update Goals' : 'Start My Journey'}
        </Text>
        <Ionicons name="checkmark" size={20} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    stepWrapper: {
      gap: 16,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
    },
    stepTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    stepDesc: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: 14,
    },
    summarySection: {
      gap: 4,
    },
    summarySectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    summaryText: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
    },
    summarySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: colors.cardBorder,
    },
    macroSummaryGrid: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    macroBox: {
      flex: 1,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 6,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    macroBoxVal: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    macroBoxLbl: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.textSecondary,
      marginTop: 2,
    },
    privacyNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.primary + '12',
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary + '25',
    },
    privacyNoticeText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      borderRadius: 14,
      marginTop: 8,
    },
    btnPressed: {
      opacity: 0.85,
    },
    primaryBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
