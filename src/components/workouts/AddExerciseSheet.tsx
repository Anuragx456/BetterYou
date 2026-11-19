import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useThemeColors } from '../../theme/theme';

export const POPULAR_EXERCISES = [
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

interface ExerciseSuggestionRowProps {
  name: string;
  onSelect: (name: string) => void;
}

const ExerciseSuggestionRow = React.memo(function ExerciseSuggestionRow({
  name,
  onSelect,
}: ExerciseSuggestionRowProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      style={[styles.suggestionRow, { borderBottomColor: colors.hairline }]}
      onPress={() => onSelect(name)}
      accessibilityRole="button"
      accessibilityLabel={`Add ${name}`}
    >
      <Text style={[styles.suggestionText, { color: colors.text }]} allowFontScaling>
        {name}
      </Text>
      <Ionicons name="add" size={18} color={colors.textSecondary} />
    </Pressable>
  );
});

export interface AddExerciseSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string) => void;
}

export function AddExerciseSheet({
  visible,
  onClose,
  onSelect,
}: AddExerciseSheetProps) {
  const colors = useThemeColors();
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (!visible) setCustomExerciseName('');
  }

  const renderSuggestion = useCallback(
    ({ item }: { item: string }) => (
      <ExerciseSuggestionRow name={item} onSelect={onSelect} />
    ),
    [onSelect]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text
              style={[styles.modalTitle, { color: colors.text }]}
              allowFontScaling
            >
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
              style={[
                styles.customExerciseInput,
                {
                  backgroundColor: colors.surfaceSubtle,
                  color: colors.text,
                  borderColor: colors.hairline,
                },
              ]}
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
                { backgroundColor: colors.primary },
                !customExerciseName.trim() && { opacity: 0.5 },
              ]}
              disabled={!customExerciseName.trim()}
              onPress={() => onSelect(customExerciseName)}
              accessibilityRole="button"
              accessibilityLabel="Add custom exercise"
            >
              <Text
                style={[
                  styles.customExerciseSubmitText,
                  { color: colors.textInverse },
                ]}
              >
                Add
              </Text>
            </Pressable>
          </View>

          <Text
            style={[styles.modalSuggestionsHeader, { color: colors.textMuted }]}
            allowFontScaling
          >
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

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
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
  },
  customExerciseRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  customExerciseInput: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 48,
  },
  customExerciseSubmitBtn: {
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  customExerciseSubmitText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalSuggestionsHeader: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  suggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    minHeight: 48,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
