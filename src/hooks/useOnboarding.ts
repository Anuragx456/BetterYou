import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ActivityLevel, GoalType, UserSex, calculateNutritionTargets } from '../utils/nutritionTargets';
import { dbSetDailyGoals, dbUpsertUserProfile } from '../db/client';
import { useFitnessStore } from '../store/useFitnessStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { safeHaptics } from '../utils/haptics';

export function useOnboarding() {
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

  return {
    currentStep,
    setCurrentStep,
    isRecalculating,
    hasCompletedOnboarding,
    sex,
    setSex,
    ageStr,
    setAgeStr,
    heightStr,
    setHeightStr,
    weightStr,
    setWeightStr,
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
    handleNextFromStep1,
    handleNextFromStep2,
    handleNextFromStep3,
    handleFinishAndSave,
  };
}
