import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ExerciseItem, ExerciseSet } from '../../types';
import { useThemeColors } from '../../theme/theme';
import {
  normalizeExerciseName,
  type ExerciseHistoryIndex,
} from '../../utils/workoutAnalytics';
import { ActiveSetRow } from './ActiveSetRow';

export interface ActiveExerciseCardProps {
  exercise: ExerciseItem;
  historyIndex: ExerciseHistoryIndex;
  onRemoveExercise: (exerciseId: string) => void;
  onAddSet: (exerciseId: string) => void;
  onToggleComplete: (exerciseId: string, set: ExerciseSet) => void;
  onEndEditingUpdate: (exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => void;
  onDeleteSet: (exerciseId: string, setId: string) => void;
  onOpenExerciseHistory: (exerciseName: string) => void;
}

export const ActiveExerciseCard = React.memo(function ActiveExerciseCard({
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
  const completedSetsCount = exercise.sets.filter((s) => s.completed).length;

  const previousValues = useMemo(() => {
    return historyIndex.get(normalizeExerciseName(exercise.name))?.previous ?? null;
  }, [exercise.name, historyIndex]);

  return (
    <View
      style={[
        styles.exerciseCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
        },
      ]}
    >
      <View style={styles.exerciseCardHeader}>
        <View style={styles.exerciseNameRow}>
          <Pressable
            style={styles.exerciseTitleBtn}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            onPress={() => onOpenExerciseHistory(exercise.name)}
            accessibilityRole="button"
            accessibilityLabel={`View progression history for ${exercise.name}`}
          >
            <Text
              style={[styles.exerciseNameText, { color: colors.text }]}
              allowFontScaling
            >
              {exercise.name}
            </Text>
            <Ionicons name="stats-chart" size={14} color={colors.primary} />
          </Pressable>

          <View style={styles.exerciseSubtitleRow}>
            <Text
              style={[styles.exerciseSetCountSub, { color: colors.textMuted }]}
              allowFontScaling
            >
              {completedSetsCount}/{exercise.sets.length} sets completed
            </Text>
            {previousValues && (
              <Text
                style={[
                  styles.exercisePrevPill,
                  {
                    color: colors.primary,
                    backgroundColor: colors.primaryMuted,
                  },
                ]}
                numberOfLines={1}
                allowFontScaling
              >
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
        <Text style={[styles.colHeader, { color: colors.textMuted, width: 34 }]}>
          SET
        </Text>
        <Text style={[styles.colHeader, { color: colors.textMuted, flex: 1 }]}>
          WEIGHT (KG)
        </Text>
        <Text style={[styles.colHeader, { color: colors.textMuted, flex: 1 }]}>
          REPS
        </Text>
        <Text style={[styles.colHeader, { color: colors.textMuted, width: 44, textAlign: 'center' }]}>
          DONE
        </Text>
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
        style={({ pressed }) => [
          styles.addSetButton,
          {
            backgroundColor: colors.surfaceSubtle,
            borderColor: colors.hairline,
          },
          pressed && styles.pressed,
        ]}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        onPress={() => onAddSet(exercise.id)}
        accessibilityRole="button"
        accessibilityLabel={`Add set to ${exercise.name}`}
      >
        <Ionicons name="add" size={15} color={colors.textSecondary} />
        <Text
          style={[styles.addSetButtonText, { color: colors.textSecondary }]}
          allowFontScaling
        >
          Add Set
        </Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  exerciseCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
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
    fontWeight: '500',
  },
  exercisePrevPill: {
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
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
    letterSpacing: 0.5,
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
    gap: 4,
    borderWidth: 1,
    minHeight: 44,
  },
  addSetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
});
