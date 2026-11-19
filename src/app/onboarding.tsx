import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dbSetDailyGoals, dbUpsertUserProfile } from '../db/client';
import { useFitnessStore } from '../store/useFitnessStore';
import { useSettingsStore } from '../store/useSettingsStore';
import type { ThemeColors } from '../theme/colors';
import { useThemeColors, useThemedStyles } from '../theme/theme';
import { safeHaptics } from '../utils/haptics';
import {
  ActivityLevel,
  calculateNutritionTargets,
  GoalType,
  UserSex,
} from '../utils/nutritionTargets';

const ACTIVITY_OPTIONS: {
  key: ActivityLevel;
  label: string;
  desc: string;
  multiplier: string;
}[] = [
  { key: 'sedentary', label: 'Sedentary', desc: 'Little to no exercise, desk work', multiplier: '1.20x' },
  { key: 'light', label: 'Lightly Active', desc: 'Light exercise 1–3 days/week', multiplier: '1.38x' },
  { key: 'moderate', label: 'Moderately Active', desc: 'Moderate exercise 3–5 days/week', multiplier: '1.55x' },
  { key: 'very_active', label: 'Very Active', desc: 'Hard training 6–7 days/week', multiplier: '1.73x' },
  { key: 'extra_active', label: 'Extra Active', desc: 'Intense daily training or physical job', multiplier: '1.90x' },
];

const GOAL_OPTIONS: {
  key: GoalType;
  label: string;
  badge: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'cut', label: 'Cut (Fat Loss)', badge: '-500 kcal', desc: 'Caloric deficit, 2.0g/kg protein protection', icon: 'flame' },
  { key: 'maintain', label: 'Maintain (Recomp)', badge: 'TDEE', desc: 'Weight stability, body recomposition', icon: 'scale' },
  { key: 'bulk', label: 'Bulk (Muscle Gain)', badge: '+300 kcal', desc: 'Lean surplus for progressive overload', icon: 'barbell' },
];

export default function OnboardingScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ recalculate?: string }>();
  const isRecalculating = params.recalculate === 'true';

  const hasCompletedOnboarding = useSettingsStore((state) => state.hasCompletedOnboarding);
  const setHasCompletedOnboarding = useSettingsStore((state) => state.setHasCompletedOnboarding);
  const updateDailyGoalsInStore = useFitnessStore((state) => state.updateDailyGoals);

  // Step state (0 to 3)
  const [currentStep, setCurrentStep] = useState<number>(0);

  // Step 1: Profile inputs
  const [sex, setSex] = useState<UserSex>('male');
  const [ageStr, setAgeStr] = useState<string>('26');
  const [heightStr, setHeightStr] = useState<string>('175');
  const [weightStr, setWeightStr] = useState<string>('72');

  // Step 2: Activity & Goal
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [goalType, setGoalType] = useState<GoalType>('cut');

  // Step 3: Custom Adjusted Targets (initialized when stepping to step 2/3)
  const [customCalories, setCustomCalories] = useState<number>(2200);
  const [customProtein, setCustomProtein] = useState<number>(145);
  const [customCarbs, setCustomCarbs] = useState<number>(250);
  const [customFat, setCustomFat] = useState<number>(60);
  const [isTargetsTouched, setIsTargetsTouched] = useState<boolean>(false);

  // Computed targets from physiological formula
  const computedTargets = useMemo(() => {
    const age = Math.max(12, Math.min(100, parseInt(ageStr, 10) || 25));
    const heightCm = Math.max(100, Math.min(250, parseFloat(heightStr) || 170));
    const weightKg = Math.max(30, Math.min(250, parseFloat(weightStr) || 70));

    return calculateNutritionTargets({
      age,
      sex,
      heightCm,
      weightKg,
      activityLevel,
      goalType,
    });
  }, [ageStr, heightStr, weightStr, sex, activityLevel, goalType]);

  const handleNextFromStep1 = () => {
    const age = parseInt(ageStr, 10);
    const height = parseFloat(heightStr);
    const weight = parseFloat(weightStr);

    if (isNaN(age) || age < 12 || age > 110) {
      safeHaptics.warning();
      Alert.alert('Invalid Age', 'Please enter a valid age between 12 and 110.');
      return;
    }
    if (isNaN(height) || height < 100 || height > 250) {
      safeHaptics.warning();
      Alert.alert('Invalid Height', 'Please enter a valid height in cm (100–250 cm).');
      return;
    }
    if (isNaN(weight) || weight < 30 || weight > 250) {
      safeHaptics.warning();
      Alert.alert('Invalid Weight', 'Please enter a valid weight in kg (30–250 kg).');
      return;
    }

    safeHaptics.selection();
    setCurrentStep(1);
  };

  const handleNextFromStep2 = () => {
    safeHaptics.selection();
    if (!isTargetsTouched) {
      setCustomCalories(computedTargets.calories);
      setCustomProtein(computedTargets.proteinGrams);
      setCustomCarbs(computedTargets.carbsGrams);
      setCustomFat(computedTargets.fatGrams);
    }
    setCurrentStep(2);
  };

  const handleNextFromStep3 = () => {
    safeHaptics.selection();
    setCurrentStep(3);
  };

  const handleFinishAndSave = async () => {
    try {
      safeHaptics.impactMedium();
      const age = parseInt(ageStr, 10) || 25;
      const heightCm = parseFloat(heightStr) || 175;
      const weightKg = parseFloat(weightStr) || 70;

      // 1. Persist User Profile in SQLite
      await dbUpsertUserProfile({
        age,
        sex,
        heightCm,
        weightKg,
        activityLevel,
        goalType,
      });

      // 2. Persist Daily Goals in SQLite
      const updatedGoals = await dbSetDailyGoals({
        calorieTarget: customCalories,
        proteinTargetGrams: customProtein,
        carbsTargetGrams: customCarbs,
        fatTargetGrams: customFat,
      });

      // 3. Update Zustand Store & SQLite
      await updateDailyGoalsInStore(updatedGoals);
      setHasCompletedOnboarding(true);

      safeHaptics.success();
      if (isRecalculating) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: unknown) {
      safeHaptics.error();
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Save Error', `Failed to save targets: ${msg}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header with step progress indicator */}
        <View style={styles.header}>
          {(isRecalculating || hasCompletedOnboarding || currentStep > 0) ? (
            <Pressable
              onPress={() => {
                if (currentStep > 0) {
                  safeHaptics.selection();
                  setCurrentStep((prev) => prev - 1);
                } else {
                  router.back();
                }
              }}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}

          <View style={styles.stepIndicatorContainer}>
            {[0, 1, 2, 3].map((stepIdx) => (
              <View
                key={stepIdx}
                style={[
                  styles.stepBar,
                  stepIdx <= currentStep ? styles.stepBarActive : styles.stepBarInactive,
                ]}
              />
            ))}
          </View>

          <Text style={styles.stepLabel}>Step {currentStep + 1} of 4</Text>
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* STEP 1: Basic Profile */}
          {currentStep === 0 && (
            <View style={styles.stepWrapper}>
              <View style={styles.badgeRow}>
                <Ionicons name="person" size={14} color={colors.primary} />
                <Text style={styles.badgeText}>PHYSIOLOGICAL PROFILE</Text>
              </View>
              <Text style={styles.stepTitle}>Tell Us About Yourself</Text>
              <Text style={styles.stepDesc}>
                BetterYou calculates your precise Basal Metabolic Rate (BMR) using the clinically validated Mifflin-St Jeor formula.
              </Text>

              {/* Sex Selector */}
              <Text style={styles.inputLabel}>Biological Sex</Text>
              <View style={styles.sexRow}>
                <Pressable
                  style={[styles.sexCard, sex === 'male' && styles.sexCardSelected]}
                  onPress={() => {
                    safeHaptics.selection();
                    setSex('male');
                  }}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="man"
                    size={28}
                    color={sex === 'male' ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.sexCardText, sex === 'male' && styles.sexCardTextSelected]}>
                    Male
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.sexCard, sex === 'female' && styles.sexCardSelected]}
                  onPress={() => {
                    safeHaptics.selection();
                    setSex('female');
                  }}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="woman"
                    size={28}
                    color={sex === 'female' ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.sexCardText, sex === 'female' && styles.sexCardTextSelected]}>
                    Female
                  </Text>
                </Pressable>
              </View>

              {/* Age */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Age (years)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={ageStr}
                  onChangeText={setAgeStr}
                  placeholder="25"
                  placeholderTextColor={colors.textMuted}
                  maxLength={3}
                />
              </View>

              {/* Height */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Height (cm)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={heightStr}
                  onChangeText={setHeightStr}
                  placeholder="175"
                  placeholderTextColor={colors.textMuted}
                  maxLength={3}
                />
              </View>

              {/* Weight */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Current Weight (kg)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  value={weightStr}
                  onChangeText={setWeightStr}
                  placeholder="70"
                  placeholderTextColor={colors.textMuted}
                  maxLength={5}
                />
              </View>

              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
                onPress={handleNextFromStep1}
                accessibilityRole="button"
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          )}

          {/* STEP 2: Activity Level & Goal */}
          {currentStep === 1 && (
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
                onPress={handleNextFromStep2}
                accessibilityRole="button"
              >
                <Text style={styles.primaryBtnText}>Calculate Nutrition Targets</Text>
                <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          )}

          {/* STEP 3: Target Calculation & Custom Adjustment */}
          {currentStep === 2 && (
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
                  >
                    <Ionicons name="add" size={18} color={colors.text} />
                  </Pressable>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
                onPress={handleNextFromStep3}
                accessibilityRole="button"
              >
                <Text style={styles.primaryBtnText}>Review & Confirm</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          )}

          {/* STEP 4: Summary & Save */}
          {currentStep === 3 && (
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
                onPress={handleFinishAndSave}
                accessibilityRole="button"
              >
                <Text style={styles.primaryBtnText}>
                  {isRecalculating ? 'Save & Update Goals' : 'Start My Journey'}
                </Text>
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    backBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
    stepIndicatorContainer: {
      flex: 1,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 12,
    },
    stepBar: {
      flex: 1,
      height: 4,
      borderRadius: 2,
    },
    stepBarActive: {
      backgroundColor: colors.primary,
    },
    stepBarInactive: {
      backgroundColor: colors.cardBorder,
    },
    stepLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    scrollContent: {
      flex: 1,
    },
    scrollContainer: {
      padding: 20,
      paddingBottom: 40,
    },
    stepWrapper: {
      gap: 12,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surfaceSubtle,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      alignSelf: 'flex-start',
    },
    badgeText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    stepTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
      marginTop: 4,
    },
    stepDesc: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 8,
    },
    inputGroup: {
      marginBottom: 12,
    },
    inputLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      minHeight: 48,
    },
    sexRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 14,
    },
    sexCard: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      borderRadius: 14,
      paddingVertical: 16,
      gap: 6,
      minHeight: 88,
    },
    sexCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceSubtle,
    },
    sexCardText: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: '700',
    },
    sexCardTextSelected: {
      color: colors.primary,
    },
    optionsList: {
      gap: 8,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      padding: 14,
      minHeight: 56,
    },
    optionCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceSubtle,
    },
    optionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    optionTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    optionTitleSelected: {
      color: colors.primary,
    },
    multiplierBadge: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      backgroundColor: colors.card,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
    },
    optionDesc: {
      color: colors.textMuted,
      fontSize: 12,
    },
    scienceCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 14,
      padding: 16,
      marginBottom: 8,
    },
    scienceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    scienceStat: {
      flex: 1,
      alignItems: 'center',
    },
    scienceStatLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 2,
    },
    scienceStatValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    scienceStatHint: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      height: 36,
      backgroundColor: colors.cardBorder,
    },
    safetyClampNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.3)',
      borderRadius: 8,
      padding: 8,
      marginTop: 12,
    },
    safetyClampText: {
      flex: 1,
      color: '#F59E0B',
      fontSize: 11,
      fontWeight: '600',
    },
    adjustRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      padding: 12,
      minHeight: 52,
    },
    adjustLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    adjustHint: {
      color: colors.textMuted,
      fontSize: 11,
    },
    stepperContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    stepperBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperInput: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      minWidth: 46,
      textAlign: 'center',
      padding: 0,
    },
    unitText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginRight: 4,
    },
    summaryCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 14,
      padding: 16,
      gap: 12,
    },
    summarySection: {
      gap: 4,
    },
    summarySectionTitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    summaryText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    summarySubtext: {
      color: colors.textMuted,
      fontSize: 13,
    },
    divider: {
      height: 1,
      backgroundColor: colors.cardBorder,
    },
    macroSummaryGrid: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 6,
    },
    macroBox: {
      flex: 1,
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 10,
      padding: 10,
      alignItems: 'center',
    },
    macroBoxVal: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    macroBoxLbl: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
      marginTop: 2,
    },
    privacyNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surfaceSubtle,
      padding: 12,
      borderRadius: 10,
      marginVertical: 4,
    },
    privacyNoticeText: {
      flex: 1,
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 14,
      paddingVertical: 14,
      minHeight: 52,
      marginTop: 12,
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
