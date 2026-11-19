import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ExerciseSet } from '../../types';
import { useThemeColors } from '../../theme/theme';
import {
  normalizeExerciseName,
  personalRecordFromSnapshot,
  type ExerciseHistoryIndex,
} from '../../utils/workoutAnalytics';

export interface ActiveSetRowProps {
  exerciseId: string;
  exerciseName: string;
  set: ExerciseSet;
  canDelete: boolean;
  historyIndex: ExerciseHistoryIndex;
  onToggleComplete: (exerciseId: string, set: ExerciseSet) => void;
  onEndEditingUpdate: (exerciseId: string, setId: string, updates: Partial<ExerciseSet>) => void;
  onDeleteSet: (exerciseId: string, setId: string) => void;
}

export const ActiveSetRow = React.memo(function ActiveSetRow({
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
    <View
      style={[
        styles.setRow,
        {
          backgroundColor: colors.surfaceSubtle,
          borderColor: colors.hairline,
        },
        set.completed && {
          borderColor: colors.primary,
          backgroundColor: colors.primaryMuted,
        },
      ]}
    >
      {/* Set Number */}
      <View style={styles.setNumberBadge}>
        <Text
          style={[
            styles.setNumberText,
            { color: colors.textSecondary },
            set.completed && { color: colors.primary },
          ]}
          allowFontScaling
        >
          {set.setNumber}
        </Text>
      </View>

      {/* Weight Input */}
      <View style={styles.setInputWrapper}>
        <TextInput
          style={[
            styles.numericInput,
            {
              backgroundColor: colors.card,
              color: colors.text,
              borderColor: colors.hairline,
            },
            set.completed && {
              color: colors.primary,
              borderColor: colors.primary,
            },
          ]}
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

      {/* Reps Input */}
      <View style={styles.setInputWrapper}>
        <TextInput
          style={[
            styles.numericInput,
            {
              backgroundColor: colors.card,
              color: colors.text,
              borderColor: colors.hairline,
            },
            set.completed && {
              color: colors.primary,
              borderColor: colors.primary,
            },
          ]}
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
        <View
          style={[
            styles.prBadgeSmall,
            {
              backgroundColor: colors.softOrange,
              borderColor: colors.softOrangeBorder,
            },
          ]}
        >
          <Ionicons name="trophy" size={10} color="#F59E0B" />
          <Text style={[styles.prBadgeSmallText, { color: colors.softOrangeText }]}>
            PR
          </Text>
        </View>
      ) : prInfo?.isVolumePr ? (
        <View
          style={[
            styles.prBadgeSmallVol,
            {
              backgroundColor: colors.fatMuted,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <Ionicons name="flame" size={10} color="#EF4444" />
          <Text style={[styles.prBadgeSmallText, { color: colors.softOrangeText }]}>
            VOL
          </Text>
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

const styles = StyleSheet.create({
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    minHeight: 48,
  },
  setNumberBadge: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumberText: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  setInputWrapper: {
    flex: 1,
  },
  numericInput: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 1,
    fontVariant: ['tabular-nums'],
    minHeight: 42,
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
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 2,
  },
  prBadgeSmallVol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 2,
  },
  prBadgeSmallText: {
    fontSize: 9,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.75,
  },
});
