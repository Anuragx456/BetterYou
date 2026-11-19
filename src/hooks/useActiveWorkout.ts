import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import {
  generateJsonBackup,
  generateWorkoutsCsv,
  shareOrCopyData,
} from '../services/backupService';
import {
  calculateWorkoutVolume,
  useFitnessStore,
} from '../store/useFitnessStore';
import type { ExerciseSet, WorkoutSession } from '../types';
import { safeHaptics } from '../utils/haptics';
import {
  buildExerciseHistoryIndex,
  normalizeExerciseName,
} from '../utils/workoutAnalytics';
import { formatWorkoutTime } from './useRestTimer';

export function useActiveWorkout(
  triggerRestTimer: (sec?: number) => void,
  handleDismissRestTimer: () => void,
  preferredRestSeconds: React.MutableRefObject<number>
) {
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

  const [isAddExerciseModalVisible, setIsAddExerciseModalVisible] =
    useState<boolean>(false);
  const [selectedHistoryExercise, setSelectedHistoryExercise] = useState<string | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSession | null>(null);
  const [workoutTab, setWorkoutTab] = useState<'practise' | 'timer' | 'checkin'>('practise');

  const historyIndex = useMemo(() => buildExerciseHistoryIndex(workouts), [workouts]);

  const handleEndEditingUpdate = useCallback(
    (exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => {
      updateSetInActiveExercise(exerciseId, setId, updates);
    },
    [updateSetInActiveExercise]
  );

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
    [updateSetInActiveExercise, triggerRestTimer, preferredRestSeconds]
  );

  const handleAddSet = useCallback(
    (exerciseId: string) => {
      safeHaptics.selection();
      const currentWorkout = useFitnessStore.getState().activeWorkout;
      const ex = currentWorkout?.exercises.find((e) => e.id === exerciseId);
      addSetToActiveExercise(exerciseId);

      if (ex) {
        const prev = historyIndex.get(normalizeExerciseName(ex.name))?.previous;
        const nextSetIdx = ex.sets.length;
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
    const durationFormatted = formatWorkoutTime(finalElapsedSeconds);

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

  const handleConfirmCancelWorkout = useCallback(() => {
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
  }, [cancelActiveWorkout, handleDismissRestTimer]);

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

  const liveActiveVolume = useMemo(() => {
    if (!activeWorkout) return 0;
    return calculateWorkoutVolume(activeWorkout.exercises);
  }, [activeWorkout]);

  return {
    activeWorkout,
    workouts,
    startWorkout,
    updateWorkout,
    historyIndex,
    isAddExerciseModalVisible,
    setIsAddExerciseModalVisible,
    selectedHistoryExercise,
    setSelectedHistoryExercise,
    editingWorkout,
    setEditingWorkout,
    workoutTab,
    setWorkoutTab,
    liveActiveVolume,
    handleEndEditingUpdate,
    handleToggleSetComplete,
    handleAddSet,
    handleRemoveSet,
    handleRemoveExercise,
    handleConfirmFinishWorkout,
    handleConfirmCancelWorkout,
    handleSelectAddExercise,
    handleConfirmDeleteHistory,
    handleExportWorkouts,
  };
}
