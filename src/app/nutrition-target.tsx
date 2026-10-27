import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFitnessStore } from '../store/useFitnessStore';
import { colors } from '../theme/colors';

const CALORIE_PRESETS = [1600, 1800, 2000, 2200, 2500, 2800];

type FitnessGoal = 'lean' | 'maintain' | 'gain';
type ActivityLevel = 'walks' | 'moderate' | 'lifting';

interface GoalOption {
  key: FitnessGoal;
  label: string;
  badge: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface ActivityOption {
  key: ActivityLevel;
  label: string;
  frequency: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const GOAL_OPTIONS: GoalOption[] = [
  { key: 'lean', label: 'Get Lean', badge: 'Deficit (-450)', icon: 'flame-outline' },
  { key: 'maintain', label: 'Maintain', badge: 'Recomp (TDEE)', icon: 'scale-outline' },
  { key: 'gain', label: 'Gain Muscle', badge: 'Surplus (+350)', icon: 'barbell-outline' },
];

const ACTIVITY_OPTIONS: ActivityOption[] = [
  { key: 'walks', label: 'Casual Walks', frequency: 'Light / 5k-8k steps', icon: 'walk-outline' },
  { key: 'moderate', label: 'Moderate Gym', frequency: '3-4 sessions / wk', icon: 'fitness-outline' },
  { key: 'lifting', label: 'Heavy Lifting', frequency: '5-6 sessions / wk', icon: 'barbell' },
];

export default function NutritionTargetScreen() {
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

  // Smart Calculator Inputs
  const [weightInput, setWeightInput] = useState<string>('72');
  const [goalChoice, setGoalChoice] = useState<FitnessGoal>('lean');
  const [activityChoice, setActivityChoice] = useState<ActivityLevel>('lifting');

  // Nutrition science engine
  const suggestedNutrition = useMemo(() => {
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
    setTimeout(() => setFeedback(null), 3000);
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
      setTimeout(() => setFeedback(null), 2500);
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
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconBadge}>
              <Ionicons name="flame" size={22} color={colors.calories} />
            </View>
            <View style={styles.heroTextCol}>
              <Text style={styles.heroLabel}>CURRENT DAILY TARGET</Text>
              <Text style={styles.heroValue}>
                {dailyGoals?.calorieTarget?.toLocaleString() ?? 2200}{' '}
                <Text style={styles.heroUnit}>kcal</Text>
              </Text>
            </View>
          </View>
          <Text style={styles.heroDesc}>
            {"Calibrates the circular progress ring and remaining calories on Today's dashboard."}
          </Text>
        </View>

        {/* SECTION: SMART NUTRITION CALCULATOR */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="sparkles" size={14} color={colors.secondary} />
            <Text style={styles.sectionHeader}>SMART NUTRITION CALIBRATOR</Text>
          </View>
          <View style={styles.cardGroup}>
            {/* Weight Input Row */}
            <View style={styles.inputRow}>
              <View style={styles.inputMeta}>
                <Text style={styles.inputTitle}>Current Body Weight</Text>
                <Text style={styles.inputSub}>Used to compute baseline metabolic rate</Text>
              </View>
              <View style={styles.numberInputBox}>
                <TextInput
                  style={styles.numberInput}
                  value={weightInput}
                  onChangeText={(t) => setWeightInput(t.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  maxLength={5}
                  placeholder="72"
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.secondary}
                />
                <Text style={styles.unitText}>kg</Text>
              </View>
            </View>

            {/* Goal Selector */}
            <Text style={styles.subLabel}>PRIMARY GOAL</Text>
            <View style={styles.optionsGrid}>
              {GOAL_OPTIONS.map((opt) => {
                const isSelected = goalChoice === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    style={({ pressed }) => [
                      styles.optionCard,
                      isSelected && styles.optionCardActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setGoalChoice(opt.key)}
                  >
                    <View style={styles.optionHeader}>
                      <Ionicons
                        name={opt.icon}
                        size={16}
                        color={isSelected ? colors.secondary : colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.optionTitle,
                          isSelected && styles.optionTitleActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.optionBadge,
                        isSelected && styles.optionBadgeActive,
                      ]}
                    >
                      {opt.badge}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Activity Level Selector */}
            <Text style={styles.subLabel}>DAILY ACTIVITY LEVEL</Text>
            <View style={styles.activityList}>
              {ACTIVITY_OPTIONS.map((opt) => {
                const isSelected = activityChoice === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    style={({ pressed }) => [
                      styles.activityRow,
                      isSelected && styles.activityRowActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setActivityChoice(opt.key)}
                  >
                    <View
                      style={[
                        styles.activityIconBox,
                        isSelected && styles.activityIconBoxActive,
                      ]}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={16}
                        color={isSelected ? colors.calories : colors.textMuted}
                      />
                    </View>
                    <View style={styles.activityTextCol}>
                      <Text
                        style={[
                          styles.activityTitle,
                          isSelected && styles.activityTitleActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={styles.activityFrequency}>{opt.frequency}</Text>
                    </View>
                    <View
                      style={[
                        styles.radioCircle,
                        isSelected && styles.radioCircleActive,
                      ]}
                    >
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Dynamic Recommendation Box */}
            <View style={styles.recommendationBox}>
              <View style={styles.recommendationTopRow}>
                <Text style={styles.recLabel}>RECOMMENDED DAILY TARGET</Text>
                <Text style={styles.recCals}>
                  {suggestedNutrition.calories.toLocaleString()}{' '}
                  <Text style={styles.recUnit}>kcal</Text>
                </Text>
              </View>

              {/* Macro Pills */}
              <View style={styles.recMacroPills}>
                <View style={[styles.macroPill, { borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
                  <Text style={[styles.macroPillVal, { color: colors.protein }]}>
                    {suggestedNutrition.protein}g
                  </Text>
                  <Text style={styles.macroPillTag}>Protein</Text>
                </View>
                <View style={[styles.macroPill, { borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                  <Text style={[styles.macroPillVal, { color: colors.carbs }]}>
                    {suggestedNutrition.carbs}g
                  </Text>
                  <Text style={styles.macroPillTag}>Carbs</Text>
                </View>
                <View style={[styles.macroPill, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                  <Text style={[styles.macroPillVal, { color: colors.fat }]}>
                    {suggestedNutrition.fat}g
                  </Text>
                  <Text style={styles.macroPillTag}>Fat</Text>
                </View>
              </View>

              <Text style={styles.recExplanation}>
                {suggestedNutrition.explanation}
              </Text>

              {/* Apply Button */}
              <Pressable
                style={({ pressed }) => [styles.applyBtn, pressed && styles.pressed]}
                onPress={handleApplySuggestion}
              >
                <Ionicons name="sparkles" size={16} color={colors.textInverse} />
                <Text style={styles.applyBtnText}>Apply Suggested Targets</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* SECTION: MANUAL CALORIE ADJUSTMENT */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>MANUAL CALORIE TARGET</Text>
          <View style={styles.cardGroup}>
            <View style={styles.inputRow}>
              <View style={styles.inputMeta}>
                <Text style={styles.inputTitle}>Daily Calorie Target</Text>
                <Text style={styles.inputSub}>Between 500 and 10,000 kcal</Text>
              </View>
              <View style={styles.numberInputBox}>
                <TextInput
                  style={styles.numberInput}
                  value={calorieInput}
                  onChangeText={(t) => {
                    setCalorieInput(t.replace(/[^0-9]/g, ''));
                    setFeedback(null);
                  }}
                  keyboardType="numeric"
                  maxLength={5}
                  placeholder="2200"
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.calories}
                />
                <Text style={styles.unitText}>kcal</Text>
              </View>
            </View>

            {/* Quick Presets */}
            <Text style={styles.presetsLabel}>BENCHMARK PRESETS</Text>
            <View style={styles.presetsRow}>
              {CALORIE_PRESETS.map((preset) => {
                const isSelected = parseInt(calorieInput, 10) === preset;
                return (
                  <Pressable
                    key={preset}
                    style={({ pressed }) => [
                      styles.presetChip,
                      isSelected && styles.presetChipActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => handleSelectPreset(preset)}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        isSelected && styles.presetChipTextActive,
                      ]}
                    >
                      {preset}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* SECTION: MACRONUTRIENT TARGETS */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>MANUAL MACRONUTRIENT TARGETS</Text>
          <View style={styles.cardGroup}>
            <View style={styles.macroRow}>
              {/* Protein */}
              <View style={styles.macroCol}>
                <Text style={[styles.macroLabel, { color: colors.protein }]}>PROTEIN (G)</Text>
                <TextInput
                  style={styles.macroInput}
                  value={proteinInput}
                  onChangeText={(t) => setProteinInput(t.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="160"
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.protein}
                />
              </View>

              {/* Carbs */}
              <View style={styles.macroCol}>
                <Text style={[styles.macroLabel, { color: colors.carbs }]}>CARBS (G)</Text>
                <TextInput
                  style={styles.macroInput}
                  value={carbsInput}
                  onChangeText={(t) => setCarbsInput(t.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="220"
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.carbs}
                />
              </View>

              {/* Fat */}
              <View style={styles.macroCol}>
                <Text style={[styles.macroLabel, { color: colors.fat }]}>FAT (G)</Text>
                <TextInput
                  style={styles.macroInput}
                  value={fatInput}
                  onChangeText={(t) => setFatInput(t.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="65"
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.fat}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Save Action Button */}
        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
          onPress={() => handleSaveGoals()}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.textInverse} />
          <Text style={styles.saveBtnText}>Save Nutrition Targets</Text>
        </Pressable>

        {feedback && (
          <View style={styles.feedbackBanner}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 24,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  heroIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextCol: {
    flex: 1,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textMuted,
  },
  heroValue: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  heroUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.calories,
  },
  heroDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textMuted,
  },
  cardGroup: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  inputMeta: {
    flex: 1,
    marginRight: 12,
  },
  inputTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  inputSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  numberInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardHover,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  numberInput: {
    fontSize: 18,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: colors.text,
    minWidth: 54,
    textAlign: 'right',
    padding: 0,
  },
  unitText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  subLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textMuted,
    marginTop: 14,
    marginBottom: 8,
  },
  optionsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  optionCard: {
    flex: 1,
    backgroundColor: colors.cardHover,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 10,
    alignItems: 'center',
  },
  optionCardActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: colors.secondary,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  optionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  optionTitleActive: {
    color: colors.secondary,
    fontWeight: '700',
  },
  optionBadge: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  optionBadgeActive: {
    color: colors.textSecondary,
  },
  activityList: {
    gap: 8,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardHover,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 10,
    gap: 12,
  },
  activityRowActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: colors.calories,
  },
  activityIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIconBoxActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  activityTextCol: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  activityTitleActive: {
    color: colors.calories,
  },
  activityFrequency: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: colors.calories,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.calories,
  },
  recommendationBox: {
    marginTop: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
  },
  recommendationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  recLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.textMuted,
  },
  recCals: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: colors.calories,
  },
  recUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  recMacroPills: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  macroPill: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 6,
    alignItems: 'center',
  },
  macroPillVal: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  macroPillTag: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 1,
  },
  recExplanation: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 12,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.secondary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textInverse,
  },
  presetsLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textMuted,
    marginTop: 12,
    marginBottom: 8,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.cardHover,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  presetChipActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: colors.calories,
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  presetChipTextActive: {
    color: colors.calories,
    fontWeight: '700',
  },
  macroRow: {
    flexDirection: 'row',
    gap: 10,
  },
  macroCol: {
    flex: 1,
  },
  macroLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
    textAlign: 'center',
  },
  macroInput: {
    backgroundColor: colors.cardHover,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    color: colors.text,
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '600',
    paddingVertical: 10,
    textAlign: 'center',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textInverse,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
});
