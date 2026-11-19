import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFitnessStore } from '../../store/useFitnessStore';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import { safeHaptics } from '../../utils/haptics';
import {
  aggregate28DayCalories,
  calculateWeightAveragesAndDeltas,
} from '../../utils/nutritionAnalytics';
import { CalorieTrendChart } from '../charts/CalorieTrendChart';
import { WorkoutVolumeChart } from '../charts/WorkoutVolumeChart';

export function BodyweightCard() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  const bodyMeasurements = useFitnessStore((state) => state.bodyMeasurements);
  const logBodyWeight = useFitnessStore((state) => state.logBodyWeight);
  const meals = useFitnessStore((state) => state.meals);
  const workouts = useFitnessStore((state) => state.workouts);
  const dailyGoals = useFitnessStore((state) => state.dailyGoals);

  const [isInputExpanded, setIsInputExpanded] = useState<boolean>(false);
  const [showCharts, setShowCharts] = useState<boolean>(false);
  const [inputWeight, setInputWeight] = useState<string>('');

  const analytics = calculateWeightAveragesAndDeltas(bodyMeasurements);
  const calorieTrend = aggregate28DayCalories(meals, dailyGoals.calorieTarget);

  const currentWeightDisplay = analytics.currentWeight
    ? `${analytics.currentWeight} kg`
    : 'Not logged';

  const handleOpenInput = () => {
    safeHaptics.selection();
    if (!inputWeight && analytics.currentWeight) {
      setInputWeight(String(analytics.currentWeight));
    }
    setIsInputExpanded(true);
  };

  const handleSaveWeight = async () => {
    const val = parseFloat(inputWeight);
    if (isNaN(val) || val < 25 || val > 300) {
      safeHaptics.warning();
      Alert.alert('Invalid Weight', 'Please enter a realistic weight in kg (25 - 300 kg).');
      return;
    }

    try {
      safeHaptics.impactMedium();
      await logBodyWeight(val);
      safeHaptics.success();
      setIsInputExpanded(false);
      setInputWeight('');
    } catch {
      safeHaptics.error();
      Alert.alert('Error', 'Failed to save weight measurement.');
    }
  };

  const delta7d = analytics.deltaVsSevenDaysAgo;
  let deltaText = 'No prior data';
  let deltaIcon: keyof typeof Ionicons.glyphMap = 'remove-outline';
  let deltaColor = colors.textMuted;

  if (delta7d !== null) {
    if (delta7d < 0) {
      deltaText = `${delta7d} kg vs last wk`;
      deltaIcon = 'trending-down';
      deltaColor = colors.success;
    } else if (delta7d > 0) {
      deltaText = `+${delta7d} kg vs last wk`;
      deltaIcon = 'trending-up';
      deltaColor = colors.warning;
    } else {
      deltaText = '0.0 kg vs last wk';
      deltaIcon = 'remove';
      deltaColor = colors.textSecondary;
    }
  }

  return (
    <View style={styles.cardContainer}>
      {/* Header */}
      <View style={styles.topRow}>
        <View style={styles.titleWithBadge}>
          <View style={[styles.iconBadge, { backgroundColor: colors.softBlue }]}>
            <Ionicons name="scale-outline" size={18} color={colors.secondary} />
          </View>
          <View>
            <Text style={styles.cardTitle}>Bodyweight & Trends</Text>
            <Text style={styles.cardSubtitle}>
              7d Avg: <Text style={styles.boldSubtitle}>{analytics.sevenDayAverage ? `${analytics.sevenDayAverage} kg` : '--'}</Text>
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.quickLogBtn, pressed && styles.btnPressed]}
          onPress={handleOpenInput}
          accessibilityRole="button"
          accessibilityLabel="Log today's bodyweight"
        >
          <Ionicons name="add" size={16} color={colors.primary} />
          <Text style={styles.quickLogBtnText}>Log Weight</Text>
        </Pressable>
      </View>

      {/* Main Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.mainWeightCol}>
          <Text style={styles.mainWeightValue}>{currentWeightDisplay}</Text>
          <Text style={styles.mainWeightLabel}>
            {analytics.currentWeightDate ? `Logged ${analytics.currentWeightDate}` : 'No entries yet'}
          </Text>
        </View>

        <View style={styles.deltaBadge}>
          <Ionicons name={deltaIcon} size={15} color={deltaColor} />
          <Text style={[styles.deltaText, { color: deltaColor }]}>{deltaText}</Text>
        </View>
      </View>

      {/* Expandable Weight Input Form */}
      {isInputExpanded && (
        <View style={styles.inputContainer}>
          <Text style={styles.inputPrompt}>Enter current weight (kg):</Text>
          <View style={styles.inputControlsRow}>
            <Pressable
              style={styles.stepperMiniBtn}
              onPress={() => {
                safeHaptics.selection();
                const cur = parseFloat(inputWeight) || analytics.currentWeight || 70;
                setInputWeight((Math.max(25, cur - 0.2)).toFixed(1));
              }}
            >
              <Ionicons name="remove" size={16} color={colors.text} />
            </Pressable>

            <TextInput
              style={styles.weightTextInput}
              keyboardType="decimal-pad"
              value={inputWeight}
              onChangeText={setInputWeight}
              placeholder="70.0"
              placeholderTextColor={colors.textMuted}
              autoFocus
              maxLength={5}
            />

            <Pressable
              style={styles.stepperMiniBtn}
              onPress={() => {
                safeHaptics.selection();
                const cur = parseFloat(inputWeight) || analytics.currentWeight || 70;
                setInputWeight((cur + 0.2).toFixed(1));
              }}
            >
              <Ionicons name="add" size={16} color={colors.text} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.saveWeightBtn, pressed && styles.btnPressed]}
              onPress={handleSaveWeight}
            >
              <Text style={styles.saveWeightBtnText}>Save</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
              onPress={() => {
                safeHaptics.selection();
                setIsInputExpanded(false);
              }}
            >
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Toggle Progress Trends & Analytics */}
      <Pressable
        style={({ pressed }) => [styles.toggleChartsBtn, pressed && styles.btnPressed]}
        onPress={() => {
          safeHaptics.selection();
          setShowCharts((prev) => !prev);
        }}
        accessibilityRole="button"
        accessibilityLabel="Toggle progress trend charts"
      >
        <Text style={styles.toggleChartsText}>
          {showCharts ? 'Hide Progress Trends' : 'View Calorie & Volume Trends'}
        </Text>
        <Ionicons
          name={showCharts ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.primary}
        />
      </Pressable>

      {/* Collapsible SVG Charts */}
      {showCharts && (
        <View style={styles.chartsContainer}>
          <CalorieTrendChart
            days={calorieTrend.days}
            targetCalories={calorieTrend.targetCalories}
            averageCalories={calorieTrend.averageCalories}
          />
          <WorkoutVolumeChart workouts={workouts} />
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    cardContainer: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 20,
      padding: 16,
      marginBottom: 16,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    titleWithBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    iconBadge: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    cardSubtitle: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 1,
    },
    boldSubtitle: {
      color: colors.textSecondary,
      fontWeight: '700',
    },
    quickLogBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(255, 122, 89, 0.3)',
      minHeight: 40,
    },
    quickLogBtnText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingVertical: 4,
    },
    mainWeightCol: {
      gap: 2,
    },
    mainWeightValue: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
    },
    mainWeightLabel: {
      color: colors.textMuted,
      fontSize: 11,
    },
    deltaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surfaceSubtle,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    deltaText: {
      fontSize: 12,
      fontWeight: '700',
    },
    inputContainer: {
      backgroundColor: colors.surfaceSubtle,
      borderRadius: 12,
      padding: 12,
      marginTop: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    inputPrompt: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 8,
    },
    inputControlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    stepperMiniBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weightTextInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
      textAlign: 'center',
      minWidth: 80,
      minHeight: 40,
    },
    saveWeightBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
      minHeight: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    saveWeightBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
    cancelBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggleChartsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      marginTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    toggleChartsText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    chartsContainer: {
      marginTop: 8,
      gap: 12,
    },
    btnPressed: {
      opacity: 0.8,
    },
  });
}
