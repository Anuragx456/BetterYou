import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedCalorieRing } from '../../components/AnimatedCalorieRing';
import { AnimatedMacroBar } from '../../components/AnimatedMacroBar';
import { useOnDemandComponent } from '../../utils/useOnDemandComponent';
import {
  addLocalDays,
  formatDateLabel,
  formatMonthYear,
  getLocalDateString,
  getWeekDaysList,
  type DayItem,
} from '../../utils/date';
import { safeHaptics } from '../../utils/haptics';
import { getFullImageUri, ensureFileSystemReady } from '../../utils/imageManager';
import {
  useFitnessStore,
} from '../../store/useFitnessStore';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import { MacroBreakdown, MealLog, ScannedProduct } from '../../types';

const WeekStrip = React.memo(function WeekStrip({ selectedDate, canGoForward, weekDays, activityDateSet, isViewingToday, onPrev, onNext, onSelectDay, onReturnToday }: { selectedDate: string; canGoForward: boolean; weekDays: DayItem[]; activityDateSet: Set<string>; isViewingToday: boolean; onPrev: () => void; onNext: () => void; onSelectDay: (date: string) => void; onReturnToday: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  return (
    <>
        {/* Date Navigation Scrubber - Month Pill with Arrows + Day Chips */}
        <View style={styles.calendarStripSection}>
          <View style={styles.monthPillRow}>
            <Pressable
              style={({ pressed }) => [styles.monthNavArrow, pressed && styles.pressed]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onPrev}
              accessibilityLabel="Previous day"
            >
              <Ionicons name="arrow-back" size={16} color={colors.text} />
            </Pressable>

            <View style={styles.monthPill}>
              <Text style={styles.monthPillText}>{formatMonthYear(selectedDate)}</Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.monthNavArrow,
                !canGoForward && styles.dateNavArrowDisabled,
                pressed && canGoForward && styles.pressed,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onNext}
              disabled={!canGoForward}
              accessibilityLabel="Next day"
            >
              <Ionicons
                name="arrow-forward"
                size={16}
                color={canGoForward ? colors.text : colors.textMuted}
              />
            </Pressable>
          </View>

          {/* Weekday Row: SUN MON TUE WED THR FRI SAT */}
          <View style={styles.weekDaysGrid}>
            {weekDays.map((day) => {
              const isSelected = day.dateStr === selectedDate;
              const hasData = activityDateSet.has(day.dateStr);

              return (
                <Pressable
                  key={day.dateStr}
                  style={({ pressed }) => [
                    styles.dayCol,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => onSelectDay(day.dateStr)}
                  accessibilityRole="button"
                  accessibilityLabel={`${day.dayName} ${day.dayNum}`}
                >
                  <Text
                    style={[
                      styles.dayNameLabel,
                      isSelected && styles.dayNameLabelActive,
                    ]}
                  >
                    {day.dayName}
                  </Text>
                  <View
                    style={[
                      styles.dayCircle,
                      isSelected && styles.dayCircleSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumberLabel,
                        isSelected && styles.dayNumberLabelSelected,
                      ]}
                    >
                      {day.dayNum}
                    </Text>
                  </View>
                  {hasData && !isSelected && <View style={styles.dayDotIndicator} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Past Date Notice Banner */}
        {!isViewingToday && (
          <View style={styles.pastDateBanner}>
            <View style={styles.pastDateBannerLeft}>
              <Ionicons name="calendar-outline" size={15} color={colors.info} />
              <Text style={styles.pastDateBannerText}>
                Viewing {formatDateLabel(selectedDate)}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.backToTodayBtn, pressed && styles.pressed]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              onPress={onReturnToday}
            >
              <Ionicons name="return-up-back" size={13} color={colors.primary} />
              <Text style={styles.backToTodayBtnText}>Back to Today</Text>
            </Pressable>
          </View>
        )}

    </>
  );
});

const TrainingCard = React.memo(function TrainingCard({ isViewingToday, selectedDate, hasActiveWorkout, activeWorkoutTitle, activeWorkoutExercisesCount, todayVolumeKg, todayWorkouts, todayCaloriesBurned, onOpenWorkouts }: { isViewingToday: boolean; selectedDate: string; hasActiveWorkout: boolean; activeWorkoutTitle: string; activeWorkoutExercisesCount: number; todayVolumeKg: number; todayWorkouts: { length: number }; todayCaloriesBurned: number; onOpenWorkouts: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  return (
    <>
        {/* Workout Activity Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleWithIcon}>
              <Ionicons name="barbell-outline" size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>
                {isViewingToday ? "Today's Training" : `${formatDateLabel(selectedDate)} Training`}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.cleanLinkBtn, pressed && styles.pressed]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={onOpenWorkouts}
            >
              <Text style={styles.cleanLinkText}>Open</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.primary} />
            </Pressable>
          </View>

          {hasActiveWorkout && isViewingToday ? (
            <View style={styles.activeWorkoutBanner}>
              <View style={styles.activeWorkoutLeft}>
                <View style={styles.pulseDot} />
                <View>
                  <Text style={styles.activeWorkoutTitle}>
                    {activeWorkoutTitle}
                  </Text>
                  <Text style={styles.activeWorkoutSub}>
                    {activeWorkoutExercisesCount} Exercises in progress
                  </Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.resumeWorkoutBtn,
                  pressed && styles.pressed,
                ]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                onPress={onOpenWorkouts}
              >
                <Text style={styles.resumeWorkoutText}>Resume</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.workoutStatsRow}>
              <View style={styles.workoutStatBlock}>
                <Text style={styles.workoutStatNum}>
                  {todayVolumeKg.toLocaleString()}
                </Text>
                <Text style={styles.workoutStatDesc}>Volume (kg)</Text>
              </View>
              <View style={styles.workoutStatBlock}>
                <Text style={styles.workoutStatNum}>
                  {todayWorkouts.length}
                </Text>
                <Text style={styles.workoutStatDesc}>Sessions</Text>
              </View>
              <View style={styles.workoutStatBlock}>
                <Text style={styles.workoutStatNum}>
                  {todayCaloriesBurned}
                </Text>
                <Text style={styles.workoutStatDesc}>Burn (kcal)</Text>
              </View>
            </View>
          )}

          {!hasActiveWorkout && todayWorkouts.length === 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.startWorkoutCta,
                pressed && styles.pressed,
              ]}
              onPress={onOpenWorkouts}
            >
              <Ionicons name="add" size={17} color={colors.primary} />
              <Text style={styles.startWorkoutCtaText}>Start Workout</Text>
            </Pressable>
          )}
        </View>

    </>
  );
});

const MealFeed = React.memo(function MealFeed({ todayMeals, isViewingToday, selectedDate, onDelete, onAddMeal, thumbsReady }: { todayMeals: MealLog[]; isViewingToday: boolean; selectedDate: string; onDelete: (meal: MealLog) => void; onAddMeal: () => void; thumbsReady: boolean }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  return (
    <>
        {/* Logged Meals Clean Feed */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleWithIcon}>
              <Ionicons name="restaurant-outline" size={18} color={colors.calories} />
              <Text style={styles.cardTitle}>
                {isViewingToday ? "Today's Meals" : `${formatDateLabel(selectedDate)} Meals`}{' '}
                {todayMeals.length > 0 ? `(${todayMeals.length})` : ''}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.cleanLinkBtn, pressed && styles.pressed]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={onAddMeal}
            >
              <Ionicons name="add" size={15} color={colors.primary} />
              <Text style={styles.cleanLinkText}>Add</Text>
            </Pressable>
          </View>

          {todayMeals.length === 0 ? (
            <View style={styles.emptyCardClean}>
              <Text style={styles.emptyTitle}>
                {isViewingToday ? 'No meals logged yet today' : `No meals logged on ${formatDateLabel(selectedDate)}`}
              </Text>
              <Text style={styles.emptySubtitle}>
                Snap a meal photo or select from gallery for automatic calorie & macro vision.
              </Text>
            </View>
          ) : (
            <View style={styles.mealsCleanList}>
              {todayMeals.map((meal, idx) => (
                <MealListItem
                  key={meal.id}
                  meal={meal}
                  isLast={idx === todayMeals.length - 1}
                  onDelete={onDelete}
                  thumbsReady={thumbsReady}
                />
              ))}
            </View>
          )}
        </View>

    </>
  );
});

const RecentScans = React.memo(function RecentScans({ scans, scannedProductCount, onScan, onOpen, onViewAll }: { scans: ScannedProduct[]; scannedProductCount: number; onScan: () => void; onOpen: (item: ScannedProduct) => void; onViewAll: () => void }) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  return (
    <>
        {/* Recent Scanned Toxicity Products */}
        {scans.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTitleWithIcon}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={colors.primary}
                />
                <Text style={styles.cardTitle}>Recent Ingredient Checks</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.cleanLinkBtn, pressed && styles.pressed]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={onScan}
              >
                <Text style={styles.cleanLinkText}>Scan</Text>
                <Ionicons name="chevron-forward" size={13} color={colors.primary} />
              </Pressable>
            </View>

            <View style={styles.scannedCleanList}>
              {scans.map((item: ScannedProduct, idx) => {
                const isLast = idx === scans.length - 1;
                const score = item.report.overallSafetyScore;
                const badgeColor =
                  score >= 71
                    ? colors.safetyClean
                    : score >= 40
                    ? colors.safetyModerate
                    : colors.safetyHighRisk;

                return (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [
                      styles.scannedCleanItem,
                      !isLast && styles.mealCleanItemBorder,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => onOpen(item)}
                  >
                    <View style={styles.scannedCleanLeft}>
                      <View
                        style={[
                          styles.safetyScoreBadgeClean,
                          { borderColor: badgeColor, backgroundColor: `${badgeColor}15` },
                        ]}
                      >
                        <Text style={[styles.safetyScoreNumberClean, { color: badgeColor }]}>
                          {score}
                        </Text>
                      </View>
                      <View style={styles.scannedCleanInfo}>
                        <Text style={styles.scannedCleanName} numberOfLines={1}>
                          {item.productName}
                        </Text>
                        <Text style={styles.scannedCleanSub}>
                          {(item.flaggedCount ?? (item.reportComplete ? item.report.harmfulIngredients.length : 0)) > 0
                            ? `Flagged ${
                                item.flaggedCount ??
                                (item.reportComplete ? item.report.harmfulIngredients.length : 0)
                              } harmful additives`
                            : item.report.riskLevel}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>

            {scannedProductCount > 3 && (
              <Pressable
                style={({ pressed }) => [styles.viewAllHistoryBtnClean, pressed && styles.pressed]}
                onPress={onViewAll}
              >
                <Text style={styles.viewAllHistoryTextClean}>
                  View All Saved ({scannedProductCount})
                </Text>
              </Pressable>
            )}
          </View>
        )}
    </>
  );
});

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

  // Zustand state subscriptions (using granular primitive selectors to avoid background re-renders)
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
    useFitnessStore.getState().loadAllProductSummaries().catch(() => {});
  }, []);

  // Filter selected date's meals
  const todayMeals = useMemo(() => {
    return meals.filter((meal) => {
      if (meal.date) return meal.date === selectedDate;
      try {
        return getLocalDateString(meal.timestamp) === selectedDate;
      } catch {
        return false;
      }
    });
  }, [meals, selectedDate]);

  // Compute selected date's macro totals directly in a single pass
  const todayTotals = useMemo(() => {
    return todayMeals.reduce<MacroBreakdown>(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        protein: acc.protein + meal.protein,
        carbs: acc.carbs + meal.carbs,
        fat: acc.fat + meal.fat,
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

  // Selected date's workout volume & estimated calories burned
  const todayVolumeKg = useMemo(() => {
    return todayWorkouts.reduce((sum, w) => sum + (w.totalVolumeKg || 0), 0);
  }, [todayWorkouts]);

  const todayCaloriesBurned = useMemo(() => {
    // Estimate ~0.05 kcal burned per kg volume + 5 kcal/min
    return todayWorkouts.reduce((sum, w) => {
      const durationMin = Math.round(w.durationSeconds / 60);
      const volumeKcal = Math.round((w.totalVolumeKg || 0) * 0.05);
      return sum + durationMin * 5 + volumeKcal;
    }, 0);
  }, [todayWorkouts]);

  // Calorie calculations with positive non-zero fallbacks to avoid NaN
  const calorieTarget = Math.max(1, dailyGoals?.calorieTarget || 2200);

  const consumedCalories = todayTotals.calories;
  const remainingCalories = Math.max(0, calorieTarget - consumedCalories + todayCaloriesBurned);

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
    safeHaptics.impactLight();
    setSelectedDate(todayDateString);
  }, [todayDateString]);

  const handleConfirmDeleteMeal = useCallback(
    (meal: MealLog) => {
      Alert.alert(
        'Remove Meal',
        `Delete "${meal.dishName}" from ${formatDateLabel(selectedDate)}'s log?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              safeHaptics.warning();
              removeMeal(meal.id);
            },
          },
        ]
      );
    },
    [removeMeal, selectedDate]
  );

  const handleSelectScannedProduct = useCallback((item: ScannedProduct) => {
    loadReportModal();
    setIsAllScansModalVisible(false);
    setSelectedProduct(item);
  }, [loadReportModal]);

  const renderScannedItem = useCallback(
    ({ item }: { item: ScannedProduct }) => (
      <SavedScanItem item={item} onSelect={handleSelectScannedProduct} />
    ),
    [handleSelectScannedProduct]
  );

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

        {/* Daily Calorie & Macro Hero Card (Reanimated Native Rings) */}
        <View style={styles.heroCard}>
          <Pressable
            style={({ pressed }) => [styles.ringContainer, pressed && styles.pressed]}
            onPress={() => router.push('/nutrition-target')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="View and edit daily calorie and macro goals"
          >
            <AnimatedCalorieRing
              consumed={consumedCalories}
              target={calorieTarget}
              remaining={remainingCalories}
              size={176}
              strokeWidth={12}
            />
          </Pressable>

          {/* Minimal Inline Macro Bars (Reanimated) */}
          <View style={styles.macroRow}>
            <AnimatedMacroBar
              label="Protein"
              consumedGrams={todayTotals.protein}
              targetGrams={dailyGoals.proteinTargetGrams}
              barColor={colors.protein}
            />
            <AnimatedMacroBar
              label="Carbs"
              consumedGrams={todayTotals.carbs}
              targetGrams={dailyGoals.carbsTargetGrams}
              barColor={colors.carbs}
            />
            <AnimatedMacroBar
              label="Fats"
              consumedGrams={todayTotals.fat}
              targetGrams={dailyGoals.fatTargetGrams}
              barColor={colors.fat}
            />
          </View>

          {/* Unified Action Capsule */}
          <View style={styles.unifiedActionCapsule}>
            <Pressable
              style={({ pressed }) => [
                styles.capsuleHalfBtn,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push('/meal-scan')}
            >
              <Ionicons name="camera-outline" size={16} color={colors.primary} />
              <Text style={styles.capsuleBtnTextPrimary}>Scan Meal</Text>
            </Pressable>
            <View style={styles.capsuleDivider} />
            <Pressable
              style={({ pressed }) => [
                styles.capsuleHalfBtn,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push('/toxicity-scan')}
            >
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.capsuleBtnTextSecondary}>Check Ingredients</Text>
            </Pressable>
          </View>
        </View>

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

      {isAllScansModalVisible ? (
      <Modal
        visible
        animationType="slide"
        onRequestClose={() => setIsAllScansModalVisible(false)}
      >
        <SafeAreaView style={styles.allScansSafeArea}>
          <View style={styles.allScansHeader}>
            <Pressable
              style={({ pressed }) => [styles.allScansCloseBtn, pressed && styles.pressed]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => setIsAllScansModalVisible(false)}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.allScansTitle}>All Saved Scans</Text>
              <Text style={styles.allScansSub}>{scannedProducts.length} items</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <FlashList
            data={scannedProducts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.allScansList}
            showsVerticalScrollIndicator={false}
            renderItem={renderScannedItem}
          />
        </SafeAreaView>
      </Modal>
      ) : null}
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
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  // Calendar Strip
  calendarStripSection: {
    marginBottom: 16,
  },
  monthPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 12,
  },
  monthPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  monthPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.1,
  },
  monthNavArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  weekDaysGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  dayCol: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
  },
  dayNameLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  dayNameLabelActive: {
    color: colors.primary,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: '#FF7A59',
    shadowColor: '#FF7A59',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  dayNumberLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  dayNumberLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  dayDotIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    marginTop: 4,
  },

  // Date Scrubber Strip
  dateScrubberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 4,
  },
  dateNavArrow: {
    width: 30,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  dateNavArrowDisabled: {
    opacity: 0.35,
  },
  dateDaysScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  dayPill: {
    width: 44,
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dayPillSelected: {
    backgroundColor: '#FFEDE8',
    borderColor: colors.primary,
  },
  dayPillName: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  dayPillNum: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  dayPillTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  dayPillDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  dayPillDotActive: {
    backgroundColor: colors.primary,
  },
  dayPillDotMuted: {
    backgroundColor: colors.textMuted,
  },
  dayPillDotEmpty: {
    backgroundColor: 'transparent',
  },

  // Past Date Notice Banner
  pastDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  pastDateBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pastDateBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.info,
  },
  backToTodayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  backToTodayBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },

  // Hero Card with Circular Calorie Gauge
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  ringContainer: {
    marginVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuter: {
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 8,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringProgressArc: {
    position: 'absolute',
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 8,
    borderColor: 'transparent',
  },
  ringInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  ringNumber: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  ringTarget: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
    marginTop: 1,
  },
  ringSub: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 4,
  },

  // Inline Macro Bars
  macroRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 14,
    marginBottom: 16,
  },
  macroCol: {
    flex: 1,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  macroTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  macroBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 5,
  },
  macroBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  macroGramText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  macroTargetText: {
    fontSize: 10,
    fontWeight: '400',
    color: colors.textMuted,
  },

  // Unified Action Capsule
  unifiedActionCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    width: '100%',
    height: 46,
    overflow: 'hidden',
  },
  capsuleHalfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: '100%',
  },
  capsuleDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.hairline,
  },
  capsuleBtnTextPrimary: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  capsuleBtnTextSecondary: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },

  // Generic Clean Card
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  cleanLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  cleanLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  // Training Stats
  workoutStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  workoutStatBlock: {
    alignItems: 'center',
  },
  workoutStatNum: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  workoutStatDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  startWorkoutCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMuted,
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 10,
    gap: 5,
  },
  startWorkoutCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  activeWorkoutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryMuted,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  activeWorkoutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  activeWorkoutTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  activeWorkoutSub: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  resumeWorkoutBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  resumeWorkoutText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textInverse,
  },

  // Clean Meal List
  emptyCardClean: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 12,
  },
  mealsCleanList: {
    gap: 0,
  },
  mealCleanItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  mealCleanItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  mealCleanLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  mealCleanThumb: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  mealCleanDetails: {
    flex: 1,
  },
  mealCleanNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealCleanName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  mealCleanMacros: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  mealCleanKcal: {
    fontWeight: '600',
    color: colors.text,
  },
  mealCleanPortion: {
    color: colors.primary,
  },
  mealDeleteBtn: {
    padding: 6,
  },

  // Scanned Clean List
  scannedCleanList: {
    gap: 0,
  },
  scannedCleanItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  scannedCleanLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  safetyScoreBadgeClean: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyScoreNumberClean: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  scannedCleanInfo: {
    flex: 1,
  },
  scannedCleanName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  scannedCleanSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  viewAllHistoryBtnClean: {
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  viewAllHistoryTextClean: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },

  // Modal styles (preserved)
  allScansSafeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  allScansHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  allScansCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  allScansTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  allScansSub: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
  },
  allScansList: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  scannedCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  scannedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scannedProductTitleCol: {
    flex: 1,
    marginRight: 8,
  },
  scannedProductName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  scannedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  scannedCategoryBadge: {
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  scannedCategoryText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  safetyScoreBadge: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  safetyScoreNumber: {
    fontSize: 13,
    fontWeight: '700',
  },
  safetyScoreLabel: {
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
}


/* -------------------------------------------------------------
 * MEMOIZED LIST ITEM SUBCOMPONENTS
 * ------------------------------------------------------------- */

interface MealListItemProps {
  meal: MealLog;
  isLast: boolean;
  onDelete: (meal: MealLog) => void;
  thumbsReady: boolean;
}

const MealListItem = React.memo(function MealListItem({
  meal,
  isLast,
  onDelete,
  thumbsReady,
}: MealListItemProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [imageError, setImageError] = React.useState(false);
  const source = meal.thumbnailUri || '';
  const resolvedUri = !source
    ? null
    : source.startsWith('file://') || source.startsWith('http://') || source.startsWith('https://')
      ? source
      : thumbsReady
        ? getFullImageUri(source)
        : null;

  return (
    <View style={[styles.mealCleanItem, !isLast && styles.mealCleanItemBorder]}>
      <View style={styles.mealCleanLeft}>
        {resolvedUri && !imageError ? (
          <Image
            source={{ uri: resolvedUri }}
            style={styles.mealCleanThumb}
            contentFit="cover"
            recyclingKey={meal.id}
            onError={() => setImageError(true)}
          />
        ) : null}
        <View style={styles.mealCleanDetails}>
          <View style={styles.mealCleanNameRow}>
            <Text style={styles.mealCleanName} numberOfLines={1}>
              {meal.dishName}
            </Text>
          </View>
          <Text style={styles.mealCleanMacros}>
            <Text style={styles.mealCleanKcal}>{meal.calories} kcal</Text>
            {'  ·  '}
            <Text style={{ color: colors.protein }}>{meal.protein}g P</Text>
            {'  '}
            <Text style={{ color: colors.carbs }}>{meal.carbs}g C</Text>
            {'  '}
            <Text style={{ color: colors.fat }}>{meal.fat}g F</Text>
            {meal.portionMultiplier !== 1 ? (
              <Text style={styles.mealCleanPortion}>  ·  {meal.portionMultiplier}x</Text>
            ) : null}
          </Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.mealDeleteBtn, pressed && styles.pressed]}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        onPress={() => onDelete(meal)}
      >
        <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
      </Pressable>
    </View>
  );
});

interface SavedScanItemProps {
  item: ScannedProduct;
  onSelect: (item: ScannedProduct) => void;
}

const SavedScanItem = React.memo(function SavedScanItem({
  item,
  onSelect,
}: SavedScanItemProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const score = item.report.overallSafetyScore;
  const badgeColor =
    score >= 71
      ? colors.safetyClean
      : score >= 40
      ? colors.safetyModerate
      : colors.safetyHighRisk;

  return (
    <Pressable
      style={({ pressed }) => [styles.scannedCard, pressed && styles.pressed]}
      onPress={() => onSelect(item)}
    >
      <View style={styles.scannedCardHeader}>
        <View style={styles.scannedProductTitleCol}>
          <Text style={styles.scannedProductName} numberOfLines={1}>
            {item.productName}
          </Text>
          <View style={styles.scannedMetaRow}>
            {item.report.category ? (
              <View style={styles.scannedCategoryBadge}>
                <Text style={styles.scannedCategoryText}>{item.report.category}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View
          style={[
            styles.safetyScoreBadge,
            { backgroundColor: `${badgeColor}20`, borderColor: badgeColor },
          ]}
        >
          <Text style={[styles.safetyScoreNumber, { color: badgeColor }]}>{score}</Text>
          <Text style={[styles.safetyScoreLabel, { color: badgeColor }]}>
            {item.report.riskLevel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

