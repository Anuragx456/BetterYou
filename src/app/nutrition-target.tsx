import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeroTargetCard } from '../components/targets/HeroTargetCard';
import { ManualTargetForm } from '../components/targets/ManualTargetForm';
import { SmartCalibratorCard } from '../components/targets/SmartCalibratorCard';
import type {
  ActivityLevel,
  FitnessGoal,
  SuggestedNutrition,
} from '../components/targets/types';
import { useFitnessStore } from '../store/useFitnessStore';
import type { ThemeColors } from '../theme/colors';
import { useThemeColors, useThemedStyles } from '../theme/theme';

export default function NutritionTargetScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const dailyGoals = useFitnessStore((state) => state.dailyGoals);
  const updateDailyGoals = useFitnessStore((state) => state.updateDailyGoals);

  // Manual Inputs
  const [calorieInput, setCalorieInput] = useState<string>(
    dailyGoals?.calorieTarget ? String(dailyGoals.calorieTarget) : '2200'
  );
  const [proteinInput, setProteinInput] = useState<string>(
    dailyGoals?.proteinTargetGrams ? String(dailyGoals.proteinTargetGrams) : '160'
  );
  const [carbsInput, setCarbsInput] = useState<string>(
    dailyGoals?.carbsTargetGrams ? String(dailyGoals.carbsTargetGrams) : '220'
  );
  const [fatInput, setFatInput] = useState<string>(
    dailyGoals?.fatTargetGrams ? String(dailyGoals.fatTargetGrams) : '65'
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  // Smart Calculator Inputs
  const [weightInput, setWeightInput] = useState<string>('72');
  const [goalChoice, setGoalChoice] = useState<FitnessGoal>('lean');
  const [activityChoice, setActivityChoice] = useState<ActivityLevel>('lifting');

  // Nutrition science engine
  const suggestedNutrition: SuggestedNutrition = useMemo(() => {
    const weight = parseFloat(weightInput);
    const validWeight = !isNaN(weight) && weight >= 30 && weight <= 250 ? weight : 72;

    // Maintenance multipliers: BMR (~22 kcal/kg) * activity factor
    let multiplier = 34;
    if (activityChoice === 'walks') multiplier = 30; // ~1.36x BMR
    else if (activityChoice === 'moderate') multiplier = 34; // ~1.55x BMR
    else if (activityChoice === 'lifting') multiplier = 38.5; // ~1.75x BMR

    const tdee = validWeight * multiplier;

    let targetCals = Math.round(tdee);
    let proteinPerKg = 1.8;
    let fatPerKg = 0.9;
    let explanation = 'Maintains current body mass with balanced energy.';

    if (goalChoice === 'lean') {
      targetCals = Math.max(1200, Math.round(tdee - 450));
      proteinPerKg = 2.2; // High protein to preserve lean muscle during deficit
      fatPerKg = 0.8;
      explanation = `Deficit (-450 kcal). High protein (${proteinPerKg}g/kg) shields lean muscle mass.`;
    } else if (goalChoice === 'gain') {
      targetCals = Math.round(tdee + 350);
      proteinPerKg = 2.0; // Hypertrophy target
      fatPerKg = 1.0;
      explanation = 'Lean surplus (+350 kcal). Powers progressive overload and hypertrophy.';
    }

    const proteinG = Math.round(validWeight * proteinPerKg);
    const fatG = Math.round(validWeight * fatPerKg);
    const calsFromProtFat = proteinG * 4 + fatG * 9;
    const remainingCals = Math.max(200, targetCals - calsFromProtFat);
    const carbsG = Math.round(remainingCals / 4);

    return {
      calories: targetCals,
      protein: proteinG,
      carbs: carbsG,
      fat: fatG,
      explanation,
    };
  }, [weightInput, goalChoice, activityChoice]);

  const handleApplySuggestion = useCallback(() => {
    const { calories, protein, carbs, fat } = suggestedNutrition;
    setCalorieInput(String(calories));
    setProteinInput(String(protein));
    setCarbsInput(String(carbs));
    setFatInput(String(fat));

    updateDailyGoals({
      calorieTarget: calories,
      proteinTargetGrams: protein,
      carbsTargetGrams: carbs,
      fatTargetGrams: fat,
    });

    setFeedback(`Applied smart targets: ${calories.toLocaleString()} kcal & tailored macros!`);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000);
  }, [suggestedNutrition, updateDailyGoals]);

  const handleSaveGoals = useCallback(
    (customCals?: number) => {
      Keyboard.dismiss();
      const cals = customCals !== undefined ? customCals : parseInt(calorieInput, 10);
      if (isNaN(cals) || cals < 500 || cals > 10000) {
        Alert.alert(
          'Invalid Calorie Target',
          'Please enter a daily calorie goal between 500 and 10,000 kcal.'
        );
        return;
      }

      const prot = parseInt(proteinInput, 10) || dailyGoals.proteinTargetGrams;
      const carbs = parseInt(carbsInput, 10) || dailyGoals.carbsTargetGrams;
      const fat = parseInt(fatInput, 10) || dailyGoals.fatTargetGrams;

      updateDailyGoals({
        calorieTarget: cals,
        proteinTargetGrams: Math.max(10, prot),
        carbsTargetGrams: Math.max(10, carbs),
        fatTargetGrams: Math.max(5, fat),
      });

      setCalorieInput(String(cals));
      setProteinInput(String(prot));
      setCarbsInput(String(carbs));
      setFatInput(String(fat));
      setFeedback(`Target updated to ${cals.toLocaleString()} kcal/day`);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 2500);
    },
    [calorieInput, proteinInput, carbsInput, fatInput, dailyGoals, updateDailyGoals]
  );

  const handleSelectPreset = useCallback(
    (preset: number) => {
      setCalorieInput(String(preset));
      handleSaveGoals(preset);
    },
    [handleSaveGoals]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation Header */}
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
          <View style={styles.headerTitleCol}>
            <Text style={styles.screenTitle}>Nutrition Target</Text>
            <Text style={styles.screenTag}>CALORIE & MACRO CALIBRATOR</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Hero Goal Card */}
        <HeroTargetCard calorieTarget={dailyGoals?.calorieTarget} />

        {/* Smart Calibrator Card */}
        <SmartCalibratorCard
          weightInput={weightInput}
          setWeightInput={setWeightInput}
          goalChoice={goalChoice}
          setGoalChoice={setGoalChoice}
          activityChoice={activityChoice}
          setActivityChoice={setActivityChoice}
          suggestedNutrition={suggestedNutrition}
          onApplySuggestion={handleApplySuggestion}
        />

        {/* Manual Target Form */}
        <ManualTargetForm
          calorieInput={calorieInput}
          setCalorieInput={setCalorieInput}
          proteinInput={proteinInput}
          setProteinInput={setProteinInput}
          carbsInput={carbsInput}
          setCarbsInput={setCarbsInput}
          fatInput={fatInput}
          setFatInput={setFatInput}
          onSelectPreset={handleSelectPreset}
          onSave={() => handleSaveGoals()}
          onClearFeedback={() => setFeedback(null)}
          feedback={feedback}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 48,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.7,
    },
    headerTitleCol: {
      alignItems: 'center',
    },
    screenTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    screenTag: {
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: colors.calories,
      marginTop: 2,
    },
  });
}
