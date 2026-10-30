import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  calculateWorkoutVolume,
  useFitnessStore,
} from '../../store/useFitnessStore';
import { colors } from '../../theme/colors';
import { ExerciseItem, ExerciseSet, WorkoutSession } from '../../types';

const REST_PRESETS = [60, 90, 120];

function formatTime(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const POPULAR_EXERCISES = [
  'Barbell Bench Press',
  'Incline Dumbbell Press',
  'Barbell Back Squat',
  'Conventional Deadlift',
  'Overhead Shoulder Press',
  'Lat Pulldown',
  'Barbell Bent Over Row',
  'Dumbbell Bicep Curl',
  'Tricep Pushdown',
  'Leg Press',
  'Standing Calf Raise',
  'Hanging Leg Raise',
];

export default function WorkoutsScreen() {
  // Store subscriptions
  const activeWorkout = useFitnessStore((state) => state.activeWorkout);
  const workouts = useFitnessStore((state) => state.workouts);
  const startWorkout = useFitnessStore((state) => state.startWorkout);
  const updateActiveWorkout = useFitnessStore((state) => state.updateActiveWorkout);
  const addExerciseToActiveWorkout = useFitnessStore(
    (state) => state.addExerciseToActiveWorkout
  );
  const removeExerciseFromActiveWorkout = useFitnessStore(
    (state) => state.removeExerciseFromActiveWorkout
  );
  const addSetToActiveExercise = useFitnessStore(
    (state) => state.addSetToActiveExercise
  );
  const removeSetFromActiveExercise = useFitnessStore(
    (state) => state.removeSetFromActiveExercise
  );
  const updateSetInActiveExercise = useFitnessStore(
    (state) => state.updateSetInActiveExercise
  );
  const finishActiveWorkout = useFitnessStore((state) => state.finishActiveWorkout);
  const cancelActiveWorkout = useFitnessStore((state) => state.cancelActiveWorkout);
  const removeWorkout = useFitnessStore((state) => state.removeWorkout);

  // Auto-Rest Timer State (1-Hz countdown is isolated within FloatingRestTimer)
  const [restTimerSeconds, setRestTimerSeconds] = useState<number>(0);
  const [restTimerTotal, setRestTimerTotal] = useState<number>(90);
  const [isRestTimerActive, setIsRestTimerActive] = useState<boolean>(false);

  // Add Exercise Modal State
  const [isAddExerciseModalVisible, setIsAddExerciseModalVisible] =
    useState<boolean>(false);
  const [customExerciseName, setCustomExerciseName] = useState<string>('');
  const pendingUpdatesRef = useRef<Record<string, { exerciseId: string; setId: string; updates: Partial<ExerciseSet> }>>({});
  const debounceTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const flushPendingUpdates = useCallback(() => {
    Object.keys(debounceTimerRef.current).forEach((key) => {
      clearTimeout(debounceTimerRef.current[key]);
      delete debounceTimerRef.current[key];
    });
    Object.keys(pendingUpdatesRef.current).forEach((key) => {
      const item = pendingUpdatesRef.current[key];
      if (item) {
        updateSetInActiveExercise(item.exerciseId, item.setId, item.updates);
      }
      delete pendingUpdatesRef.current[key];
    });
  }, [updateSetInActiveExercise]);

  const debouncedUpdateSet = useCallback(
    (exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => {
      const key = `${exerciseId}_${setId}`;
      if (debounceTimerRef.current[key]) {
        clearTimeout(debounceTimerRef.current[key]);
      }
      pendingUpdatesRef.current[key] = {
        exerciseId,
        setId,
        updates: { ...(pendingUpdatesRef.current[key]?.updates || {}), ...updates },
      };
      debounceTimerRef.current[key] = setTimeout(() => {
        const item = pendingUpdatesRef.current[key];
        if (item) {
          updateSetInActiveExercise(item.exerciseId, item.setId, item.updates);
          delete pendingUpdatesRef.current[key];
        }
        delete debounceTimerRef.current[key];
      }, 300);
    },
    [updateSetInActiveExercise]
  );

  const handleEndEditingUpdate = useCallback(
    (exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => {
      const key = `${exerciseId}_${setId}`;
      if (debounceTimerRef.current[key]) {
        clearTimeout(debounceTimerRef.current[key]);
        delete debounceTimerRef.current[key];
      }
      delete pendingUpdatesRef.current[key];
      updateSetInActiveExercise(exerciseId, setId, updates);
    },
    [updateSetInActiveExercise]
  );

  // Clear debounce timers on unmount
  useEffect(() => {
    const timers = debounceTimerRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  // Rest Timer Controls (isolated within FloatingRestTimer)
  const triggerRestTimer = useCallback((seconds: number = 90) => {
    setRestTimerTotal(seconds);
    setRestTimerSeconds(seconds);
    setIsRestTimerActive(true);
  }, []);

  const handleAdjustRestTimer = useCallback((delta: number) => {
    setRestTimerSeconds((prev) => Math.max(0, prev + delta));
    setRestTimerTotal((prev) => Math.max(15, prev + delta));
  }, []);

  const handlePresetRestTimer = useCallback((sec: number) => {
    setRestTimerTotal(sec);
    setRestTimerSeconds(sec);
  }, []);

  const handleDismissRestTimer = useCallback(() => {
    setIsRestTimerActive(false);
    setRestTimerSeconds(0);
  }, []);

  // Toggle Set Complete (triggers auto-rest on completion)
  const handleToggleSetComplete = useCallback(
    (exerciseId: string, set: ExerciseSet) => {
      // Flush any pending typed updates for this set first
      const key = `${exerciseId}_${set.id}`;
      if (debounceTimerRef.current[key]) {
        clearTimeout(debounceTimerRef.current[key]);
        delete debounceTimerRef.current[key];
        const item = pendingUpdatesRef.current[key];
        if (item) {
          updateSetInActiveExercise(exerciseId, set.id, item.updates);
          delete pendingUpdatesRef.current[key];
        }
      }

      const nextCompleted = !set.completed;
      updateSetInActiveExercise(exerciseId, set.id, { completed: nextCompleted });

      if (nextCompleted) {
        triggerRestTimer(restTimerTotal > 0 ? restTimerTotal : 90);
      }
    },
    [updateSetInActiveExercise, triggerRestTimer, restTimerTotal]
  );

  const handleAddSet = useCallback(
    (exerciseId: string) => {
      addSetToActiveExercise(exerciseId);
    },
    [addSetToActiveExercise]
  );

  const handleRemoveSet = useCallback(
    (exerciseId: string, setId: string) => {
      removeSetFromActiveExercise(exerciseId, setId);
    },
    [removeSetFromActiveExercise]
  );

  const handleRemoveExercise = useCallback(
    (exerciseId: string) => {
      removeExerciseFromActiveWorkout(exerciseId);
    },
    [removeExerciseFromActiveWorkout]
  );

  // Finish Workout with Confirmation
  const handleConfirmFinishWorkout = useCallback(() => {
    // Flush all pending inputs before computing volume or finishing
    flushPendingUpdates();

    const currentWorkout = useFitnessStore.getState().activeWorkout;
    if (!currentWorkout) return;

    const totalVolume = calculateWorkoutVolume(currentWorkout.exercises);
    const completedSetsCount = currentWorkout.exercises.reduce(
      (sum, ex) => sum + ex.sets.filter((s) => s.completed).length,
      0
    );

    const startTime = currentWorkout.startedAt ? new Date(currentWorkout.startedAt).getTime() : Date.now();
    const finalElapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    const durationFormatted = formatTime(finalElapsedSeconds);

    Alert.alert(
      'Finish Workout',
      `Complete "${currentWorkout.title}"?\n\n• Duration: ${durationFormatted}\n• Total Volume: ${totalVolume.toLocaleString()} kg\n• Sets Completed: ${completedSetsCount}`,
      [
        { text: 'Keep Training', style: 'cancel' },
        {
          text: 'Finish & Save',
          style: 'default',
          onPress: () => {
            // Update duration before finalizing
            updateActiveWorkout({
              ...currentWorkout,
              durationSeconds: finalElapsedSeconds,
            });
            finishActiveWorkout();
            handleDismissRestTimer();
            Alert.alert(
              'Session Recorded',
              `Workout completed. You lifted ${totalVolume.toLocaleString()} kg of total volume today.`
            );
          },
        },
      ]
    );
  }, [flushPendingUpdates, updateActiveWorkout, finishActiveWorkout, handleDismissRestTimer]);

  // Cancel Workout with Confirmation
  const handleConfirmCancelWorkout = () => {
    Alert.alert(
      'Discard Workout?',
      'Are you sure you want to cancel this active workout? Logged sets for this session will not be saved.',
      [
        { text: 'No, Keep Going', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            cancelActiveWorkout();
            handleDismissRestTimer();
          },
        },
      ]
    );
  };

  // Add Exercise Handler
  const handleSelectAddExercise = (name: string) => {
    if (!name.trim()) return;
    addExerciseToActiveWorkout(name.trim());
    setCustomExerciseName('');
    setIsAddExerciseModalVisible(false);
  };

  // Delete past workout from history
  const handleConfirmDeleteHistory = useCallback(
    (workout: WorkoutSession) => {
      Alert.alert(
        'Delete Workout Record',
        `Delete "${workout.title}" from your workout history?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => removeWorkout(workout.id),
          },
        ]
      );
    },
    [removeWorkout]
  );

  // Compute live active workout volume
  const liveActiveVolume = useMemo(() => {
    if (!activeWorkout) return 0;
    return calculateWorkoutVolume(activeWorkout.exercises);
  }, [activeWorkout]);

  // Virtualized Workout History Renderer & List Header
  const renderWorkoutHistoryItem = useCallback(
    ({ item }: { item: WorkoutSession }) => (
      <WorkoutHistoryCard
        session={item}
        onDelete={handleConfirmDeleteHistory}
      />
    ),
    [handleConfirmDeleteHistory]
  );

  const listHeader = useMemo(
    () => (
      <View>
        {/* Header */}
        <View style={styles.inactiveHeaderRow}>
          <View>
            <Text style={styles.inactiveHeaderTitle}>Workouts</Text>
            <Text style={styles.inactiveHeaderSubtitle}>TRAINING & LOGS</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.startEmptyBtn, pressed && styles.pressed]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => startWorkout('Custom Workout')}
          >
            <Ionicons name="add" size={16} color={colors.textInverse} />
            <Text style={styles.startEmptyBtnText}>Start Empty</Text>
          </Pressable>
        </View>

        {/* 3 Built-In Workout Templates */}
        <View style={styles.templatesSection}>
          <Text style={styles.sectionHeaderTitle}>Routine Templates</Text>

          <View style={styles.templatesGrid}>
            {/* Push Day */}
            <Pressable
              style={({ pressed }) => [styles.templateCard, pressed && styles.pressed]}
              onPress={() => startWorkout('Push Day')}
            >
              <View style={[styles.templateIconBox, { backgroundColor: 'rgba(244, 63, 94, 0.1)' }]}>
                <Ionicons name="flame-outline" size={20} color="#F43F5E" />
              </View>
              <View style={styles.templateCardInfo}>
                <Text style={styles.templateCardTitle}>Push Day</Text>
                <Text style={styles.templateCardSubtitle}>Chest • Shoulders • Triceps</Text>
                <Text style={styles.templateCardExercises}>
                  Bench Press, Incline DB, Overhead Tri
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>

            {/* Pull Day */}
            <Pressable
              style={({ pressed }) => [styles.templateCard, pressed && styles.pressed]}
              onPress={() => startWorkout('Pull Day')}
            >
              <View style={[styles.templateIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.1)' }]}>
                <Ionicons name="barbell-outline" size={20} color="#38BDF8" />
              </View>
              <View style={styles.templateCardInfo}>
                <Text style={styles.templateCardTitle}>Pull Day</Text>
                <Text style={styles.templateCardSubtitle}>Back • Biceps • Traps</Text>
                <Text style={styles.templateCardExercises}>
                  Deadlift, Lat Pulldown, DB Bicep Curls
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>

            {/* Leg Day */}
            <Pressable
              style={({ pressed }) => [styles.templateCard, pressed && styles.pressed]}
              onPress={() => startWorkout('Leg Day')}
            >
              <View style={[styles.templateIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Ionicons name="fitness-outline" size={20} color="#10B981" />
              </View>
              <View style={styles.templateCardInfo}>
                <Text style={styles.templateCardTitle}>Leg Day</Text>
                <Text style={styles.templateCardSubtitle}>Quads • Hamstrings • Calves</Text>
                <Text style={styles.templateCardExercises}>
                  Back Squat, Leg Press, Calf Raises
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>

        {/* Workout History Section Title */}
        <View style={styles.historySection}>
          <Text style={styles.sectionHeaderTitle}>
            History ({workouts.length})
          </Text>
        </View>
      </View>
    ),
    [workouts.length, startWorkout]
  );

  // -------------------------------------------------------------
  // ACTIVE WORKOUT VIEW
  // -------------------------------------------------------------
  if (activeWorkout) {
    const completedSetsCount = activeWorkout.exercises.reduce(
      (sum, e) => sum + e.sets.filter((s) => s.completed).length,
      0
    );

    return (
      <SafeAreaView style={styles.safeArea}>
        {/* Top Active Bar */}
        <View style={styles.activeHeader}>
          <View style={styles.activeWorkoutTitleCol}>
            <View style={styles.liveIndicatorRow}>
              <View style={styles.livePulseDot} />
              <Text style={styles.activeWorkoutTitle} numberOfLines={1}>
                {activeWorkout.title}
              </Text>
            </View>
          </View>

          <View style={styles.activeHeaderRight}>
            <WorkoutTimerBadge startedAt={activeWorkout.startedAt} />

            <Pressable
              style={({ pressed }) => [
                styles.finishWorkoutButton,
                pressed && styles.pressed,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={handleConfirmFinishWorkout}
            >
              <Text style={styles.finishWorkoutButtonText}>Finish</Text>
            </Pressable>
          </View>
        </View>

        {/* Live Volume & Stats Ribbon */}
        <View style={styles.statsRibbon}>
          <View style={styles.ribbonItem}>
            <Text style={styles.ribbonValue}>{liveActiveVolume.toLocaleString()}</Text>
            <Text style={styles.ribbonLabel}>Volume (kg)</Text>
          </View>
          <View style={styles.ribbonDivider} />
          <View style={styles.ribbonItem}>
            <Text style={styles.ribbonValue}>{activeWorkout.exercises.length}</Text>
            <Text style={styles.ribbonLabel}>Exercises</Text>
          </View>
          <View style={styles.ribbonDivider} />
          <View style={styles.ribbonItem}>
            <Text style={styles.ribbonValue}>{completedSetsCount}</Text>
            <Text style={styles.ribbonLabel}>Completed Sets</Text>
          </View>
        </View>

        {/* Exercise List */}
        <ScrollView
          contentContainerStyle={styles.exerciseScrollList}
          showsVerticalScrollIndicator={false}
        >
          {activeWorkout.exercises.map((exercise: ExerciseItem) => (
            <ActiveExerciseCard
              key={exercise.id}
              exercise={exercise}
              onRemoveExercise={handleRemoveExercise}
              onAddSet={handleAddSet}
              onToggleComplete={handleToggleSetComplete}
              onDebouncedUpdate={debouncedUpdateSet}
              onEndEditingUpdate={handleEndEditingUpdate}
              onDeleteSet={handleRemoveSet}
            />
          ))}

          {/* Add Exercise CTA */}
          <Pressable
            style={({ pressed }) => [
              styles.addExerciseMainBtn,
              pressed && styles.pressed,
            ]}
            onPress={() => setIsAddExerciseModalVisible(true)}
          >
            <Ionicons name="add" size={18} color={colors.text} />
            <Text style={styles.addExerciseMainBtnText}>Add Exercise</Text>
          </Pressable>

          {/* Cancel Workout Button */}
          <Pressable
            style={({ pressed }) => [
              styles.cancelWorkoutBtn,
              pressed && styles.pressed,
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={handleConfirmCancelWorkout}
          >
            <Ionicons name="close-circle-outline" size={15} color={colors.danger} />
            <Text style={styles.cancelWorkoutBtnText}>Discard Workout</Text>
          </Pressable>
        </ScrollView>

        {/* Floating Auto-Rest Countdown Timer (Pill capsule) */}
        {isRestTimerActive && (
          <FloatingRestTimer
            key={`${restTimerSeconds}_${restTimerTotal}`}
            initialSeconds={restTimerSeconds}
            totalSeconds={restTimerTotal}
            onDismiss={handleDismissRestTimer}
            onAdjust={handleAdjustRestTimer}
            onPreset={handlePresetRestTimer}
          />
        )}

        {/* Add Exercise Modal */}
        <Modal
          visible={isAddExerciseModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setIsAddExerciseModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Exercise</Text>
                <Pressable
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => setIsAddExerciseModalVisible(false)}
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              {/* Custom Input */}
              <View style={styles.customExerciseRow}>
                <TextInput
                  style={styles.customExerciseInput}
                  placeholder="Custom exercise name..."
                  placeholderTextColor={colors.textMuted}
                  value={customExerciseName}
                  onChangeText={setCustomExerciseName}
                />
                <Pressable
                  style={[
                    styles.customExerciseSubmitBtn,
                    !customExerciseName.trim() && { opacity: 0.5 },
                  ]}
                  disabled={!customExerciseName.trim()}
                  onPress={() => handleSelectAddExercise(customExerciseName)}
                >
                  <Text style={styles.customExerciseSubmitText}>Add</Text>
                </Pressable>
              </View>

              <Text style={styles.modalSuggestionsHeader}>POPULAR EXERCISES</Text>

              <ScrollView style={styles.suggestionsScroll}>
                {POPULAR_EXERCISES.map((item, idx) => (
                  <Pressable
                    key={idx}
                    style={styles.suggestionRow}
                    onPress={() => handleSelectAddExercise(item)}
                  >
                    <Text style={styles.suggestionText}>{item}</Text>
                    <Ionicons name="add" size={18} color={colors.textSecondary} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id}
        renderItem={renderWorkoutHistoryItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.emptyHistoryCard}>
            <View style={styles.emptyHistoryIcon}>
              <Ionicons name="barbell-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyHistoryTitle}>No workouts logged yet</Text>
            <Text style={styles.emptyHistorySub}>
              Start a Push, Pull, or Legs session above. Completed sets and total volume will be recorded automatically.
            </Text>
          </View>
        }
        contentContainerStyle={styles.inactiveScrollContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Active Header
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  activeWorkoutTitleCol: {
    flex: 1,
    marginRight: 12,
  },
  liveIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  activeWorkoutTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  activeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  timerBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  finishWorkoutButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    justifyContent: 'center',
  },
  finishWorkoutButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textInverse,
  },

  // Live Stats Ribbon
  statsRibbon: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  ribbonItem: {
    alignItems: 'center',
  },
  ribbonValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  ribbonLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  ribbonDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.hairline,
  },

  // Exercise Scroll List
  exerciseScrollList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 130, // space for floating rest timer
    gap: 14,
  },
  exerciseCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  exerciseNameRow: {
    flex: 1,
    marginRight: 8,
  },
  exerciseNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  exerciseSetCountSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  setColumnsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  colHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  setRowCompleted: {
    borderColor: 'rgba(16, 185, 129, 0.25)',
    backgroundColor: 'rgba(16, 185, 129, 0.04)',
  },
  setNumberBadge: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumberText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  setNumberTextCompleted: {
    color: colors.primary,
  },
  setInputWrapper: {
    flex: 1,
  },
  numericInput: {
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
    fontVariant: ['tabular-nums'],
    minHeight: 38,
  },
  numericInputCompleted: {
    color: colors.primary,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  setCheckCircle: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteSetBtn: {
    width: 24,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteSetPlaceholder: {
    width: 24,
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.surfaceSubtle,
    marginTop: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  addSetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  addExerciseMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    paddingVertical: 14,
    minHeight: 48,
    gap: 6,
  },
  addExerciseMainBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  cancelWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    marginTop: 4,
  },
  cancelWorkoutBtnText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
  },

  // Floating Rest Timer (Clean Pill Capsule)
  floatingRestTimer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 16,
    right: 16,
    backgroundColor: '#161922',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  restTimerContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  restTimerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restTimerPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
  },
  restTimerTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  restTimerTimeText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  restTimerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  restTimerAdjustBtn: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  restTimerAdjustText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  restTimerSkipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  restTimerSkipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  restPresetsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  restPresetBtn: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  restPresetBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: colors.primary,
  },
  restPresetBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  restPresetBtnTextActive: {
    color: colors.primary,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  customExerciseRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  customExerciseInput: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.hairline,
    fontSize: 14,
  },
  customExerciseSubmitBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customExerciseSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textInverse,
  },
  modalSuggestionsHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  suggestionsScroll: {
    maxHeight: 280,
  },
  suggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  suggestionText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },

  // Inactive View Styling
  inactiveScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  inactiveHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  inactiveHeaderSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  inactiveHeaderTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  startEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  startEmptyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textInverse,
  },

  // Templates Section
  templatesSection: {
    marginBottom: 24,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  templatesGrid: {
    gap: 10,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 12,
  },
  templateIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateCardInfo: {
    flex: 1,
  },
  templateCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  templateCardSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  templateCardExercises: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },

  // History Section
  historySection: {
    marginBottom: 20,
  },
  emptyHistoryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyHistoryIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  emptyHistoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  emptyHistorySub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  historyList: {
    gap: 10,
  },
  historyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  historyTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  historySessionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  historyDateText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  historyMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  historyMetric: {
    alignItems: 'center',
    flex: 1,
  },
  historyMetricVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  historyMetricLabel: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
    fontWeight: '500',
  },
  historyMetricDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.hairline,
  },
  historyExercisesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  historyExercisePill: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  historyExercisePillText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});

interface WorkoutHistoryCardProps {
  session: WorkoutSession;
  onDelete: (workout: WorkoutSession) => void;
}

const WorkoutHistoryCard = React.memo(function WorkoutHistoryCard({
  session,
  onDelete,
}: WorkoutHistoryCardProps) {
  const dateStr = new Date(
    session.completedAt || session.startedAt
  ).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const durationMin = Math.round(session.durationSeconds / 60);

  return (
    <View style={styles.historyCard}>
      <View style={styles.historyTopRow}>
        <View>
          <Text style={styles.historySessionTitle}>{session.title}</Text>
          <Text style={styles.historyDateText}>{dateStr}</Text>
        </View>
        <Pressable
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => onDelete(session)}
        >
          <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.historyMetricsRow}>
        <View style={styles.historyMetric}>
          <Text style={styles.historyMetricVal}>
            {session.totalVolumeKg.toLocaleString()} kg
          </Text>
          <Text style={styles.historyMetricLabel}>Volume</Text>
        </View>

        <View style={styles.historyMetricDivider} />

        <View style={styles.historyMetric}>
          <Text style={styles.historyMetricVal}>
            {durationMin > 0 ? `${durationMin}m` : '<1m'}
          </Text>
          <Text style={styles.historyMetricLabel}>Duration</Text>
        </View>

        <View style={styles.historyMetricDivider} />

        <View style={styles.historyMetric}>
          <Text style={styles.historyMetricVal}>
            {session.exercises.length}
          </Text>
          <Text style={styles.historyMetricLabel}>Exercises</Text>
        </View>
      </View>

      {/* Exercises bullet preview */}
      <View style={styles.historyExercisesWrap}>
        {session.exercises.map((ex, i) => (
          <View key={ex.id || i} style={styles.historyExercisePill}>
            <Text style={styles.historyExercisePillText}>
              {ex.name} • {ex.sets.filter((s) => s.completed).length} sets
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
});

/* -------------------------------------------------------------
 * MEMOIZED SUBCOMPONENTS FOR ISOLATED ACTIVE WORKOUT RENDERING
 * ------------------------------------------------------------- */

/**
 * Isolated Workout Timer Badge:
 * Runs its own 1-Hz timer so the 1,500-line WorkoutsScreen is NOT re-rendered every second.
 */
const WorkoutTimerBadge = React.memo(function WorkoutTimerBadge({
  startedAt,
}: {
  startedAt: string;
}) {
  const [seconds, setSeconds] = useState<number>(() => {
    return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  });

  useEffect(() => {
    const startTime = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      setSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <View style={styles.timerBadge}>
      <Ionicons name="time-outline" size={14} color={colors.primary} />
      <Text style={styles.timerBadgeText}>{formatTime(seconds)}</Text>
    </View>
  );
});

/**
 * Isolated Floating Auto-Rest Timer:
 * Runs its own 1-Hz countdown without triggering re-renders of exercises and inputs.
 */
interface FloatingRestTimerProps {
  initialSeconds: number;
  totalSeconds: number;
  onDismiss: () => void;
  onAdjust: (delta: number) => void;
  onPreset: (seconds: number) => void;
}

const FloatingRestTimer = React.memo(function FloatingRestTimer({
  initialSeconds,
  totalSeconds,
  onDismiss,
  onAdjust,
  onPreset,
}: FloatingRestTimerProps) {
  const [seconds, setSeconds] = useState<number>(initialSeconds);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (initialSeconds <= 0) {
      onDismissRef.current();
      return;
    }
    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDismissRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [initialSeconds]);

  return (
    <View style={styles.floatingRestTimer}>
      <View style={styles.restTimerContentRow}>
        <View style={styles.restTimerLeft}>
          <View style={styles.restTimerPulseDot} />
          <View>
            <Text style={styles.restTimerTitle}>REST TIMER</Text>
            <Text style={styles.restTimerTimeText}>{formatTime(seconds)}</Text>
          </View>
        </View>

        {/* Quick Stepper +30s / -15s / Skip */}
        <View style={styles.restTimerControlsRow}>
          <Pressable
            style={({ pressed }) => [styles.restTimerAdjustBtn, pressed && styles.pressed]}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            onPress={() => onAdjust(-15)}
          >
            <Text style={styles.restTimerAdjustText}>-15s</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.restTimerAdjustBtn, pressed && styles.pressed]}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            onPress={() => onAdjust(30)}
          >
            <Text style={styles.restTimerAdjustText}>+30s</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.restTimerSkipBtn, pressed && styles.pressed]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={onDismiss}
          >
            <Text style={styles.restTimerSkipText}>Skip</Text>
          </Pressable>
        </View>
      </View>

      {/* Rest Presets (60s / 90s / 120s) */}
      <View style={styles.restPresetsRow}>
        {REST_PRESETS.map((sec) => (
          <Pressable
            key={sec}
            style={({ pressed }) => [
              styles.restPresetBtn,
              totalSeconds === sec && styles.restPresetBtnActive,
              pressed && styles.pressed,
            ]}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            onPress={() => onPreset(sec)}
          >
            <Text
              style={[
                styles.restPresetBtnText,
                totalSeconds === sec && styles.restPresetBtnTextActive,
              ]}
            >
              {sec}s
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

/**
 * Isolated Active Set Row:
 * Memoized so editing weight or reps in one set doesn't re-render other sets or exercises.
 */
interface ActiveSetRowProps {
  exerciseId: string;
  set: ExerciseSet;
  canDelete: boolean;
  onToggleComplete: (exerciseId: string, set: ExerciseSet) => void;
  onDebouncedUpdate: (exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => void;
  onEndEditingUpdate: (exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => void;
  onDeleteSet: (exerciseId: string, setId: string) => void;
}

const ActiveSetRow = React.memo(function ActiveSetRow({
  exerciseId,
  set,
  canDelete,
  onToggleComplete,
  onDebouncedUpdate,
  onEndEditingUpdate,
  onDeleteSet,
}: ActiveSetRowProps) {
  return (
    <View style={[styles.setRow, set.completed && styles.setRowCompleted]}>
      {/* Set Number */}
      <View style={styles.setNumberBadge}>
        <Text style={[styles.setNumberText, set.completed && styles.setNumberTextCompleted]}>
          {set.setNumber}
        </Text>
      </View>

      {/* Weight Input */}
      <View style={styles.setInputWrapper}>
        <TextInput
          style={[styles.numericInput, set.completed && styles.numericInputCompleted]}
          keyboardType="decimal-pad"
          selectTextOnFocus
          defaultValue={set.weightKg ? set.weightKg.toString() : ''}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          onChangeText={(val) => {
            const parsed = Math.max(0, parseFloat(val) || 0);
            onDebouncedUpdate(exerciseId, set.id, { weightKg: parsed });
          }}
          onEndEditing={(e) => {
            const parsed = Math.max(0, parseFloat(e.nativeEvent.text) || 0);
            onEndEditingUpdate(exerciseId, set.id, { weightKg: parsed });
          }}
        />
      </View>

      {/* Reps Input */}
      <View style={styles.setInputWrapper}>
        <TextInput
          style={[styles.numericInput, set.completed && styles.numericInputCompleted]}
          keyboardType="number-pad"
          selectTextOnFocus
          defaultValue={set.reps ? set.reps.toString() : ''}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          onChangeText={(val) => {
            const parsed = Math.max(0, parseInt(val, 10) || 0);
            onDebouncedUpdate(exerciseId, set.id, { reps: parsed });
          }}
          onEndEditing={(e) => {
            const parsed = Math.max(0, parseInt(e.nativeEvent.text, 10) || 0);
            onEndEditingUpdate(exerciseId, set.id, { reps: parsed });
          }}
        />
      </View>

      {/* Completed Checkbox */}
      <Pressable
        style={({ pressed }) => [styles.setCheckCircle, pressed && styles.pressed]}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        onPress={() => onToggleComplete(exerciseId, set)}
      >
        <Ionicons
          name={set.completed ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={set.completed ? colors.primary : colors.textMuted}
        />
      </Pressable>

      {/* Delete Set action */}
      {canDelete ? (
        <Pressable
          style={({ pressed }) => [styles.deleteSetBtn, pressed && styles.pressed]}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          onPress={() => onDeleteSet(exerciseId, set.id)}
          accessibilityLabel={`Delete set ${set.setNumber}`}
        >
          <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
        </Pressable>
      ) : (
        <View style={styles.deleteSetPlaceholder} />
      )}
    </View>
  );
});

/**
 * Isolated Active Exercise Card:
 * Renders exercise header, column titles, memoized sets, and add set action.
 */
interface ActiveExerciseCardProps {
  exercise: ExerciseItem;
  onRemoveExercise: (exerciseId: string) => void;
  onAddSet: (exerciseId: string) => void;
  onToggleComplete: (exerciseId: string, set: ExerciseSet) => void;
  onDebouncedUpdate: (exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => void;
  onEndEditingUpdate: (exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => void;
  onDeleteSet: (exerciseId: string, setId: string) => void;
}

const ActiveExerciseCard = React.memo(function ActiveExerciseCard({
  exercise,
  onRemoveExercise,
  onAddSet,
  onToggleComplete,
  onDebouncedUpdate,
  onEndEditingUpdate,
  onDeleteSet,
}: ActiveExerciseCardProps) {
  const completedSetsCount = exercise.sets.filter((s) => s.completed).length;

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseCardHeader}>
        <View style={styles.exerciseNameRow}>
          <Text style={styles.exerciseNameText}>{exercise.name}</Text>
          <Text style={styles.exerciseSetCountSub}>
            {completedSetsCount}/{exercise.sets.length} sets completed
          </Text>
        </View>
        <Pressable
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => onRemoveExercise(exercise.id)}
        >
          <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Set Column Headers */}
      <View style={styles.setColumnsHeader}>
        <Text style={[styles.colHeader, { width: 34 }]}>SET</Text>
        <Text style={[styles.colHeader, { flex: 1 }]}>WEIGHT (KG)</Text>
        <Text style={[styles.colHeader, { flex: 1 }]}>REPS</Text>
        <Text style={[styles.colHeader, { width: 44, textAlign: 'center' }]}>DONE</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Set Rows */}
      {exercise.sets.map((set: ExerciseSet) => (
        <ActiveSetRow
          key={set.id}
          exerciseId={exercise.id}
          set={set}
          canDelete={exercise.sets.length > 1}
          onToggleComplete={onToggleComplete}
          onDebouncedUpdate={onDebouncedUpdate}
          onEndEditingUpdate={onEndEditingUpdate}
          onDeleteSet={onDeleteSet}
        />
      ))}

      {/* Add Set Button */}
      <Pressable
        style={({ pressed }) => [styles.addSetButton, pressed && styles.pressed]}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        onPress={() => onAddSet(exercise.id)}
      >
        <Ionicons name="add" size={15} color={colors.textSecondary} />
        <Text style={styles.addSetButtonText}>Add Set</Text>
      </Pressable>
    </View>
  );
});
