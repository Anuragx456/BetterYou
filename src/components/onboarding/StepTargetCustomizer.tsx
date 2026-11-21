import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  GoalType,
  MIN_CALORIE_FLOOR,
  NutritionTargetsResult,
  UserSex,
} from '../../utils/nutritionTargets';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors } from '../../theme/theme';
import { safeHaptics } from '../../utils/haptics';
import { validateTargets } from '../../utils/onboardingValidation';

interface CustomizerStepperRowProps {
  title: string;
  desc: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  value: number;
  unit: string;
  step: number;
  min: number;
  max: number;
  onValueChange: (val: number) => void;
  testIdMinus?: string;
  testIdPlus?: string;
  testIdInput?: string;
}

const CustomizerStepperRow: React.FC<CustomizerStepperRowProps> = ({
  title,
  desc,
  iconName,
  iconColor,
  iconBg,
  value,
  unit,
  step,
  min,
  max,
  onValueChange,
  testIdMinus,
  testIdPlus,
  testIdInput,
}) => {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [textValue, setTextValue] = useState<string>(String(value));

  useEffect(() => {
    setTextValue(String(value));
  }, [value]);

  const handleBlur = () => {
    const parsed = parseInt(textValue, 10);
    const clamped = isNaN(parsed) || parsed < min ? min : parsed > max ? max : parsed;
    setTextValue(String(clamped));
    onValueChange(clamped);
  };

  return (
    <View style={styles.adjustCard}>
      <View style={styles.adjustLeft}>
        <View style={[styles.macroIconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={iconName} size={18} color={iconColor} />
        </View>
        <View style={styles.adjustTextWrapper}>
          <Text style={styles.adjustTitle}>{title}</Text>
          <Text style={styles.adjustDesc}>{desc}</Text>
        </View>
      </View>

      <View style={styles.stepperControl}>
        <Pressable
          style={styles.stepperBtn}
          onPress={() => {
            safeHaptics.selection();
            const nextVal = Math.max(min, value - step);
            setTextValue(String(nextVal));
            onValueChange(nextVal);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${title.toLowerCase()}`}
          testID={testIdMinus}
        >
          <Ionicons name="remove" size={16} color={colors.text} />
        </Pressable>

        <View style={styles.stepperValueBox}>
          <TextInput
            style={styles.stepperInput}
            keyboardType="numeric"
            value={textValue}
            onChangeText={(txt) => {
              setTextValue(txt);
              const parsed = parseInt(txt, 10);
              if (!isNaN(parsed)) {
                onValueChange(parsed);
              }
            }}
            onBlur={handleBlur}
            testID={testIdInput}
          />
          <Text style={styles.stepperUnit}>{unit}</Text>
        </View>

        <Pressable
          style={styles.stepperBtn}
          onPress={() => {
            safeHaptics.selection();
            const nextVal = Math.min(max, value + step);
            setTextValue(String(nextVal));
            onValueChange(nextVal);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${title.toLowerCase()}`}
          testID={testIdPlus}
        >
          <Ionicons name="add" size={16} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
};

interface StepTargetCustomizerProps {
  goalType: GoalType;
  sex: UserSex | null;
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

  // Live targets validation
  const targetError = useMemo(() => {
    return validateTargets({
      calories: customCalories,
      protein: customProtein,
      carbs: customCarbs,
      fat: customFat,
      sex,
    });
  }, [customCalories, customProtein, customCarbs, customFat, sex]);

  // Calculate live macro caloric split and percentages
  const macroBreakdown = useMemo(() => {
    const proteinKcal = Math.max(0, customProtein * 4);
    const carbsKcal = Math.max(0, customCarbs * 4);
    const fatKcal = Math.max(0, customFat * 9);
    const totalMacroKcal = proteinKcal + carbsKcal + fatKcal || 1;

    const proteinPct = Math.round((proteinKcal / totalMacroKcal) * 100);
    const carbsPct = Math.round((carbsKcal / totalMacroKcal) * 100);
    const fatPct = Math.max(0, 100 - proteinPct - carbsPct);

    const netDelta = customCalories - computedTargets.tdee;
    let deltaText = 'Maintenance (0 kcal)';
    if (netDelta < -10) {
      deltaText = `${netDelta} kcal deficit`;
    } else if (netDelta > 10) {
      deltaText = `+${netDelta} kcal surplus`;
    }

    return {
      proteinKcal,
      carbsKcal,
      fatKcal,
      proteinPct,
      carbsPct,
      fatPct,
      deltaText,
      netDelta,
    };
  }, [customCalories, customProtein, customCarbs, customFat, computedTargets.tdee]);

  const handleResetToComputed = () => {
    safeHaptics.impactLight();
    setCustomCalories(computedTargets.calories);
    setCustomProtein(computedTargets.proteinGrams);
    setCustomCarbs(computedTargets.carbsGrams);
    setCustomFat(computedTargets.fatGrams);
    setIsTargetsTouched(false);
  };

  const calorieMin = Math.max(1000, sex ? MIN_CALORIE_FLOOR[sex] : 1200);

  return (
    <View style={styles.stepWrapper}>
      {/* Category Tag */}
      <View style={styles.badgeRow}>
        <View style={styles.badgeIconWrapper}>
          <Ionicons name="calculator" size={13} color={colors.primary} />
        </View>
        <Text style={styles.badgeText}>METABOLIC SCIENCE</Text>
      </View>

      <Text style={styles.stepTitle}>Your Daily Nutrition Targets</Text>
      <Text style={styles.stepDesc}>
        Computed from your physiological stats and {goalType} objective. Adjust the numbers below to align with your personal nutrition preferences.
      </Text>

      {/* Hero Metabolic Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <Text style={styles.heroSubheader}>DAILY CALORIC ENVELOPE</Text>
          <View style={styles.goalTag}>
            <Text style={styles.goalTagText}>
              {goalType === 'cut' ? 'DEFICIT' : goalType === 'bulk' ? 'SURPLUS' : 'MAINTAIN'}
            </Text>
          </View>
        </View>

        {/* Big Number */}
        <View style={styles.heroNumberRow}>
          <Text style={styles.heroBigNumber}>{customCalories.toLocaleString()}</Text>
          <Text style={styles.heroUnit}>kcal / day</Text>
        </View>

        <Text style={styles.heroDeltaText}>{macroBreakdown.deltaText}</Text>

        {/* Science Triad: BMR, TDEE, Target */}
        <View style={styles.triadDivider} />
        <View style={styles.triadRow}>
          <View style={styles.triadItem}>
            <Text style={styles.triadLabel}>BMR</Text>
            <Text style={styles.triadValue}>{computedTargets.bmr}</Text>
            <Text style={styles.triadHint}>Basal burn</Text>
          </View>
          <View style={styles.triadLine} />
          <View style={styles.triadItem}>
            <Text style={styles.triadLabel}>TDEE</Text>
            <Text style={styles.triadValue}>{computedTargets.tdee}</Text>
            <Text style={styles.triadHint}>Daily expenditure</Text>
          </View>
          <View style={styles.triadLine} />
          <View style={styles.triadItem}>
            <Text style={styles.triadLabel}>TARGET</Text>
            <Text style={[styles.triadValue, { color: colors.primary }]}>{customCalories}</Text>
            <Text style={styles.triadHint}>Daily intake</Text>
          </View>
        </View>

        {/* Safety Floor Notice */}
        {computedTargets.isClampedForSafety && (
          <View style={styles.safetyClampNotice}>
            <Ionicons name="shield-checkmark" size={15} color={colors.warning} />
            <Text style={styles.safetyClampText}>
              Protected by safety floor ({sex === 'female' ? '≥1200' : '≥1500'} kcal/day minimum for health preservation).
            </Text>
          </View>
        )}
      </View>

      {/* Visual Macro Proportion Bar */}
      <View style={styles.macroRatioSection}>
        <View style={styles.macroRatioHeader}>
          <Text style={styles.inputLabel}>Macronutrient Energy Ratio</Text>
          <Pressable onPress={handleResetToComputed} accessibilityRole="button">
            <Text style={styles.resetLink}>Reset to formula</Text>
          </Pressable>
        </View>

        {/* Segmented Macro Bar */}
        <View style={styles.ratioBarContainer}>
          <View
            style={[
              styles.ratioBarSegment,
              { flex: macroBreakdown.proteinPct, backgroundColor: colors.protein },
            ]}
          />
          <View
            style={[
              styles.ratioBarSegment,
              { flex: macroBreakdown.carbsPct, backgroundColor: colors.carbs },
            ]}
          />
          <View
            style={[
              styles.ratioBarSegment,
              { flex: macroBreakdown.fatPct, backgroundColor: colors.fat },
            ]}
          />
        </View>

        {/* Macro Ratio Labels */}
        <View style={styles.ratioLabelsRow}>
          <View style={styles.ratioLabelItem}>
            <View style={[styles.ratioDot, { backgroundColor: colors.protein }]} />
            <Text style={styles.ratioItemText}>
              Protein {macroBreakdown.proteinPct}% ({customProtein}g)
            </Text>
          </View>
          <View style={styles.ratioLabelItem}>
            <View style={[styles.ratioDot, { backgroundColor: colors.carbs }]} />
            <Text style={styles.ratioItemText}>
              Carbs {macroBreakdown.carbsPct}% ({customCarbs}g)
            </Text>
          </View>
          <View style={styles.ratioLabelItem}>
            <View style={[styles.ratioDot, { backgroundColor: colors.fat }]} />
            <Text style={styles.ratioItemText}>
              Fat {macroBreakdown.fatPct}% ({customFat}g)
            </Text>
          </View>
        </View>
      </View>

      {/* Stepper Adjusters List */}
      <View style={styles.steppersList}>
        <CustomizerStepperRow
          title="Calories"
          desc="Overall energy target"
          iconName="flame-outline"
          iconColor={colors.primary}
          iconBg={colors.primaryMuted}
          value={customCalories}
          unit="kcal"
          step={50}
          min={calorieMin}
          max={6000}
          onValueChange={(val) => {
            setIsTargetsTouched(true);
            setCustomCalories(val);
          }}
          testIdMinus="onboarding-stepper-cal-minus"
          testIdPlus="onboarding-stepper-cal-plus"
          testIdInput="onboarding-stepper-cal-input"
        />

        <CustomizerStepperRow
          title="Protein"
          desc={`${goalType === 'cut' ? '2.0 g/kg' : '1.8 g/kg'} lean mass protection`}
          iconName="fitness-outline"
          iconColor={colors.protein}
          iconBg={colors.softBlue}
          value={customProtein}
          unit="g"
          step={5}
          min={30}
          max={400}
          onValueChange={(val) => {
            setIsTargetsTouched(true);
            setCustomProtein(val);
          }}
          testIdMinus="onboarding-stepper-pro-minus"
          testIdPlus="onboarding-stepper-pro-plus"
          testIdInput="onboarding-stepper-pro-input"
        />

        <CustomizerStepperRow
          title="Carbohydrates"
          desc="Glycolytic energy & performance"
          iconName="nutrition-outline"
          iconColor={colors.carbs}
          iconBg={colors.softGreen}
          value={customCarbs}
          unit="g"
          step={5}
          min={0}
          max={800}
          onValueChange={(val) => {
            setIsTargetsTouched(true);
            setCustomCarbs(val);
          }}
          testIdMinus="onboarding-stepper-carb-minus"
          testIdPlus="onboarding-stepper-carb-plus"
          testIdInput="onboarding-stepper-carb-input"
        />

        <CustomizerStepperRow
          title="Fats"
          desc="Hormonal synthesis & joints"
          iconName="water-outline"
          iconColor={colors.fat}
          iconBg={colors.softOrange}
          value={customFat}
          unit="g"
          step={5}
          min={20}
          max={300}
          onValueChange={(val) => {
            setIsTargetsTouched(true);
            setCustomFat(val);
          }}
          testIdMinus="onboarding-stepper-fat-minus"
          testIdPlus="onboarding-stepper-fat-plus"
          testIdInput="onboarding-stepper-fat-input"
        />
      </View>

      {/* Inline warning above button */}
      {targetError ? (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={16} color={colors.warning} />
          <Text style={styles.errorText}>{targetError}</Text>
        </View>
      ) : null}

      {/* Review CTA */}
      <Pressable
        style={({ pressed }) => [
          styles.primaryBtn,
          Boolean(targetError) && styles.primaryBtnDisabled,
          pressed && !targetError && styles.btnPressed,
        ]}
        onPress={onNext}
        disabled={Boolean(targetError)}
        accessibilityRole="button"
        accessibilityLabel="Review and confirm nutrition plan"
        testID="onboarding-step3-next"
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
      marginBottom: 20,
    },
    heroCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 18,
      marginBottom: 20,
    },
    heroHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    heroSubheader: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.8,
    },
    goalTag: {
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    goalTagText: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 0.6,
    },
    heroNumberRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      marginTop: 2,
    },
    heroBigNumber: {
      fontSize: 40,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -1,
    },
    heroUnit: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    heroDeltaText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
      marginTop: 2,
      marginBottom: 12,
    },
    triadDivider: {
      height: 1,
      backgroundColor: colors.cardBorder,
      marginVertical: 12,
    },
    triadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
    },
    triadItem: {
      alignItems: 'center',
      flex: 1,
    },
    triadLine: {
      width: 1,
      height: 32,
      backgroundColor: colors.cardBorder,
    },
    triadLabel: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    triadValue: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    triadHint: {
      fontSize: 10,
      color: colors.textSecondary,
      marginTop: 1,
    },
    safetyClampNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.25)',
      padding: 10,
      borderRadius: 10,
      marginTop: 14,
    },
    safetyClampText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 16,
      color: colors.warning,
      fontWeight: '600',
    },
    macroRatioSection: {
      marginBottom: 18,
    },
    macroRatioHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    resetLink: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    ratioBarContainer: {
      flexDirection: 'row',
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      gap: 2,
      marginBottom: 8,
    },
    ratioBarSegment: {
      height: '100%',
      borderRadius: 2,
    },
    ratioLabelsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    ratioLabelItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    ratioDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    ratioItemText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    steppersList: {
      gap: 10,
      marginBottom: 16,
    },
    adjustCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 14,
      padding: 12,
    },
    adjustLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    macroIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    adjustTextWrapper: {
      flex: 1,
    },
    adjustTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    adjustDesc: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1,
    },
    stepperControl: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 10,
      overflow: 'hidden',
    },
    stepperBtn: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      minHeight: 44,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperValueBox: {
      flexDirection: 'row',
      alignItems: 'baseline',
      minWidth: 54,
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    stepperInput: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      paddingVertical: 2,
    },
    stepperUnit: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      marginLeft: 2,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.3)',
      borderRadius: 10,
      padding: 10,
      marginBottom: 12,
    },
    errorText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 16,
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
      marginTop: 6,
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
