import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GoalType, UserSex, NutritionTargetsResult } from '../../utils/nutritionTargets';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors } from '../../theme/theme';
import { safeHaptics } from '../../utils/haptics';

interface StepTargetCustomizerProps {
  goalType: GoalType;
  sex: UserSex;
  computedTargets: NutritionTargetsResult;
  customCalories: number;
  setCustomCalories: React.Dispatch<React.SetStateAction<number>>;
  customProtein: number;
  setCustomProtein: React.Dispatch<React.SetStateAction<number>>;
  customCarbs: number;
  setCustomCarbs: React.Dispatch<React.SetStateAction<number>>;
  customFat: number;
  setCustomFat: React.Dispatch<React.SetStateAction<number>>;
  setIsTargetsTouched: (touched: boolean) => void;
  onNext: () => void;
}

export const StepTargetCustomizer: React.FC<StepTargetCustomizerProps> = ({
  goalType,
  sex,
  computedTargets,
  customCalories,
  setCustomCalories,
  customProtein,
  setCustomProtein,
  customCarbs,
  setCustomCarbs,
  customFat,
  setCustomFat,
  setIsTargetsTouched,
  onNext,
}) => {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.stepWrapper}>
      <View style={styles.badgeRow}>
        <Ionicons name="calculator" size={14} color={colors.primary} />
        <Text style={styles.badgeText}>METABOLIC SCIENCE</Text>
      </View>
      <Text style={styles.stepTitle}>Your Daily Nutrition Targets</Text>
      <Text style={styles.stepDesc}>
        Based on your physiological stats and {goalType} objective. You can adjust the numbers below to match your preferences.
      </Text>

      {/* Science Breakdown Card */}
      <View style={styles.scienceCard}>
        <View style={styles.scienceRow}>
          <View style={styles.scienceStat}>
            <Text style={styles.scienceStatLabel}>BMR</Text>
            <Text style={styles.scienceStatValue}>{computedTargets.bmr} kcal</Text>
            <Text style={styles.scienceStatHint}>Basal metabolic burn</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.scienceStat}>
            <Text style={styles.scienceStatLabel}>TDEE</Text>
            <Text style={styles.scienceStatValue}>{computedTargets.tdee} kcal</Text>
            <Text style={styles.scienceStatHint}>Daily energy burn</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.scienceStat}>
            <Text style={styles.scienceStatLabel}>Target</Text>
            <Text style={[styles.scienceStatValue, { color: colors.primary }]}>
              {customCalories} kcal
            </Text>
            <Text style={styles.scienceStatHint}>{goalType.toUpperCase()}</Text>
          </View>
        </View>

        {computedTargets.isClampedForSafety && (
          <View style={styles.safetyClampNotice}>
            <Ionicons name="shield-checkmark" size={14} color="#F59E0B" />
            <Text style={styles.safetyClampText}>
              Protected by safety floor ({sex === 'female' ? '≥1200' : '≥1500'} kcal/day minimum for health preservation).
            </Text>
          </View>
        )}
      </View>

      {/* Interactive Target Adjusters */}
      <Text style={[styles.inputLabel, { marginTop: 16 }]}>Adjust Targets</Text>

      {/* Calories */}
      <View style={styles.adjustRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.adjustLabel}>Calories</Text>
          <Text style={styles.adjustHint}>Total daily intake</Text>
        </View>
        <View style={styles.stepperContainer}>
          <Pressable
            style={styles.stepperBtn}
            onPress={() => {
              safeHaptics.selection();
              setIsTargetsTouched(true);
              setCustomCalories((prev) => Math.max(1000, prev - 50));
            }}
            accessibilityRole="button"
            accessibilityLabel="Decrease calories"
          >
            <Ionicons name="remove" size={18} color={colors.text} />
          </Pressable>
          <TextInput
            style={styles.stepperInput}
            keyboardType="numeric"
            value={String(customCalories)}
            onChangeText={(txt) => {
              setIsTargetsTouched(true);
              setCustomCalories(parseInt(txt, 10) || 0);
            }}
          />
          <Text style={styles.unitText}>kcal</Text>
          <Pressable
            style={styles.stepperBtn}
            onPress={() => {
              safeHaptics.selection();
              setIsTargetsTouched(true);
              setCustomCalories((prev) => prev + 50);
            }}
            accessibilityRole="button"
            accessibilityLabel="Increase calories"
          >
            <Ionicons name="add" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Protein */}
      <View style={styles.adjustRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.adjustLabel}>Protein</Text>
          <Text style={styles.adjustHint}>
            {goalType === 'cut' ? '2.0' : '1.8'} g/kg bodyweight
          </Text>
        </View>
        <View style={styles.stepperContainer}>
          <Pressable
            style={styles.stepperBtn}
            onPress={() => {
              safeHaptics.selection();
              setIsTargetsTouched(true);
              setCustomProtein((prev) => Math.max(30, prev - 5));
            }}
            accessibilityRole="button"
            accessibilityLabel="Decrease protein"
          >
            <Ionicons name="remove" size={18} color={colors.text} />
          </Pressable>
          <TextInput
            style={styles.stepperInput}
            keyboardType="numeric"
            value={String(customProtein)}
            onChangeText={(txt) => {
              setIsTargetsTouched(true);
              setCustomProtein(parseInt(txt, 10) || 0);
            }}
          />
          <Text style={styles.unitText}>g</Text>
          <Pressable
            style={styles.stepperBtn}
            onPress={() => {
              safeHaptics.selection();
              setIsTargetsTouched(true);
              setCustomProtein((prev) => prev + 5);
            }}
            accessibilityRole="button"
            accessibilityLabel="Increase protein"
          >
            <Ionicons name="add" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Carbs */}
      <View style={styles.adjustRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.adjustLabel}>Carbohydrates</Text>
          <Text style={styles.adjustHint}>Primary training fuel</Text>
        </View>
        <View style={styles.stepperContainer}>
          <Pressable
            style={styles.stepperBtn}
            onPress={() => {
              safeHaptics.selection();
              setIsTargetsTouched(true);
              setCustomCarbs((prev) => Math.max(20, prev - 5));
            }}
            accessibilityRole="button"
            accessibilityLabel="Decrease carbohydrates"
          >
            <Ionicons name="remove" size={18} color={colors.text} />
          </Pressable>
          <TextInput
            style={styles.stepperInput}
            keyboardType="numeric"
            value={String(customCarbs)}
            onChangeText={(txt) => {
              setIsTargetsTouched(true);
              setCustomCarbs(parseInt(txt, 10) || 0);
            }}
          />
          <Text style={styles.unitText}>g</Text>
          <Pressable
            style={styles.stepperBtn}
            onPress={() => {
              safeHaptics.selection();
              setIsTargetsTouched(true);
              setCustomCarbs((prev) => prev + 5);
            }}
            accessibilityRole="button"
            accessibilityLabel="Increase carbohydrates"
          >
            <Ionicons name="add" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Fat */}
      <View style={styles.adjustRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.adjustLabel}>Fats</Text>
          <Text style={styles.adjustHint}>25% energy for hormonal health</Text>
        </View>
        <View style={styles.stepperContainer}>
          <Pressable
            style={styles.stepperBtn}
            onPress={() => {
              safeHaptics.selection();
              setIsTargetsTouched(true);
              setCustomFat((prev) => Math.max(20, prev - 5));
            }}
            accessibilityRole="button"
            accessibilityLabel="Decrease fats"
          >
            <Ionicons name="remove" size={18} color={colors.text} />
          </Pressable>
          <TextInput
            style={styles.stepperInput}
            keyboardType="numeric"
            value={String(customFat)}
            onChangeText={(txt) => {
              setIsTargetsTouched(true);
              setCustomFat(parseInt(txt, 10) || 0);
            }}
          />
          <Text style={styles.unitText}>g</Text>
          <Pressable
            style={styles.stepperBtn}
            onPress={() => {
              safeHaptics.selection();
              setIsTargetsTouched(true);
              setCustomFat((prev) => prev + 5);
            }}
            accessibilityRole="button"
            accessibilityLabel="Increase fats"
          >
            <Ionicons name="add" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel="Review and confirm"
      >
        <Text style={styles.primaryBtnText}>Review & Confirm</Text>
        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
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
    scienceCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 16,
      marginBottom: 16,
    },
    scienceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
    },
    scienceStat: {
      alignItems: 'center',
      flex: 1,
    },
    statDivider: {
      width: 1,
      height: 36,
      backgroundColor: colors.cardBorder,
    },
    scienceStatLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    scienceStatValue: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 2,
    },
    scienceStatHint: {
      fontSize: 10,
      color: colors.textMuted,
      textAlign: 'center',
    },
    safetyClampNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      padding: 10,
      borderRadius: 8,
      marginTop: 12,
    },
    safetyClampText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 16,
      color: '#F59E0B',
      fontWeight: '600',
    },
    adjustRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    adjustLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    adjustHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    stepperContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 10,
      overflow: 'hidden',
    },
    stepperBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surfaceSubtle,
    },
    stepperInput: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      minWidth: 48,
      paddingHorizontal: 4,
    },
    unitText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginRight: 6,
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
