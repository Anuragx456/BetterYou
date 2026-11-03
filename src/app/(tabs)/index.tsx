import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ToxicityReportModal } from '../../components/ToxicityReportModal';
import {
  addLocalDays,
  formatDateLabel,
  getLocalDateString,
  getRecentDaysList,
} from '../../utils/date';
import { safeHaptics } from '../../utils/haptics';
import {
  useFitnessStore,
} from '../../store/useFitnessStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { colors } from '../../theme/colors';
import { MacroBreakdown, MealLog, ScannedProduct } from '../../types';

export default function DashboardScreen() {
  const router = useRouter();

  // Toxicity Modal States
  const [selectedProduct, setSelectedProduct] = useState<ScannedProduct | null>(null);
  const [isAllScansModalVisible, setIsAllScansModalVisible] = useState<boolean>(false);

  // Zustand state subscriptions
  const meals = useFitnessStore((state) => state.meals);
  const workouts = useFitnessStore((state) => state.workouts);
  const dailyGoals = useFitnessStore((state) => state.dailyGoals);
  const activeWorkout = useFitnessStore((state) => state.activeWorkout);
  const streakDays = useFitnessStore((state) => state.streakDays);
  const scannedProducts = useFitnessStore((state) => state.scannedProducts);
  const removeMeal = useFitnessStore((state) => state.removeMeal);

  // Live selected product from store
  const activeSelectedProduct = selectedProduct
    ? scannedProducts.find((p) => p.id === selectedProduct.id) || selectedProduct
    : null;

  // Today's local date string (YYYY-MM-DD)
  const todayDateString = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayDateString);
  const isViewingToday = selectedDate === todayDateString;

  const recentDays = useMemo(() => getRecentDaysList(7), []);

  // Filter selected date's meals
  const todayMeals = useMemo(() => {
    return meals.filter((meal) => {
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
    return workouts.filter((w) => {
      try {
        const date = w.completedAt || w.startedAt;
        return getLocalDateString(date) === selectedDate;
      } catch {
        return false;
      }
    });
  }, [workouts, selectedDate]);

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
  const proteinTarget = Math.max(1, dailyGoals?.proteinTargetGrams || 160);
  const carbsTarget = Math.max(1, dailyGoals?.carbsTargetGrams || 220);
  const fatTarget = Math.max(1, dailyGoals?.fatTargetGrams || 65);

  const consumedCalories = todayTotals.calories;
  const remainingCalories = Math.max(0, calorieTarget - consumedCalories + todayCaloriesBurned);
  const calorieProgressPct = Math.min(100, Math.max(0, Math.round((consumedCalories / calorieTarget) * 100)));

  // Macro progress percentages guarded against NaN
  const proteinPct = Math.min(
    100,
    Math.max(0, Math.round((todayTotals.protein / proteinTarget) * 100))
  );
  const carbsPct = Math.min(
    100,
    Math.max(0, Math.round((todayTotals.carbs / carbsTarget) * 100))
  );
  const fatPct = Math.min(
    100,
    Math.max(0, Math.round((todayTotals.fat / fatTarget) * 100))
  );

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

  const hasDataOnDate = useCallback(
    (dateStr: string) => {
      const hasMeal = meals.some((m) => {
        try {
          return getLocalDateString(m.timestamp) === dateStr;
        } catch {
          return false;
        }
      });
      const hasWorkout = workouts.some((w) => {
        try {
          return getLocalDateString(w.completedAt || w.startedAt) === dateStr;
        } catch {
          return false;
        }
      });
      return hasMeal || hasWorkout;
    },
    [meals, workouts]
  );

  const customApiKey = useSettingsStore((state) => state.customApiKey);
  const effectiveKey = customApiKey?.trim() || process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim() || '';
  const hasGeminiKey = Boolean(effectiveKey);

  const handleShowAiKeyInfo = useCallback(() => {
    router.push('/(tabs)/settings');
  }, [router]);

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
    setIsAllScansModalVisible(false);
    setSelectedProduct(item);
  }, []);

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
              <Ionicons name="flame" size={15} color="#10B981" />
              <Text style={styles.streakText}>{streakDays}</Text>
            </View>

            {/* AI Status Indicator */}
            <Pressable
              style={({ pressed }) => [
                styles.aiStatusDotBtn,
                pressed && styles.pressed,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              onPress={handleShowAiKeyInfo}
              accessibilityLabel="AI Settings"
            >
              <View
                style={[
                  styles.aiStatusDot,
                  { backgroundColor: hasGeminiKey ? colors.primary : colors.warning },
                ]}
              />
            </Pressable>

            {/* Settings Button */}
            <Pressable
              style={({ pressed }) => [
                styles.settingsHeaderButton,
                pressed && styles.pressed,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              onPress={() => router.push('/(tabs)/settings')}
              accessibilityLabel="Open Settings"
            >
              <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* Date Navigation Scrubber */}
        <View style={styles.dateScrubberContainer}>
          <Pressable
            style={({ pressed }) => [styles.dateNavArrow, pressed && styles.pressed]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={handlePrevDay}
            accessibilityLabel="Previous day"
          >
            <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
          </Pressable>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateDaysScroll}
          >
            {recentDays.map((day) => {
              const isSelected = day.dateStr === selectedDate;
              const hasData = hasDataOnDate(day.dateStr);

              return (
                <Pressable
                  key={day.dateStr}
                  style={({ pressed }) => [
                    styles.dayPill,
                    isSelected && styles.dayPillSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => handleSelectDay(day.dateStr)}
                >
                  <Text style={[styles.dayPillName, isSelected && styles.dayPillTextActive]}>
                    {day.dayName}
                  </Text>
                  <Text style={[styles.dayPillNum, isSelected && styles.dayPillTextActive]}>
                    {day.dayNum}
                  </Text>
                  <View
                    style={[
                      styles.dayPillDot,
                      hasData && (isSelected ? styles.dayPillDotActive : styles.dayPillDotMuted),
                      !hasData && styles.dayPillDotEmpty,
                    ]}
                  />
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            style={({ pressed }) => [
              styles.dateNavArrow,
              !canGoForward && styles.dateNavArrowDisabled,
              pressed && canGoForward && styles.pressed,
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={handleNextDay}
            disabled={!canGoForward}
            accessibilityLabel="Next day"
          >
            <Ionicons
              name="chevron-forward"
              size={16}
              color={canGoForward ? colors.textSecondary : colors.hairline}
            />
          </Pressable>
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
              onPress={handleReturnToToday}
            >
              <Ionicons name="return-up-back" size={13} color={colors.primary} />
              <Text style={styles.backToTodayBtnText}>Back to Today</Text>
            </Pressable>
          </View>
        )}

        {/* Daily Calorie & Macro Hero Card */}
        <View style={styles.heroCard}>
          {/* Circular Calorie Ring Indicator (Tap to edit goal in settings) */}
          <Pressable
            style={({ pressed }) => [styles.ringContainer, pressed && styles.pressed]}
            onPress={() => router.push('/nutrition-target')}
            hitSlop={8}
          >
            <View style={styles.ringOuter}>
              <View
                style={[
                  styles.ringProgressArc,
                  {
                    borderTopColor: colors.primary,
                    borderRightColor: calorieProgressPct >= 30 ? colors.primary : 'transparent',
                    borderBottomColor: calorieProgressPct >= 65 ? colors.primary : 'transparent',
                    borderLeftColor: calorieProgressPct >= 90 ? colors.primary : 'transparent',
                    transform: [{ rotate: '-45deg' }],
                  },
                ]}
              />
              <View style={styles.ringInner}>
                <Text style={styles.ringLabel}>Remaining</Text>
                <Text style={styles.ringNumber}>{remainingCalories.toLocaleString()}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Text style={styles.ringTarget}>/ {calorieTarget.toLocaleString()} kcal</Text>
                  <Ionicons name="pencil" size={10} color={colors.textMuted} />
                </View>
                <Text style={styles.ringSub}>{consumedCalories} consumed</Text>
              </View>
            </View>
          </Pressable>

          {/* Minimal Inline Macro Bars */}
          <View style={styles.macroRow}>
            {/* Protein */}
            <View style={styles.macroCol}>
              <View style={styles.macroHeader}>
                <Text style={styles.macroTitle}>Protein</Text>
              </View>
              <View style={styles.macroBarTrack}>
                <View
                  style={[
                    styles.macroBarFill,
                    { width: `${proteinPct}%`, backgroundColor: colors.protein },
                  ]}
                />
              </View>
              <Text style={styles.macroGramText}>
                {todayTotals.protein}g <Text style={styles.macroTargetText}>/ {dailyGoals.proteinTargetGrams}g</Text>
              </Text>
            </View>

            {/* Carbs */}
            <View style={styles.macroCol}>
              <View style={styles.macroHeader}>
                <Text style={styles.macroTitle}>Carbs</Text>
              </View>
              <View style={styles.macroBarTrack}>
                <View
                  style={[
                    styles.macroBarFill,
                    { width: `${carbsPct}%`, backgroundColor: colors.carbs },
                  ]}
                />
              </View>
              <Text style={styles.macroGramText}>
                {todayTotals.carbs}g <Text style={styles.macroTargetText}>/ {dailyGoals.carbsTargetGrams}g</Text>
              </Text>
            </View>

            {/* Fats */}
            <View style={styles.macroCol}>
              <View style={styles.macroHeader}>
                <Text style={styles.macroTitle}>Fats</Text>
              </View>
              <View style={styles.macroBarTrack}>
                <View
                  style={[
                    styles.macroBarFill,
                    { width: `${fatPct}%`, backgroundColor: colors.fat },
                  ]}
                />
              </View>
              <Text style={styles.macroGramText}>
                {todayTotals.fat}g <Text style={styles.macroTargetText}>/ {dailyGoals.fatTargetGrams}g</Text>
              </Text>
            </View>
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
              onPress={() => router.push('/workouts')}
            >
              <Text style={styles.cleanLinkText}>Open</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.primary} />
            </Pressable>
          </View>

          {activeWorkout && isViewingToday ? (
            <View style={styles.activeWorkoutBanner}>
              <View style={styles.activeWorkoutLeft}>
                <View style={styles.pulseDot} />
                <View>
                  <Text style={styles.activeWorkoutTitle}>
                    {activeWorkout.title}
                  </Text>
                  <Text style={styles.activeWorkoutSub}>
                    {activeWorkout.exercises.length} Exercises in progress
                  </Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.resumeWorkoutBtn,
                  pressed && styles.pressed,
                ]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                onPress={() => router.push('/workouts')}
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

          {!activeWorkout && todayWorkouts.length === 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.startWorkoutCta,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push('/workouts')}
            >
              <Ionicons name="add" size={17} color={colors.primary} />
              <Text style={styles.startWorkoutCtaText}>Start Workout</Text>
            </Pressable>
          )}
        </View>

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
              onPress={() => router.push('/meal-scan')}
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
                  onDelete={handleConfirmDeleteMeal}
                />
              ))}
            </View>
          )}
        </View>

        {/* Recent Scanned Toxicity Products */}
        {scannedProducts.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTitleWithIcon}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={colors.primary}
                />
                <Text style={styles.cardTitle}>Recent Toxicity Checks</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.cleanLinkBtn, pressed && styles.pressed]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => router.push('/toxicity-scan')}
              >
                <Text style={styles.cleanLinkText}>Scan</Text>
                <Ionicons name="chevron-forward" size={13} color={colors.primary} />
              </Pressable>
            </View>

            <View style={styles.scannedCleanList}>
              {scannedProducts.slice(0, 3).map((item: ScannedProduct, idx) => {
                const isLast = idx === Math.min(scannedProducts.length, 3) - 1;
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
                    onPress={() => setSelectedProduct(item)}
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
                          {item.report.harmfulIngredients.length > 0
                            ? `Flagged ${item.report.harmfulIngredients.length} harmful additives`
                            : item.report.riskLevel}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>

            {scannedProducts.length > 3 && (
              <Pressable
                style={({ pressed }) => [styles.viewAllHistoryBtnClean, pressed && styles.pressed]}
                onPress={() => setIsAllScansModalVisible(true)}
              >
                <Text style={styles.viewAllHistoryTextClean}>
                  View All Saved ({scannedProducts.length})
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      {/* Full Toxicity Report Modal */}
      <ToxicityReportModal
        visible={!!activeSelectedProduct}
        product={activeSelectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      {/* All Saved Scans Modal */}
      <Modal
        visible={isAllScansModalVisible}
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

          <FlatList
            data={scannedProducts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.allScansList}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            renderItem={renderScannedItem}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 12,
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
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
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
  dateLabel: {
    fontSize: 12,
    fontWeight: '500',
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
  aiStatusDotBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 17,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    minHeight: 34,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  settingsHeaderButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero Card with Circular Calorie Gauge
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
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
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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

/* -------------------------------------------------------------
 * MEMOIZED LIST ITEM SUBCOMPONENTS
 * ------------------------------------------------------------- */

interface MealListItemProps {
  meal: MealLog;
  isLast: boolean;
  onDelete: (meal: MealLog) => void;
}

const MealListItem = React.memo(function MealListItem({
  meal,
  isLast,
  onDelete,
}: MealListItemProps) {
  return (
    <View style={[styles.mealCleanItem, !isLast && styles.mealCleanItemBorder]}>
      <View style={styles.mealCleanLeft}>
        {meal.imageUri ? (
          <Image
            source={{ uri: meal.imageUri }}
            style={styles.mealCleanThumb}
            contentFit="cover"
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
            {meal.portionMultiplier !== 1 && (
              <Text style={styles.mealCleanPortion}>  ·  {meal.portionMultiplier}x</Text>
            )}
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
            {item.report.category && (
              <View style={styles.scannedCategoryBadge}>
                <Text style={styles.scannedCategoryText}>{item.report.category}</Text>
              </View>
            )}
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

