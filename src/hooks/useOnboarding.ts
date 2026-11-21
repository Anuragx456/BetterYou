import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ActivityLevel,
  GoalType,
  UserSex,
  calculateNutritionTargets,
} from '../utils/nutritionTargets';
import {
  dbGetDailyGoals,
  dbGetUserProfile,
  dbSetDailyGoals,
  dbUpsertUserProfile,
} from '../db/client';
import { useFitnessStore } from '../store/useFitnessStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { safeHaptics } from '../utils/haptics';
import { calculateBmi, validateBasics } from '../utils/onboardingValidation';

export function useOnboarding() {
  const router = useRouter();
  const params = useLocalSearchParams<{ recalculate?: string }>();
  const isRecalculating = params.recalculate === 'true';

  const hasCompletedOnboarding = useSettingsStore((state) => state.hasCompletedOnboarding);
  const setHasCompletedOnboarding = useSettingsStore((state) => state.setHasCompletedOnboarding);
  const updateDailyGoalsInStore = useFitnessStore((state) => state.updateDailyGoals);
  const logBodyWeight = useFitnessStore((state) => state.logBodyWeight);
  const bodyMeasurements = useFitnessStore((state) => state.bodyMeasurements);

  // Step state (0 to 3)
  const [currentStep, setCurrentStep] = useState<number>(0);

  // Step 1: Profile inputs (Task 1: sex starts null, inputs start empty)
  const [sex, setSex] = useState<UserSex | null>(null);
  const [ageStr, setAgeStr] = useState<string>('');
  const [heightStr, setHeightStr] = useState<string>('');
  const [weightStr, setWeightStr] = useState<string>('');

  // Step 2: Activity & Goal
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [goalType, setGoalType] = useState<GoalType>('cut');

  // Step 3: Custom Adjusted Targets (initialized when stepping to step 2/3)
  const [customCalories, setCustomCalories] = useState<number>(2200);
  const [customProtein, setCustomProtein] = useState<number>(145);
  const [customCarbs, setCustomCarbs] = useState<number>(250);
  const [customFat, setCustomFat] = useState<number>(60);
  const [isTargetsTouched, setIsTargetsTouched] = useState<boolean>(false);

  // Task 2: Prefill real profile and goals on mount once
  const loadedRef = useRef<boolean>(false);
  const hasTypedRef = useRef<boolean>(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    async function prefillSavedData() {
      try {
        const profile = await dbGetUserProfile();
        if (profile) {
          if (!hasTypedRef.current) {
            setSex((prev) => prev ?? profile.sex);
            setAgeStr((prev) => (prev === '' ? String(profile.age) : prev));
            setHeightStr((prev) => (prev === '' ? String(profile.heightCm) : prev));
            setWeightStr((prev) => (prev === '' ? String(profile.weightKg) : prev));
            setActivityLevel(profile.activityLevel);
            setGoalType(profile.goalType);
          }
        }

        const goals = await dbGetDailyGoals();
        if (goals) {
          setCustomCalories(goals.calorieTarget);
          setCustomProtein(goals.proteinTargetGrams);
          setCustomCarbs(goals.carbsTargetGrams);
          setCustomFat(goals.fatTargetGrams);
          setIsTargetsTouched(true);
        }
      } catch {
        // Silently continue if database read fails
      }
    }

    prefillSavedData();
  }, []);

  const handleSetAgeStr = (val: string) => {
    hasTypedRef.current = true;
    setAgeStr(val);
  };

  const handleSetHeightStr = (val: string) => {
    hasTypedRef.current = true;
    setHeightStr(val);
  };

  const handleSetWeightStr = (val: string) => {
    hasTypedRef.current = true;
    setWeightStr(val);
  };

  const handleSetSex = (val: UserSex | null) => {
    hasTypedRef.current = true;
    setSex(val);
  };

  // Validation for Step 1
  const basicsValidation = useMemo(
    () => validateBasics({ sex, ageStr, heightStr, weightStr }),
    [sex, ageStr, heightStr, weightStr]
  );

  // BMI calculation for Step 1 and Step 2 guardrail
  const bmi = useMemo(() => {
    const h = parseFloat(heightStr);
    const w = parseFloat(weightStr);
    return calculateBmi(w, h);
  }, [heightStr, weightStr]);

  // Computed targets from physiological formula
  const computedTargets = useMemo(() => {
    const age = Math.max(12, Math.min(100, parseInt(ageStr, 10) || 25));
    const heightCm = Math.max(100, Math.min(250, parseFloat(heightStr) || 170));
    const weightKg = Math.max(30, Math.min(250, parseFloat(weightStr) || 70));

    return calculateNutritionTargets({
      age,
      sex: sex ?? 'male',
      heightCm,
      weightKg,
      activityLevel,
      goalType,
    });
  }, [ageStr, heightStr, weightStr, sex, activityLevel, goalType]);

  const handleNextFromStep1 = () => {
    if (!basicsValidation.valid) {
      safeHaptics.warning();
      const firstError =
        basicsValidation.errors.sex ||
        basicsValidation.errors.age ||
        basicsValidation.errors.height ||
        basicsValidation.errors.weight;
      Alert.alert('Incomplete Profile', firstError || 'Please fill in all fields correctly.');
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

  const handleSkip = () => {
    safeHaptics.impactLight();
    setHasCompletedOnboarding(true);
    router.replace('/(tabs)');
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
        sex: sex ?? 'male',
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

      // Task 6: Seed initial bodyweight measurement if none exists today
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const hasTodayMeasurement = bodyMeasurements.some((m) => {
          const dateStr = typeof m.date === 'string' ? m.date : '';
          return dateStr.startsWith(todayStr);
        });
        if (!hasTodayMeasurement && weightKg > 0) {
          await logBodyWeight(weightKg, 'Onboarding');
        }
      } catch {
        // Never block finishing onboarding
      }

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

  return {
    currentStep,
    setCurrentStep,
    isRecalculating,
    hasCompletedOnboarding,
    sex,
    setSex: handleSetSex,
    ageStr,
    setAgeStr: handleSetAgeStr,
    heightStr,
    setHeightStr: handleSetHeightStr,
    weightStr,
    setWeightStr: handleSetWeightStr,
    activityLevel,
    setActivityLevel,
    goalType,
    setGoalType,
    customCalories,
    setCustomCalories,
    customProtein,
    setCustomProtein,
    customCarbs,
    setCustomCarbs,
    customFat,
    setCustomFat,
    isTargetsTouched,
    setIsTargetsTouched,
    computedTargets,
    basicsValidation,
    bmi,
    handleNextFromStep1,
    handleNextFromStep2,
    handleNextFromStep3,
    handleFinishAndSave,
    handleSkip,
  };
}
