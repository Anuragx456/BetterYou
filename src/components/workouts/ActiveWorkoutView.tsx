import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExerciseHistoryModal } from '../ExerciseHistoryModal';
import { useThemeColors } from '../../theme/theme';
import type { ExerciseItem, ExerciseSet, WorkoutSession } from '../../types';
import type { ExerciseHistoryIndex } from '../../utils/workoutAnalytics';
import type { RestSession } from '../../hooks/useRestTimer';
import { ActiveExerciseCard } from './ActiveExerciseCard';
import { AddExerciseSheet } from './AddExerciseSheet';
import { FloatingRestTimer } from './FloatingRestTimer';
import { WorkoutTimerBadge } from './WorkoutTimerBadge';

export interface ActiveWorkoutViewProps {
  activeWorkout: WorkoutSession;
  liveActiveVolume: number;
  historyIndex: ExerciseHistoryIndex;
  restSession: RestSession | null;
  isAddExerciseModalVisible: boolean;
  selectedHistoryExercise: string | null;
  onConfirmFinishWorkout: () => void;
  onConfirmCancelWorkout: () => void;
  onRemoveExercise: (exerciseId: string) => void;
  onAddSet: (exerciseId: string) => void;
  onToggleSetComplete: (exerciseId: string, set: ExerciseSet) => void;
  onEndEditingUpdate: (exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => void;
  onDeleteSet: (exerciseId: string, setId: string) => void;
  onOpenExerciseHistory: (exerciseName: string) => void;
  onCloseExerciseHistory: () => void;
  onOpenAddExerciseModal: () => void;
  onCloseAddExerciseModal: () => void;
  onSelectAddExercise: (name: string) => void;
  onDismissRestTimer: () => void;
  onAdjustRestTimer: (delta: number) => void;
  onPresetRestTimer: (sec: number) => void;
}

export const ActiveWorkoutView = React.memo(function ActiveWorkoutView({
  activeWorkout,
  liveActiveVolume,
  historyIndex,
  restSession,
  isAddExerciseModalVisible,
  selectedHistoryExercise,
  onConfirmFinishWorkout,
  onConfirmCancelWorkout,
  onRemoveExercise,
  onAddSet,
  onToggleSetComplete,
  onEndEditingUpdate,
  onDeleteSet,
  onOpenExerciseHistory,
  onCloseExerciseHistory,
  onOpenAddExerciseModal,
  onCloseAddExerciseModal,
  onSelectAddExercise,
  onDismissRestTimer,
  onAdjustRestTimer,
  onPresetRestTimer,
}: ActiveWorkoutViewProps) {
  const colors = useThemeColors();

  const completedSetsCount = activeWorkout.exercises.reduce(
    (sum, e) => sum + e.sets.filter((s) => s.completed).length,
    0
  );

  const renderActiveExercise = useCallback(
    ({ item }: { item: ExerciseItem }) => (
      <ActiveExerciseCard
        exercise={item}
        historyIndex={historyIndex}
        onRemoveExercise={onRemoveExercise}
        onAddSet={onAddSet}
        onToggleComplete={onToggleSetComplete}
        onEndEditingUpdate={onEndEditingUpdate}
        onDeleteSet={onDeleteSet}
        onOpenExerciseHistory={onOpenExerciseHistory}
      />
    ),
    [
      historyIndex,
      onRemoveExercise,
      onAddSet,
      onToggleSetComplete,
      onEndEditingUpdate,
      onDeleteSet,
      onOpenExerciseHistory,
    ]
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Top Active Bar */}
      <View
        style={[
          styles.activeHeader,
          { borderBottomColor: colors.cardBorder },
        ]}
      >
        <View style={styles.activeWorkoutTitleCol}>
          <View style={styles.liveIndicatorRow}>
            <View
              style={[
                styles.livePulseDot,
                { backgroundColor: colors.primary },
              ]}
            />
            <Text
              style={[styles.activeWorkoutTitle, { color: colors.text }]}
              numberOfLines={1}
              allowFontScaling
            >
              {activeWorkout.title}
            </Text>
          </View>
        </View>

        <View style={styles.activeHeaderRight}>
          <WorkoutTimerBadge startedAt={activeWorkout.startedAt} />

          <Pressable
            testID="workout-finish-btn"
            style={({ pressed }) => [
              styles.finishWorkoutButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={onConfirmFinishWorkout}
            accessibilityRole="button"
            accessibilityLabel="Finish and save active workout"
          >
            <Text
              style={[
                styles.finishWorkoutButtonText,
                { color: colors.textInverse },
              ]}
              allowFontScaling
            >
              Finish
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Live Volume & Stats Ribbon */}
      <View
        style={[
          styles.statsRibbon,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.cardBorder,
          },
        ]}
      >
        <View style={styles.ribbonItem}>
          <Text
            style={[styles.ribbonValue, { color: colors.text }]}
            allowFontScaling
          >
            {liveActiveVolume.toLocaleString()}
          </Text>
          <Text
            style={[styles.ribbonLabel, { color: colors.textMuted }]}
            allowFontScaling
          >
            Volume (kg)
          </Text>
        </View>
        <View
          style={[styles.ribbonDivider, { backgroundColor: colors.hairline }]}
        />
        <View style={styles.ribbonItem}>
          <Text
            style={[styles.ribbonValue, { color: colors.text }]}
            allowFontScaling
          >
            {activeWorkout.exercises.length}
          </Text>
          <Text
            style={[styles.ribbonLabel, { color: colors.textMuted }]}
            allowFontScaling
          >
            Exercises
          </Text>
        </View>
        <View
          style={[styles.ribbonDivider, { backgroundColor: colors.hairline }]}
        />
        <View style={styles.ribbonItem}>
          <Text
            style={[styles.ribbonValue, { color: colors.text }]}
            allowFontScaling
          >
            {completedSetsCount}
          </Text>
          <Text
            style={[styles.ribbonLabel, { color: colors.textMuted }]}
            allowFontScaling
          >
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
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                },
                pressed && styles.pressed,
              ]}
              onPress={onOpenAddExerciseModal}
              accessibilityRole="button"
              accessibilityLabel="Add an exercise to this session"
            >
              <Ionicons name="add" size={18} color={colors.text} />
              <Text
                style={[styles.addExerciseMainBtnText, { color: colors.text }]}
                allowFontScaling
              >
                Add Exercise
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.cancelWorkoutBtn,
                pressed && styles.pressed,
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={onConfirmCancelWorkout}
              accessibilityRole="button"
              accessibilityLabel="Discard active workout"
            >
              <Ionicons name="close-circle-outline" size={15} color={colors.danger} />
              <Text
                style={[styles.cancelWorkoutBtnText, { color: colors.danger }]}
                allowFontScaling
              >
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
          onDismiss={onDismissRestTimer}
          onAdjust={onAdjustRestTimer}
          onPreset={onPresetRestTimer}
        />
      ) : null}

      <AddExerciseSheet
        visible={isAddExerciseModalVisible}
        onClose={onCloseAddExerciseModal}
        onSelect={onSelectAddExercise}
      />

      {/* Per-Exercise Progression History Modal */}
      {selectedHistoryExercise ? (
        <ExerciseHistoryModal
          visible={!!selectedHistoryExercise}
          exerciseName={selectedHistoryExercise}
          historyIndex={historyIndex}
          onClose={onCloseExerciseHistory}
        />
      ) : null}
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
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
  },
  activeWorkoutTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  activeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  finishWorkoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 40,
  },
  finishWorkoutButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statsRibbon: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  ribbonItem: {
    alignItems: 'center',
  },
  ribbonValue: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  ribbonLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
  ribbonDivider: {
    width: 1,
    height: 18,
  },
  activeExerciseList: {
    flex: 1,
  },
  exerciseScrollList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 140,
    gap: 14,
  },
  addExerciseMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    minHeight: 48,
    gap: 6,
  },
  addExerciseMainBtnText: {
    fontSize: 14,
    fontWeight: '600',
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
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
