import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EditWorkoutModal } from '../../components/EditWorkoutModal';
import { ExerciseHistoryModal } from '../../components/ExerciseHistoryModal';
import { ActiveWorkoutView } from '../../components/workouts/ActiveWorkoutView';
import { RoutineTemplates } from '../../components/workouts/RoutineTemplates';
import { WorkoutHistoryCard } from '../../components/workouts/WorkoutHistoryCard';
import { useActiveWorkout } from '../../hooks/useActiveWorkout';
import { useRestTimer } from '../../hooks/useRestTimer';
import { useFitnessStore } from '../../store/useFitnessStore';
import { useThemeColors } from '../../theme/theme';
import type { WorkoutSession } from '../../types';

export default function WorkoutsScreen() {
  const colors = useThemeColors();

  useEffect(() => {
    useFitnessStore.getState().loadWorkoutHistory().catch(() => {});
  }, []);

  const {
    restSession,
    preferredRestSeconds,
    triggerRestTimer,
    handleAdjustRestTimer,
    handlePresetRestTimer,
    handleDismissRestTimer,
  } = useRestTimer();

  const {
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
  } = useActiveWorkout(triggerRestTimer, handleDismissRestTimer, preferredRestSeconds);

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

  // Active Workout View
  if (activeWorkout) {
    return (
      <ActiveWorkoutView
        activeWorkout={activeWorkout}
        liveActiveVolume={liveActiveVolume}
        historyIndex={historyIndex}
        restSession={restSession}
        isAddExerciseModalVisible={isAddExerciseModalVisible}
        selectedHistoryExercise={selectedHistoryExercise}
        onConfirmFinishWorkout={handleConfirmFinishWorkout}
        onConfirmCancelWorkout={handleConfirmCancelWorkout}
        onRemoveExercise={handleRemoveExercise}
        onAddSet={handleAddSet}
        onToggleSetComplete={handleToggleSetComplete}
        onEndEditingUpdate={handleEndEditingUpdate}
        onDeleteSet={handleRemoveSet}
        onOpenExerciseHistory={setSelectedHistoryExercise}
        onCloseExerciseHistory={() => setSelectedHistoryExercise(null)}
        onOpenAddExerciseModal={() => setIsAddExerciseModalVisible(true)}
        onCloseAddExerciseModal={() => setIsAddExerciseModalVisible(false)}
        onSelectAddExercise={handleSelectAddExercise}
        onDismissRestTimer={handleDismissRestTimer}
        onAdjustRestTimer={handleAdjustRestTimer}
        onPresetRestTimer={handlePresetRestTimer}
      />
    );
  }

  // Inactive Workout View (History + Templates)
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <FlashList
        data={workouts}
        keyExtractor={(item) => item.id}
        renderItem={renderWorkoutHistoryItem}
        ListHeaderComponent={
          <RoutineTemplates
            workoutCount={workouts.length}
            workoutTab={workoutTab}
            restSession={restSession}
            onSetWorkoutTab={setWorkoutTab}
            onStartCustomWorkout={() => startWorkout('Custom Workout')}
            onStartTemplate={(tpl) => startWorkout(tpl)}
            onExportWorkouts={handleExportWorkouts}
            onToggleRestTimer={() => {
              if (restSession) {
                handleDismissRestTimer();
              } else {
                triggerRestTimer(120);
              }
            }}
          />
        }
        ListEmptyComponent={
          <View
            style={[
              styles.emptyHistoryCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            <View
              style={[
                styles.emptyHistoryIcon,
                { backgroundColor: colors.surfaceSubtle },
              ]}
            >
              <Ionicons name="barbell-outline" size={28} color={colors.textMuted} />
            </View>
            <Text
              style={[styles.emptyHistoryTitle, { color: colors.text }]}
              allowFontScaling
            >
              No workouts logged yet
            </Text>
            <Text
              style={[styles.emptyHistorySub, { color: colors.textMuted }]}
              allowFontScaling
            >
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  inactiveScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  emptyHistoryCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyHistoryIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyHistoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyHistorySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
