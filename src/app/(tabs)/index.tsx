import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AllScansModal } from '../../components/dashboard/AllScansModal';
import { BodyweightCard } from '../../components/dashboard/BodyweightCard';
import { CalorieHeroCard } from '../../components/dashboard/CalorieHeroCard';
import { MealFeed } from '../../components/dashboard/MealFeed';
import { RecentScans } from '../../components/dashboard/RecentScans';
import { TrainingCard } from '../../components/dashboard/TrainingCard';
import { WeekStrip } from '../../components/dashboard/WeekStrip';
import { WeeklySummaryModal } from '../../components/WeeklySummaryModal';
import { dbGetAllMeals, dbGetAllWorkouts } from '../../db/client';
import {
  generateWeeklySummary,
  type WeeklySummary,
} from '../../services/weeklySummaryService';
import { useFitnessStore } from '../../store/useFitnessStore';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import { MacroBreakdown, MealLog, ScannedProduct } from '../../types';
import {
  addLocalDays,
  formatDateLabel,
  getLocalDateString,
  getWeekDaysList,
} from '../../utils/date';
import { safeHaptics } from '../../utils/haptics';
import { ensureFileSystemReady } from '../../utils/imageManager';
import { useOnDemandComponent } from '../../utils/useOnDemandComponent';

export default function DashboardScreen() {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();

  // Toxicity Modal States
  const [selectedProduct, setSelectedProduct] = useState<ScannedProduct | null>(null);
  const [isAllScansModalVisible, setIsAllScansModalVisible] = useState<boolean>(false);
  const [ReportModal, loadReportModal] = useOnDemandComponent(() =>
    import('../../components/ToxicityReportModal').then((mod) => mod.ToxicityReportModal)
  );

  // Zustand state subscriptions
  const meals = useFitnessStore((state) => state.meals);
  const dashboardWorkouts = useFitnessStore((state) => state.dashboardWorkouts);
  const dailyGoals = useFitnessStore((state) => state.dailyGoals);
  const hasActiveWorkout = useFitnessStore((state) => Boolean(state.activeWorkout));
  const activeWorkoutTitle = useFitnessStore((state) => state.activeWorkout?.title ?? '');
  const activeWorkoutExercisesCount = useFitnessStore((state) => state.activeWorkout?.exercises.length ?? 0);
  const streakDays = useFitnessStore((state) => state.streakDays);
  const scannedProducts = useFitnessStore((state) => state.scannedProducts);
  const removeMeal = useFitnessStore((state) => state.removeMeal);
  const activityDates = useFitnessStore((state) => state.activityDates);
  const dashboardDate = useFitnessStore((state) => state.dashboardDate);
  const isInitialized = useFitnessStore((state) => state.isInitialized);
  const scannedProductCount = useFitnessStore((state) => state.scannedProductCount);

  // Live selected product from store
  const activeSelectedProduct = selectedProduct
    ? scannedProducts.find((p) => p.id === selectedProduct.id) || selectedProduct
    : null;

  // Today's local date string (YYYY-MM-DD)
  const todayDateString = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayDateString);
  const [thumbsReady, setThumbsReady] = useState(false);
  const isViewingToday = selectedDate === todayDateString;

  // Weekly Summary Recap State
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [isWeeklySummaryVisible, setIsWeeklySummaryVisible] = useState(false);
  const isSunday = useMemo(() => new Date().getDay() === 0, []);

  const handleOpenWeeklySummary = useCallback(async () => {
    safeHaptics.selection();
    try {
      const [allWorkouts, allMeals] = await Promise.all([
        dbGetAllWorkouts(),
        dbGetAllMeals(),
      ]);
      const summary = generateWeeklySummary(
        allWorkouts,
        allMeals,
        scannedProducts,
        dailyGoals,
        selectedDate
      );
      setWeeklySummary(summary);
      setIsWeeklySummaryVisible(true);
    } catch {
      const summary = generateWeeklySummary(
        useFitnessStore.getState().workouts,
        meals,
        scannedProducts,
        dailyGoals,
        selectedDate
      );
      setWeeklySummary(summary);
      setIsWeeklySummaryVisible(true);
    }
  }, [selectedDate, scannedProducts, dailyGoals, meals]);

  useEffect(() => {
    ensureFileSystemReady()
      .then(() => setThumbsReady(true))
      .catch(() => setThumbsReady(true));
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    if (dashboardDate === selectedDate) return;
    useFitnessStore.getState().loadDashboardDate(selectedDate).catch(() => {});
  }, [selectedDate, dashboardDate, isInitialized]);

  const weekDays = useMemo(() => getWeekDaysList(selectedDate), [selectedDate]);
  const activityDateSet = useMemo(() => new Set(activityDates), [activityDates]);
  const recentScans = useMemo(() => scannedProducts.slice(0, 3), [scannedProducts]);

  const openWorkouts = useCallback(() => {
    router.push('/workouts');
  }, [router]);
  const openMealScan = useCallback(() => {
    router.push('/meal-scan');
  }, [router]);
  const openToxicityScan = useCallback(() => {
    router.push('/toxicity-scan');
  }, [router]);
  const openRecentScan = useCallback(
    (item: ScannedProduct) => {
      loadReportModal();
      setSelectedProduct(item);
    },
    [loadReportModal]
  );
  const openAllScans = useCallback(() => {
    setIsAllScansModalVisible(true);
  }, []);

  const handleSelectScannedProduct = useCallback((item: ScannedProduct) => {
    setIsAllScansModalVisible(false);
    setSelectedProduct(item);
  }, []);

  const handleConfirmDeleteMeal = useCallback(
    (meal: MealLog) => {
      safeHaptics.selection();
      Alert.alert(
        'Delete Meal',
        `Delete "${meal.dishName}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              removeMeal(meal.id);
              safeHaptics.success();
            },
          },
        ]
      );
    },
    [removeMeal]
  );

  // Filter selected date's meals
  const todayMeals = useMemo(() => {
    return meals.filter((m) => {
      if (m.date) return m.date === selectedDate;
      try {
        return getLocalDateString(m.timestamp) === selectedDate;
      } catch {
        return false;
      }
    });
  }, [meals, selectedDate]);

  // Aggregate selected date's macro and calorie totals
  const todayTotals = useMemo<MacroBreakdown>(() => {
    return todayMeals.reduce(
      (acc, m) => ({
        calories: acc.calories + (m.calories || 0),
        protein: acc.protein + (m.protein || 0),
        carbs: acc.carbs + (m.carbs || 0),
        fat: acc.fat + (m.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [todayMeals]);

  // Filter selected date's completed workouts
  const todayWorkouts = useMemo(() => {
    return dashboardWorkouts.filter((w) => {
      if (w.date) return w.date === selectedDate;
      try {
        const date = w.completedAt || w.startedAt;
        return getLocalDateString(date) === selectedDate;
      } catch {
        return false;
      }
    });
  }, [dashboardWorkouts, selectedDate]);

  const todayVolumeKg = useMemo(() => {
    return todayWorkouts.reduce((sum, w) => sum + (w.totalVolumeKg || 0), 0);
  }, [todayWorkouts]);

  const todayCaloriesBurned = useMemo(() => {
    return todayWorkouts.reduce((sum, w) => {
      const durationMin = Math.round(w.durationSeconds / 60);
      const volumeKcal = Math.round((w.totalVolumeKg || 0) * 0.05);
      return sum + durationMin * 5 + volumeKcal;
    }, 0);
  }, [todayWorkouts]);

  const calorieTarget = Math.max(1, dailyGoals?.calorieTarget || 2200);
  const consumedCalories = todayTotals.calories;

  const formattedDate = useMemo(() => {
    if (isViewingToday) {
      return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
    return formatDateLabel(selectedDate);
  }, [isViewingToday, selectedDate]);

  const canGoForward = selectedDate < todayDateString;

  const handlePrevDay = useCallback(() => {
    safeHaptics.selection();
    setSelectedDate((prev) => addLocalDays(prev, -1));
  }, []);

  const handleNextDay = useCallback(() => {
    if (selectedDate >= todayDateString) return;
    safeHaptics.selection();
    setSelectedDate((prev) => addLocalDays(prev, 1));
  }, [selectedDate, todayDateString]);

  const handleSelectDay = useCallback((dateStr: string) => {
    safeHaptics.selection();
    setSelectedDate(dateStr);
  }, []);

  const handleReturnToToday = useCallback(() => {
    safeHaptics.selection();
    setSelectedDate(todayDateString);
  }, [todayDateString]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.dateLabel}>{formattedDate}</Text>
            <Text style={styles.brandTitle}>
              Better<Text style={styles.brandAccent}>You</Text>
            </Text>
          </View>

          <View style={styles.headerBadgesRow}>
            {/* Weekly Recap Pill */}
            <Pressable
              style={({ pressed }) => [
                styles.recapHeaderBtn,
                pressed && styles.pressed,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              onPress={handleOpenWeeklySummary}
              accessibilityLabel="View Weekly Summary"
            >
              <Ionicons name="sparkles" size={13} color={colors.primary} />
              <Text style={styles.recapHeaderText} allowFontScaling>Recap</Text>
            </Pressable>

            {/* Streak Badge */}
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={15} color={colors.primary} />
              <Text style={styles.streakText}>{streakDays}</Text>
            </View>

            {/* Settings Button */}
            <Pressable
              style={({ pressed }) => [
                styles.circularHeaderBtn,
                pressed && styles.pressed,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              onPress={() => router.push('/(tabs)/settings')}
              accessibilityLabel="Open Settings"
            >
              <Ionicons name="settings-outline" size={19} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <WeekStrip
          selectedDate={selectedDate}
          canGoForward={canGoForward}
          weekDays={weekDays}
          activityDateSet={activityDateSet}
          isViewingToday={isViewingToday}
          onPrev={handlePrevDay}
          onNext={handleNextDay}
          onSelectDay={handleSelectDay}
          onReturnToday={handleReturnToToday}
        />

        {/* Sunday Weekly Recap Banner */}
        {isSunday && (
          <Pressable
            style={({ pressed }) => [styles.weeklyRecapBanner, pressed && styles.pressed]}
            onPress={handleOpenWeeklySummary}
            accessibilityRole="button"
            accessibilityLabel="Open Sunday Weekly Recap"
          >
            <View style={styles.weeklyRecapBannerIcon}>
              <Ionicons name="sparkles" size={18} color={colors.primary} />
            </View>
            <View style={styles.weeklyRecapBannerMeta}>
              <Text style={styles.weeklyRecapBannerTitle} allowFontScaling>
                Sunday Weekly Recap Ready ✨
              </Text>
              <Text style={styles.weeklyRecapBannerSub} allowFontScaling>
                Tap to see your workout volume, nutrition & PRs
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </Pressable>
        )}

        {/* Daily Calorie & Macro Hero Card */}
        <CalorieHeroCard
          consumedCalories={consumedCalories}
          calorieTarget={calorieTarget}
          todayCaloriesBurned={todayCaloriesBurned}
          todayTotals={todayTotals}
          dailyGoals={dailyGoals}
          onScanMeal={openMealScan}
          onCheckIngredients={openToxicityScan}
        />

        <TrainingCard
          isViewingToday={isViewingToday}
          selectedDate={selectedDate}
          hasActiveWorkout={hasActiveWorkout}
          activeWorkoutTitle={activeWorkoutTitle}
          activeWorkoutExercisesCount={activeWorkoutExercisesCount}
          todayVolumeKg={todayVolumeKg}
          todayWorkouts={todayWorkouts}
          todayCaloriesBurned={todayCaloriesBurned}
          onOpenWorkouts={openWorkouts}
        />

        {/* Bodyweight Progress Trends Card */}
        <BodyweightCard />

        <MealFeed
          todayMeals={todayMeals}
          isViewingToday={isViewingToday}
          selectedDate={selectedDate}
          onDelete={handleConfirmDeleteMeal}
          onAddMeal={openMealScan}
          thumbsReady={thumbsReady}
        />

        <RecentScans
          scans={recentScans}
          scannedProductCount={scannedProductCount}
          onScan={openToxicityScan}
          onOpen={openRecentScan}
          onViewAll={openAllScans}
        />
      </ScrollView>

      {ReportModal ? (
        <ReportModal
          visible={!!activeSelectedProduct}
          product={activeSelectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      ) : null}

      <AllScansModal
        visible={isAllScansModalVisible}
        products={scannedProducts}
        onClose={() => setIsAllScansModalVisible(false)}
        onSelectProduct={handleSelectScannedProduct}
      />

      {weeklySummary && (
        <WeeklySummaryModal
          visible={isWeeklySummaryVisible}
          summary={weeklySummary}
          onClose={() => setIsWeeklySummaryVisible(false)}
        />
      )}
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
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 40,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    dateLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      letterSpacing: 0.2,
      marginBottom: 2,
    },
    brandTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.6,
    },
    brandAccent: {
      color: colors.primary,
    },
    headerBadgesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    recapHeaderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      minHeight: 34,
    },
    recapHeaderText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryMuted,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.softOrangeBorder,
      minHeight: 34,
    },
    streakText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
      fontVariant: ['tabular-nums'],
    },
    circularHeaderBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weeklyRecapBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primaryMuted,
      borderRadius: 16,
      padding: 14,
      gap: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.softOrangeBorder,
    },
    weeklyRecapBannerIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weeklyRecapBannerMeta: {
      flex: 1,
    },
    weeklyRecapBannerTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    weeklyRecapBannerSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
