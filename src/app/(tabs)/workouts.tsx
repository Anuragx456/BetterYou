import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EditWorkoutModal } from '../../components/EditWorkoutModal';
import { ExerciseHistoryModal } from '../../components/ExerciseHistoryModal';
import {
  generateJsonBackup,
  generateWorkoutsCsv,
  shareOrCopyData,
} from '../../services/backupService';
import {
  cancelRestTimerNotification,
  scheduleRestTimerNotification,
  subscribeToForegroundRestSync,
} from '../../services/restTimerNotification';
import {
  calculateWorkoutVolume,
  useFitnessStore,
} from '../../store/useFitnessStore';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import { ExerciseItem, ExerciseSet, WorkoutSession } from '../../types';
import { safeHaptics } from '../../utils/haptics';
import {
  buildExerciseHistoryIndex,
  normalizeExerciseName,
  personalRecordFromSnapshot,
  type ExerciseHistoryIndex,
} from '../../utils/workoutAnalytics';

const REST_PRESETS = [60, 90, 120];

function formatTime(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function secondsUntil(endsAt: number): number {
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

/**
 * Diary clock. Ticks inside this row so the workout history list is not rebuilt every second.
 */
const DiaryTimerReadout = React.memo(function DiaryTimerReadout({
  endsAt,
}: {
  endsAt: number | null;
}) {
  const styles = useThemedStyles(createStyles);
  const [trackedEndsAt, setTrackedEndsAt] = useState(endsAt);
  const [label, setLabel] = useState(() => (endsAt ? formatTime(secondsUntil(endsAt)) : '120m'));

  if (trackedEndsAt !== endsAt) {
    setTrackedEndsAt(endsAt);
    setLabel(endsAt ? formatTime(secondsUntil(endsAt)) : '120m');
  }

  useEffect(() => {
    if (!endsAt) return;
    const interval = setInterval(() => {
      setLabel(formatTime(secondsUntil(endsAt)));
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  return (
    <Text style={styles.timerDurationBig} allowFontScaling>
      {label}
    </Text>
  );
});

const ExerciseSuggestionRow = React.memo(function ExerciseSuggestionRow({
  name,
  onSelect,
}: {
  name: string;
  onSelect: (name: string) => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      style={styles.suggestionRow}
      onPress={() => onSelect(name)}
      accessibilityRole="button"
      accessibilityLabel={`Add ${name}`}
    >
      <Text style={styles.suggestionText} allowFontScaling>
        {name}
      </Text>
      <Ionicons name="add" size={18} color={colors.textSecondary} />
    </Pressable>
  );
});

function AddExerciseSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string) => void;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (!visible) setCustomExerciseName('');
  }

  const renderSuggestion = useCallback(
    ({ item }: { item: string }) => <ExerciseSuggestionRow name={item} onSelect={onSelect} />,
    [onSelect]
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} allowFontScaling>
              Add Exercise
            </Text>
            <Pressable
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close add exercise modal"
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.customExerciseRow}>
            <TextInput
              style={styles.customExerciseInput}
              placeholder="Custom exercise name..."
              placeholderTextColor={colors.textMuted}
              value={customExerciseName}
              onChangeText={setCustomExerciseName}
              selectionColor={colors.primary}
              accessibilityLabel="Custom exercise name input"
            />
            <Pressable
              style={[
                styles.customExerciseSubmitBtn,
                !customExerciseName.trim() && { opacity: 0.5 },
              ]}
              disabled={!customExerciseName.trim()}
              onPress={() => onSelect(customExerciseName)}
              accessibilityRole="button"
              accessibilityLabel="Add custom exercise"
            >
              <Text style={styles.customExerciseSubmitText}>Add</Text>
            </Pressable>
          </View>

          <Text style={styles.modalSuggestionsHeader} allowFontScaling>
            POPULAR EXERCISES
          </Text>

          <View style={{ height: 260 }}>
            <FlashList
              data={POPULAR_EXERCISES}
              keyExtractor={(item) => item}
              renderItem={renderSuggestion}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
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
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  // Store subscriptions (granular selectors)
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
  const updateWorkout = useFitnessStore((state) => state.updateWorkout);
  const removeWorkout = useFitnessStore((state) => state.removeWorkout);

  useEffect(() => {
    useFitnessStore.getState().loadWorkoutHistory().catch(() => {});
  }, []);

  // Wall-clock rest session. The visible countdown lives in isolated children.
  const [restSession, setRestSession] = useState<{ endsAt: number; total: number } | null>(null);
  const preferredRestSeconds = useRef(90);

  // Modals
  const [isAddExerciseModalVisible, setIsAddExerciseModalVisible] =
    useState<boolean>(false);
  const [selectedHistoryExercise, setSelectedHistoryExercise] = useState<string | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSession | null>(null);
  const [workoutTab, setWorkoutTab] = useState<'practise' | 'timer' | 'checkin'>('practise');

  // Direct set update handler (fired onEndEditing, not per keystroke)
  const handleEndEditingUpdate = useCallback(
    (exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => {
      updateSetInActiveExercise(exerciseId, setId, updates);
    },
    [updateSetInActiveExercise]
  );

  // Rest Timer Controls
  const triggerRestTimer = useCallback((seconds: number = preferredRestSeconds.current) => {
    const safe = Math.max(1, Math.round(seconds));
    preferredRestSeconds.current = safe;
    setRestSession({ endsAt: Date.now() + safe * 1000, total: safe });
  }, []);

  const handleAdjustRestTimer = useCallback((delta: number) => {
    safeHaptics.selection();
    setRestSession((prev) => {
      if (!prev) return prev;
      const remaining = Math.max(0, secondsUntil(prev.endsAt) + delta);
      const total = Math.max(15, prev.total + delta);
      preferredRestSeconds.current = total;
      return { endsAt: Date.now() + remaining * 1000, total };
    });
  }, []);

  const handlePresetRestTimer = useCallback((sec: number) => {
    safeHaptics.selection();
    const safe = Math.max(15, sec);
    preferredRestSeconds.current = safe;
    setRestSession({ endsAt: Date.now() + safe * 1000, total: safe });
  }, []);

  const handleDismissRestTimer = useCallback(() => {
    cancelRestTimerNotification();
    setRestSession(null);
  }, []);

  // Toggle Set Complete (triggers auto-rest on completion + PR detection)
  const handleToggleSetComplete = useCallback(
    (exerciseId: string, set: ExerciseSet) => {
      const nextCompleted = !set.completed;
      updateSetInActiveExercise(exerciseId, set.id, { completed: nextCompleted });

      if (nextCompleted) {
        safeHaptics.success();
        triggerRestTimer(preferredRestSeconds.current);
      } else {
        safeHaptics.selection();
      }
    },
    [updateSetInActiveExercise, triggerRestTimer]
  );

  const historyIndex = useMemo(() => buildExerciseHistoryIndex(workouts), [workouts]);

  // Add Set with previous-session value pre-filling
  const handleAddSet = useCallback(
    (exerciseId: string) => {
      safeHaptics.selection();
      const currentWorkout = useFitnessStore.getState().activeWorkout;
      const ex = currentWorkout?.exercises.find((e) => e.id === exerciseId);
      addSetToActiveExercise(exerciseId);

      // If user had previous values for this set number, prefill it!
      if (ex) {
        const prev = historyIndex.get(normalizeExerciseName(ex.name))?.previous;
        const nextSetIdx = ex.sets.length; // index for the new set
        if (prev && prev.sets[nextSetIdx]) {
          const pastSet = prev.sets[nextSetIdx];
          setTimeout(() => {
            const updatedWorkout = useFitnessStore.getState().activeWorkout;
            const updatedEx = updatedWorkout?.exercises.find((e) => e.id === exerciseId);
            const newlyAddedSet = updatedEx?.sets[updatedEx.sets.length - 1];
            if (newlyAddedSet) {
              updateSetInActiveExercise(exerciseId, newlyAddedSet.id, {
                weightKg: pastSet.weightKg,
                reps: pastSet.reps,
              });
            }
          }, 40);
        }
      }
    },
    [addSetToActiveExercise, historyIndex, updateSetInActiveExercise]
  );

  const handleRemoveSet = useCallback(
    (exerciseId: string, setId: string) => {
      safeHaptics.warning();
      removeSetFromActiveExercise(exerciseId, setId);
    },
    [removeSetFromActiveExercise]
  );

  const handleRemoveExercise = useCallback(
    (exerciseId: string) => {
      safeHaptics.warning();
      removeExerciseFromActiveWorkout(exerciseId);
    },
    [removeExerciseFromActiveWorkout]
  );

  // Finish Workout with Confirmation
  const handleConfirmFinishWorkout = useCallback(() => {
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
            updateActiveWorkout({
              ...currentWorkout,
              durationSeconds: finalElapsedSeconds,
            });
            finishActiveWorkout();
            handleDismissRestTimer();
            safeHaptics.success();
            Alert.alert(
              'Session Recorded',
              `Workout completed. You lifted ${totalVolume.toLocaleString()} kg of total volume today.`
            );
          },
        },
      ]
    );
  }, [updateActiveWorkout, finishActiveWorkout, handleDismissRestTimer]);

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
  const openExerciseHistory = useCallback((name: string) => {
    setSelectedHistoryExercise(name);
  }, []);

  const renderActiveExercise = useCallback(
    ({ item }: { item: ExerciseItem }) => (
      <ActiveExerciseCard
        exercise={item}
        historyIndex={historyIndex}
        onRemoveExercise={handleRemoveExercise}
        onAddSet={handleAddSet}
        onToggleComplete={handleToggleSetComplete}
        onEndEditingUpdate={handleEndEditingUpdate}
        onDeleteSet={handleRemoveSet}
        onOpenExerciseHistory={openExerciseHistory}
      />
    ),
    [
      historyIndex,
      handleRemoveExercise,
      handleAddSet,
      handleToggleSetComplete,
      handleEndEditingUpdate,
      handleRemoveSet,
      openExerciseHistory,
    ]
  );

  const handleSelectAddExercise = useCallback(
    (name: string) => {
      if (!name.trim()) return;
      addExerciseToActiveWorkout(name.trim());

      const prev = historyIndex.get(normalizeExerciseName(name.trim()))?.previous;
      if (prev && prev.sets.length > 0) {
        setTimeout(() => {
          const currentWorkout = useFitnessStore.getState().activeWorkout;
          const newlyAddedEx = currentWorkout?.exercises[currentWorkout.exercises.length - 1];
          if (newlyAddedEx && newlyAddedEx.sets[0]) {
            updateSetInActiveExercise(newlyAddedEx.id, newlyAddedEx.sets[0].id, {
              weightKg: prev.sets[0].weightKg,
              reps: prev.sets[0].reps,
            });
          }
        }, 40);
      }

      setIsAddExerciseModalVisible(false);
    },
    [addExerciseToActiveWorkout, historyIndex, updateSetInActiveExercise]
  );

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

  // Export Workouts to CSV or JSON
  const handleExportWorkouts = useCallback(async () => {
    Alert.alert(
      'Export Workout Data',
      'Choose export format for your workout records:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export CSV',
          onPress: async () => {
            const csv = generateWorkoutsCsv(workouts);
            const status = await shareOrCopyData(csv, 'BetterYou_Workouts.csv');
            Alert.alert(
              status === 'shared' ? 'Workouts Exported' : 'CSV Copied to Clipboard',
              `Exported ${workouts.length} workout sessions.`
            );
          },
        },
        {
          text: 'Full JSON Backup',
          onPress: async () => {
            const meals = useFitnessStore.getState().meals;
            const goals = useFitnessStore.getState().dailyGoals;
            const json = generateJsonBackup(workouts, meals, goals);
            const status = await shareOrCopyData(json, 'BetterYou_Backup.json');
            Alert.alert(
              status === 'shared' ? 'Backup Shared' : 'Backup Copied to Clipboard',
              'Full JSON database backup generated.'
            );
          },
        },
      ]
    );
  }, [workouts]);

  // Compute live active workout volume
  const liveActiveVolume = useMemo(() => {
    if (!activeWorkout) return 0;
    return calculateWorkoutVolume(activeWorkout.exercises);
  }, [activeWorkout]);

  // Virtualized Workout History Renderer
  const renderWorkoutHistoryItem = useCallback(
    ({ item }: { item: WorkoutSession }) => (
      <WorkoutHistoryCard
        session={item}
        onDelete={handleConfirmDeleteHistory}
        onEdit={setEditingWorkout}
      />
    ),
    [handleConfirmDeleteHistory, setEditingWorkout]
  );

  const listHeader = useMemo(
    () => (
      <View>
        {/* Header - Matching Reference Screen 4 */}
        <View style={styles.inactiveHeaderRow}>
          <View>
            <Text style={styles.inactiveHeaderTitle} allowFontScaling>
              Workout Diary
            </Text>
            <Text style={styles.inactiveHeaderSubtitle} allowFontScaling>
              TRAINING & PROGRESSION
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Pressable
              style={({ pressed }) => [styles.exportBtn, pressed && styles.pressed]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={handleExportWorkouts}
              accessibilityRole="button"
              accessibilityLabel="Export workouts data to CSV or JSON"
            >
              <Ionicons name="create-outline" size={17} color={colors.text} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.startEmptyBtn, pressed && styles.pressed]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => {
                safeHaptics.impactLight();
                startWorkout('Custom Workout');
              }}
              accessibilityRole="button"
              accessibilityLabel="Start an empty custom workout"
            >
              <Ionicons name="add" size={16} color={colors.textInverse} />
              <Text style={styles.startEmptyBtnText} allowFontScaling>
                Start
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Segmented Pill Tabs: Practise, Timer, Check in */}
        <View style={styles.segmentedTabsRow}>
          <Pressable
            style={[
              styles.segmentedTab,
              workoutTab === 'practise' && styles.segmentedTabActive,
            ]}
            onPress={() => {
              safeHaptics.selection();
              setWorkoutTab('practise');
            }}
          >
            <Text
              style={[
                styles.segmentedTabText,
                workoutTab === 'practise' && styles.segmentedTabTextActive,
              ]}
            >
              Practise
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.segmentedTab,
              workoutTab === 'timer' && styles.segmentedTabActive,
            ]}
            onPress={() => {
              safeHaptics.selection();
              setWorkoutTab('timer');
            }}
          >
            <Text
              style={[
                styles.segmentedTabText,
                workoutTab === 'timer' && styles.segmentedTabTextActive,
              ]}
            >
              Timer
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.segmentedTab,
              workoutTab === 'checkin' && styles.segmentedTabActive,
            ]}
            onPress={() => {
              safeHaptics.selection();
              setWorkoutTab('checkin');
            }}
          >
            <Text
              style={[
                styles.segmentedTabText,
                workoutTab === 'checkin' && styles.segmentedTabTextActive,
              ]}
            >
              Check in
            </Text>
          </Pressable>
        </View>

        {/* Interval Timer Widget Card (Dark Charcoal #181A20 from Reference Screen 4) */}
        <View style={styles.intervalTimerCard}>
          <View style={styles.timerCardLeft}>
            <View style={styles.timerIconBadge}>
              <Ionicons name="stopwatch" size={16} color="#FFFFFF" />
            </View>
            <View style={styles.timerTitleCol}>
              <Text style={styles.timerTitle}>Timer</Text>
              <Text style={styles.timerSubtitle}>
                Manage your exercise with Interval Timer
              </Text>
              <DiaryTimerReadout endsAt={restSession?.endsAt ?? null} />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.timerPlayButton,
              pressed && styles.pressed,
            ]}
            onPress={() => {
              safeHaptics.impactMedium();
              if (restSession) {
                handleDismissRestTimer();
              } else {
                triggerRestTimer(120);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={restSession ? 'Pause timer' : 'Start interval timer'}
          >
            <Ionicons
              name={restSession ? 'pause' : 'play'}
              size={18}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        {/* 3 Built-In Workout Templates */}
        <View style={styles.templatesSection}>
          <Text style={styles.sectionHeaderTitle} allowFontScaling>
            Routine Templates
          </Text>

          <View style={styles.templatesGrid}>
            {/* Push Day */}
            <Pressable
              style={({ pressed }) => [styles.templateCard, pressed && styles.pressed]}
              onPress={() => {
                safeHaptics.impactLight();
                startWorkout('Push Day');
              }}
              accessibilityRole="button"
              accessibilityLabel="Start Push Day routine template"
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
              onPress={() => {
                safeHaptics.impactLight();
                startWorkout('Pull Day');
              }}
              accessibilityRole="button"
              accessibilityLabel="Start Pull Day routine template"
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
              onPress={() => {
                safeHaptics.impactLight();
                startWorkout('Leg Day');
              }}
              accessibilityRole="button"
              accessibilityLabel="Start Leg Day routine template"
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
          <Text style={styles.sectionHeaderTitle} allowFontScaling>
            History ({workouts.length})
          </Text>
        </View>
      </View>
    ),
    [
      workouts.length,
      startWorkout,
      handleExportWorkouts,
      workoutTab,
      restSession,
      triggerRestTimer,
      handleDismissRestTimer,
      colors,
      styles,
    ]
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
              <Text style={styles.activeWorkoutTitle} numberOfLines={1} allowFontScaling>
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
              accessibilityRole="button"
              accessibilityLabel="Finish and save active workout"
            >
              <Text style={styles.finishWorkoutButtonText} allowFontScaling>
                Finish
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Live Volume & Stats Ribbon */}
        <View style={styles.statsRibbon}>
          <View style={styles.ribbonItem}>
            <Text style={styles.ribbonValue} allowFontScaling>
              {liveActiveVolume.toLocaleString()}
            </Text>
            <Text style={styles.ribbonLabel} allowFontScaling>
              Volume (kg)
            </Text>
          </View>
          <View style={styles.ribbonDivider} />
          <View style={styles.ribbonItem}>
            <Text style={styles.ribbonValue} allowFontScaling>
              {activeWorkout.exercises.length}
            </Text>
            <Text style={styles.ribbonLabel} allowFontScaling>
              Exercises
            </Text>
          </View>
          <View style={styles.ribbonDivider} />
          <View style={styles.ribbonItem}>
            <Text style={styles.ribbonValue} allowFontScaling>
              {completedSetsCount}
            </Text>
            <Text style={styles.ribbonLabel} allowFontScaling>
              Completed Sets
            </Text>
          </View>
        </View>

        <FlashList
          data={activeWorkout.exercises}
          keyExtractor={(item) => item.id}
          renderItem={renderActiveExercise}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.exerciseScrollList}
          style={styles.activeExerciseList}
          ListFooterComponent={
            <View>
              <Pressable
                style={({ pressed }) => [
                  styles.addExerciseMainBtn,
                  pressed && styles.pressed,
                ]}
                onPress={() => setIsAddExerciseModalVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Add an exercise to this session"
              >
                <Ionicons name="add" size={18} color={colors.text} />
                <Text style={styles.addExerciseMainBtnText} allowFontScaling>
                  Add Exercise
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.cancelWorkoutBtn,
                  pressed && styles.pressed,
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={handleConfirmCancelWorkout}
                accessibilityRole="button"
                accessibilityLabel="Discard active workout"
              >
                <Ionicons name="close-circle-outline" size={15} color={colors.danger} />
                <Text style={styles.cancelWorkoutBtnText} allowFontScaling>
                  Discard Workout
                </Text>
              </Pressable>
            </View>
          }
        />

        {restSession ? (
          <FloatingRestTimer
            endsAt={restSession.endsAt}
            totalSeconds={restSession.total}
            onDismiss={handleDismissRestTimer}
            onAdjust={handleAdjustRestTimer}
            onPreset={handlePresetRestTimer}
          />
        ) : null}

        <AddExerciseSheet
          visible={isAddExerciseModalVisible}
          onClose={() => setIsAddExerciseModalVisible(false)}
          onSelect={handleSelectAddExercise}
        />

        {/* Per-Exercise Progression History Modal */}
        {selectedHistoryExercise ? (
          <ExerciseHistoryModal
            visible={!!selectedHistoryExercise}
            exerciseName={selectedHistoryExercise}
            historyIndex={historyIndex}
            onClose={() => setSelectedHistoryExercise(null)}
          />
        ) : null}
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------
  // INACTIVE WORKOUT VIEW (FlashList of Workout History)
  // -------------------------------------------------------------
  return (
    <SafeAreaView style={styles.safeArea}>
      <FlashList
        data={workouts}
        keyExtractor={(item) => item.id}
        renderItem={renderWorkoutHistoryItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.emptyHistoryCard}>
            <View style={styles.emptyHistoryIcon}>
              <Ionicons name="barbell-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyHistoryTitle} allowFontScaling>
              No workouts logged yet
            </Text>
            <Text style={styles.emptyHistorySub} allowFontScaling>
              Start a Push, Pull, or Legs session above. Completed sets and total volume will be recorded automatically.
            </Text>
          </View>
        }
        contentContainerStyle={styles.inactiveScrollContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Edit Past Workout Modal */}
      {editingWorkout ? (
        <EditWorkoutModal
          visible={!!editingWorkout}
          workout={editingWorkout}
          onClose={() => setEditingWorkout(null)}
          onSave={(id, updates) => updateWorkout(id, updates)}
          onDelete={(w) => handleConfirmDeleteHistory(w)}
        />
      ) : null}

      {/* Per-Exercise Progression History Modal */}
      {selectedHistoryExercise ? (
        <ExerciseHistoryModal
          visible={!!selectedHistoryExercise}
          exerciseName={selectedHistoryExercise}
          historyIndex={historyIndex}
          onClose={() => setSelectedHistoryExercise(null)}
        />
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
  activeExerciseList: {
    flex: 1,
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
    minHeight: 36,
  },
  timerBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  finishWorkoutButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 40,
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
    paddingBottom: 140, // space for floating rest timer
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
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  exerciseNameRow: {
    flex: 1,
    marginRight: 8,
  },
  exerciseTitleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exerciseNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  exerciseSubtitleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  exerciseSetCountSub: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  exercisePrevPill: {
    fontSize: 10,
    color: colors.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '600',
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
    minHeight: 48,
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
    minHeight: 40,
  },
  numericInputCompleted: {
    color: colors.primary,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  setCheckCircle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteSetBtn: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteSetPlaceholder: {
    width: 32,
  },
  prBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 2,
  },
  prBadgeSmallVol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 2,
  },
  prBadgeSmallText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F59E0B',
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceSubtle,
    marginTop: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.hairline,
    minHeight: 44,
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
    paddingVertical: 12,
    gap: 6,
    marginTop: 4,
    minHeight: 44,
  },
  cancelWorkoutBtnText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
  },

  // Floating Rest Timer (Clean Capsule with Reanimated Pulse)
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
  floatingRestTimerFinished: {
    backgroundColor: '#0A2519',
    borderColor: '#10B981',
    borderWidth: 1.5,
  },
  restFinishedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  restFinishedIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restFinishedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  restFinishedSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
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
    width: 8,
    height: 8,
    borderRadius: 4,
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
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.hairline,
    minHeight: 36,
    minWidth: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restTimerAdjustText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  restTimerSkipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
    minHeight: 36,
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
    minHeight: 48,
  },
  customExerciseSubmitBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
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
  suggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    minHeight: 48,
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
    marginBottom: 16,
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
  exportBtn: {
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
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  startEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minHeight: 38,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  startEmptyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textInverse,
  },

  // Segmented Pill Tabs
  segmentedTabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 999,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 4,
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedTabActive: {
    backgroundColor: '#FF7A59',
    shadowColor: '#FF7A59',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  segmentedTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentedTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Interval Timer Dark Widget
  intervalTimerCard: {
    backgroundColor: colors.charcoalWidget,
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  timerCardLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  timerIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2A2E39',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  timerTitleCol: {
    flex: 1,
  },
  timerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  timerSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  timerDurationBig: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  timerPlayButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: '#52B788',
    backgroundColor: '#242730',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#52B788',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
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
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 12,
    minHeight: 52,
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
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
    marginBottom: 12,
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
  historyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 10,
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
}


/* -------------------------------------------------------------
 * MEMOIZED SUBCOMPONENTS FOR ISOLATED ACTIVE WORKOUT RENDERING
 * ------------------------------------------------------------- */

interface WorkoutHistoryCardProps {
  session: WorkoutSession;
  onDelete: (workout: WorkoutSession) => void;
  onEdit: (workout: WorkoutSession) => void;
}

const workoutDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const WorkoutHistoryCard = React.memo(function WorkoutHistoryCard({
  session,
  onDelete,
  onEdit,
}: WorkoutHistoryCardProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const dateStr = workoutDateFormatter.format(
    new Date(session.completedAt || session.startedAt)
  );
  const durationMin = Math.round(session.durationSeconds / 60);

  return (
    <Pressable
      style={({ pressed }) => [styles.historyCard, pressed && styles.pressed]}
      onPress={() => onEdit(session)}
      accessibilityRole="button"
      accessibilityLabel={`Workout: ${session.title}, ${dateStr}`}
    >
      <View style={styles.historyTopRow}>
        <View>
          <Text style={styles.historySessionTitle} allowFontScaling>
            {session.title}
          </Text>
          <Text style={styles.historyDateText} allowFontScaling>
            {dateStr}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => onEdit(session)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${session.title}`}
          >
            <Ionicons name="pencil-outline" size={15} color={colors.primary} />
          </Pressable>
          <Pressable
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => onDelete(session)}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${session.title}`}
          >
            <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.historyMetricsRow}>
        <View style={styles.historyMetric}>
          <Text style={styles.historyMetricVal} allowFontScaling>
            {session.totalVolumeKg.toLocaleString()} kg
          </Text>
          <Text style={styles.historyMetricLabel}>Volume</Text>
        </View>

        <View style={styles.historyMetricDivider} />

        <View style={styles.historyMetric}>
          <Text style={styles.historyMetricVal} allowFontScaling>
            {durationMin > 0 ? `${durationMin}m` : '<1m'}
          </Text>
          <Text style={styles.historyMetricLabel}>Duration</Text>
        </View>

        <View style={styles.historyMetricDivider} />

        <View style={styles.historyMetric}>
          <Text style={styles.historyMetricVal} allowFontScaling>
            {session.exercises.length}
          </Text>
          <Text style={styles.historyMetricLabel}>Exercises</Text>
        </View>
      </View>

      {/* Exercises bullet preview */}
      <View style={styles.historyExercisesWrap}>
        {session.exercises.map((ex, i) => (
          <View key={ex.id || i} style={styles.historyExercisePill}>
            <Text style={styles.historyExercisePillText} allowFontScaling>
              {ex.name} • {ex.sets.filter((s) => s.completed).length} sets
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
});

/**
 * Isolated Workout Timer Badge:
 * Runs its own 1-Hz timer so the WorkoutsScreen is NOT re-rendered every second.
 */
const WorkoutTimerBadge = React.memo(function WorkoutTimerBadge({
  startedAt,
}: {
  startedAt: string;
}) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
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
      <Text style={styles.timerBadgeText} allowFontScaling>
        {formatTime(seconds)}
      </Text>
    </View>
  );
});

/**
 * Reanimated Floating Rest Countdown Timer:
 * Survives backgrounding via wall-clock timestamps + schedules OS local notification.
 */
interface FloatingRestTimerProps {
  endsAt: number;
  totalSeconds: number;
  onDismiss: () => void;
  onAdjust: (delta: number) => void;
  onPreset: (sec: number) => void;
}

const FloatingRestTimer = React.memo(function FloatingRestTimer({
  endsAt,
  totalSeconds,
  onDismiss,
  onAdjust,
  onPreset,
}: FloatingRestTimerProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [trackedEndsAt, setTrackedEndsAt] = useState(endsAt);
  const [seconds, setSeconds] = useState(() => secondsUntil(endsAt));
  const [isFinished, setIsFinished] = useState(false);
  const onDismissRef = useRef(onDismiss);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (trackedEndsAt !== endsAt) {
    setTrackedEndsAt(endsAt);
    setSeconds(secondsUntil(endsAt));
    setIsFinished(false);
  }

  // Pulse animation using Reanimated on the native UI thread
  const pulseOpacity = useSharedValue(0.4);
  useEffect(() => {
    pulseOpacity.set(
      withRepeat(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  }, [pulseOpacity]);

  const animatedPulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.get(),
  }));

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const remainingNow = secondsUntil(endsAt);
    if (remainingNow <= 0) {
      onDismissRef.current();
      return;
    }

    scheduleRestTimerNotification(remainingNow);
    const unsubscribeSync = subscribeToForegroundRestSync((remaining) => {
      setSeconds(remaining);
      if (remaining <= 0) {
        setIsFinished(true);
        safeHaptics.timerFinished();
      }
    });

    const interval = setInterval(() => {
      const left = secondsUntil(endsAt);
      setSeconds(left);
      if (left <= 0) {
        clearInterval(interval);
        setIsFinished(true);
        safeHaptics.timerFinished();
        finishTimeoutRef.current = setTimeout(() => {
          onDismissRef.current();
        }, 2800);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      unsubscribeSync();
      if (finishTimeoutRef.current) {
        clearTimeout(finishTimeoutRef.current);
        finishTimeoutRef.current = null;
      }
    };
  }, [endsAt]);

  const handleDismissTimer = () => {
    cancelRestTimerNotification();
    onDismissRef.current();
  };

  if (isFinished) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.floatingRestTimer,
          styles.floatingRestTimerFinished,
          pressed && styles.pressed,
        ]}
        onPress={handleDismissTimer}
        accessibilityRole="button"
        accessibilityLabel="Rest complete! Tap to dismiss timer."
      >
        <View style={styles.restFinishedRow}>
          <View style={styles.restFinishedIconBox}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.restFinishedTitle} allowFontScaling>
              REST COMPLETE!
            </Text>
            <Text style={styles.restFinishedSub} allowFontScaling>
              Ready for your next set • Tap to dismiss
            </Text>
          </View>
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.floatingRestTimer}>
      <View style={styles.restTimerContentRow}>
        <View style={styles.restTimerLeft}>
          <Animated.View style={[styles.restTimerPulseDot, animatedPulseStyle]} />
          <View>
            <Text style={styles.restTimerTitle} allowFontScaling>
              REST TIMER
            </Text>
            <Text style={styles.restTimerTimeText} allowFontScaling>
              {formatTime(seconds)}
            </Text>
          </View>
        </View>

        {/* Quick Stepper +30s / -15s / Skip */}
        <View style={styles.restTimerControlsRow}>
          <Pressable
            style={({ pressed }) => [styles.restTimerAdjustBtn, pressed && styles.pressed]}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            onPress={() => {
              safeHaptics.selection();
              onAdjust(-15);
            }}
            accessibilityRole="button"
            accessibilityLabel="Subtract 15 seconds from rest timer"
          >
            <Text style={styles.restTimerAdjustText}>-15s</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.restTimerAdjustBtn, pressed && styles.pressed]}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            onPress={() => {
              safeHaptics.selection();
              onAdjust(30);
            }}
            accessibilityRole="button"
            accessibilityLabel="Add 30 seconds to rest timer"
          >
            <Text style={styles.restTimerAdjustText}>+30s</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.restTimerSkipBtn, pressed && styles.pressed]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={handleDismissTimer}
            accessibilityRole="button"
            accessibilityLabel="Skip rest timer"
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
            onPress={() => {
              safeHaptics.selection();
              onPreset(sec);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Set rest timer to ${sec} seconds`}
          >
            <Text
              style={[
                styles.restPresetBtnText,
                totalSeconds === sec && styles.restPresetBtnTextActive,
              ]}
              allowFontScaling
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
 * Keeps local string draft state so typing in numeric inputs triggers ZERO parent/screen re-renders!
 * Commits onEndEditing / onBlur.
 */
interface ActiveSetRowProps {
  exerciseId: string;
  exerciseName: string;
  set: ExerciseSet;
  canDelete: boolean;
  historyIndex: ExerciseHistoryIndex;
  onToggleComplete: (exerciseId: string, set: ExerciseSet) => void;
  onEndEditingUpdate: (exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => void;
  onDeleteSet: (exerciseId: string, setId: string) => void;
}

const ActiveSetRow = React.memo(function ActiveSetRow({
  exerciseId,
  exerciseName,
  set,
  canDelete,
  historyIndex,
  onToggleComplete,
  onEndEditingUpdate,
  onDeleteSet,
}: ActiveSetRowProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const [prevSetValues, setPrevSetValues] = useState({ weight: set.weightKg, reps: set.reps });
  const [weightText, setWeightText] = useState<string>(
    set.weightKg ? set.weightKg.toString() : ''
  );
  const [repsText, setRepsText] = useState<string>(
    set.reps ? set.reps.toString() : ''
  );

  // Synchronize state during render if set prop changes from external prefill
  if (set.weightKg !== prevSetValues.weight || set.reps !== prevSetValues.reps) {
    setPrevSetValues({ weight: set.weightKg, reps: set.reps });
    setWeightText(set.weightKg ? set.weightKg.toString() : '');
    setRepsText(set.reps ? set.reps.toString() : '');
  }

  const prInfo = useMemo(() => {
    if (!set.completed) return null;
    return personalRecordFromSnapshot(
      set.weightKg,
      set.reps,
      historyIndex.get(normalizeExerciseName(exerciseName))
    );
  }, [set.completed, set.weightKg, set.reps, exerciseName, historyIndex]);

  const commitChanges = () => {
    const w = Math.max(0, parseFloat(weightText) || 0);
    const r = Math.max(0, parseInt(repsText, 10) || 0);
    if (w !== set.weightKg || r !== set.reps) {
      onEndEditingUpdate(exerciseId, set.id, { weightKg: w, reps: r });
    }
  };

  const handleCheck = () => {
    commitChanges();
    onToggleComplete(exerciseId, set);
  };

  return (
    <View style={[styles.setRow, set.completed && styles.setRowCompleted]}>
      {/* Set Number */}
      <View style={styles.setNumberBadge}>
        <Text style={[styles.setNumberText, set.completed && styles.setNumberTextCompleted]} allowFontScaling>
          {set.setNumber}
        </Text>
      </View>

      {/* Weight Input (isolated local state) */}
      <View style={styles.setInputWrapper}>
        <TextInput
          style={[styles.numericInput, set.completed && styles.numericInputCompleted]}
          keyboardType="decimal-pad"
          selectTextOnFocus
          value={weightText}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          onChangeText={setWeightText}
          onEndEditing={commitChanges}
          accessibilityLabel={`Set ${set.setNumber} weight in kilograms`}
        />
      </View>

      {/* Reps Input (isolated local state) */}
      <View style={styles.setInputWrapper}>
        <TextInput
          style={[styles.numericInput, set.completed && styles.numericInputCompleted]}
          keyboardType="number-pad"
          selectTextOnFocus
          value={repsText}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          onChangeText={setRepsText}
          onEndEditing={commitChanges}
          accessibilityLabel={`Set ${set.setNumber} reps`}
        />
      </View>

      {/* PR Badge if achieved */}
      {prInfo?.isWeightPr ? (
        <View style={styles.prBadgeSmall}>
          <Ionicons name="trophy" size={10} color="#F59E0B" />
          <Text style={styles.prBadgeSmallText}>PR</Text>
        </View>
      ) : prInfo?.isVolumePr ? (
        <View style={styles.prBadgeSmallVol}>
          <Ionicons name="flame" size={10} color="#EF4444" />
          <Text style={styles.prBadgeSmallText}>VOL</Text>
        </View>
      ) : null}

      {/* Completed Checkbox */}
      <Pressable
        style={({ pressed }) => [styles.setCheckCircle, pressed && styles.pressed]}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        onPress={handleCheck}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: set.completed }}
        accessibilityLabel={`Mark set ${set.setNumber} as ${set.completed ? 'incomplete' : 'complete'}`}
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
          accessibilityRole="button"
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
 * Renders exercise header with progression link, previous-session values preview, column titles, and sets.
 */
interface ActiveExerciseCardProps {
  exercise: ExerciseItem;
  historyIndex: ExerciseHistoryIndex;
  onRemoveExercise: (exerciseId: string) => void;
  onAddSet: (exerciseId: string) => void;
  onToggleComplete: (exerciseId: string, set: ExerciseSet) => void;
  onEndEditingUpdate: (exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => void;
  onDeleteSet: (exerciseId: string, setId: string) => void;
  onOpenExerciseHistory: (exerciseName: string) => void;
}

const ActiveExerciseCard = React.memo(function ActiveExerciseCard({
  exercise,
  historyIndex,
  onRemoveExercise,
  onAddSet,
  onToggleComplete,
  onEndEditingUpdate,
  onDeleteSet,
  onOpenExerciseHistory,
}: ActiveExerciseCardProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);
  const completedSetsCount = exercise.sets.filter((s) => s.completed).length;

  const previousValues = useMemo(() => {
    return historyIndex.get(normalizeExerciseName(exercise.name))?.previous ?? null;
  }, [exercise.name, historyIndex]);

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseCardHeader}>
        <View style={styles.exerciseNameRow}>
          <Pressable
            style={styles.exerciseTitleBtn}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            onPress={() => onOpenExerciseHistory(exercise.name)}
            accessibilityRole="button"
            accessibilityLabel={`View progression history for ${exercise.name}`}
          >
            <Text style={styles.exerciseNameText} allowFontScaling>
              {exercise.name}
            </Text>
            <Ionicons name="stats-chart" size={14} color={colors.primary} />
          </Pressable>

          <View style={styles.exerciseSubtitleRow}>
            <Text style={styles.exerciseSetCountSub} allowFontScaling>
              {completedSetsCount}/{exercise.sets.length} sets completed
            </Text>
            {previousValues && (
              <Text style={styles.exercisePrevPill} numberOfLines={1} allowFontScaling>
                Prev: {previousValues.summaryText}
              </Text>
            )}
          </View>
        </View>

        <Pressable
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => onRemoveExercise(exercise.id)}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${exercise.name} from workout`}
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
        <View style={{ width: 32 }} />
      </View>

      {/* Set Rows */}
      {exercise.sets.map((set: ExerciseSet) => (
        <ActiveSetRow
          key={set.id}
          exerciseId={exercise.id}
          exerciseName={exercise.name}
          set={set}
          canDelete={exercise.sets.length > 1}
          historyIndex={historyIndex}
          onToggleComplete={onToggleComplete}
          onEndEditingUpdate={onEndEditingUpdate}
          onDeleteSet={onDeleteSet}
        />
      ))}

      {/* Add Set Button */}
      <Pressable
        style={({ pressed }) => [styles.addSetButton, pressed && styles.pressed]}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        onPress={() => onAddSet(exercise.id)}
        accessibilityRole="button"
        accessibilityLabel={`Add set to ${exercise.name}`}
      >
        <Ionicons name="add" size={15} color={colors.textSecondary} />
        <Text style={styles.addSetButtonText} allowFontScaling>
          Add Set
        </Text>
      </Pressable>
    </View>
  );
});
