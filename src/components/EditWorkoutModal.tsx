import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { WorkoutSession } from '../types';

interface EditWorkoutModalProps {
  visible: boolean;
  workout: WorkoutSession | null;
  onClose: () => void;
  onSave: (workoutId: string, updates: Partial<WorkoutSession>) => void;
  onDelete: (workout: WorkoutSession) => void;
}

export function EditWorkoutModal({
  visible,
  workout,
  onClose,
  onSave,
  onDelete,
}: EditWorkoutModalProps) {
  const [title, setTitle] = useState<string>(workout?.title || '');
  const [notes, setNotes] = useState<string>(workout?.notes || '');
  const [durationMin, setDurationMin] = useState<string>(
    workout ? Math.round(workout.durationSeconds / 60).toString() : '45'
  );

  if (!workout) return null;

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Title Required', 'Please enter a workout title.');
      return;
    }
    const mins = Math.max(1, parseInt(durationMin, 10) || 1);
    onSave(workout.id, {
      title: trimmedTitle,
      notes: notes.trim(),
      durationSeconds: mins * 60,
    });
    onClose();
  };

  const handleDelete = () => {
    onDelete(workout);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel edit workout"
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.headerTitleCol}>
            <Text style={styles.headerTitle}>Edit Workout</Text>
            <Text style={styles.headerSub}>Session Details</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={handleSave}
            accessibilityRole="button"
            accessibilityLabel="Save workout updates"
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Workout Title Field */}
          <View style={styles.fieldSection}>
            <Text style={styles.inputLabel}>WORKOUT TITLE</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Heavy Push Day, Back & Biceps..."
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
              accessibilityLabel="Workout Title"
            />
          </View>

          {/* Duration in Minutes */}
          <View style={styles.fieldSection}>
            <Text style={styles.inputLabel}>DURATION (MINUTES)</Text>
            <TextInput
              style={styles.textInput}
              value={durationMin}
              onChangeText={setDurationMin}
              keyboardType="number-pad"
              placeholder="45"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
              accessibilityLabel="Duration in minutes"
            />
          </View>

          {/* Session Notes */}
          <View style={styles.fieldSection}>
            <Text style={styles.inputLabel}>NOTES & OBSERVATIONS</Text>
            <TextInput
              style={styles.textArea}
              value={notes}
              onChangeText={setNotes}
              placeholder="How did the session feel? Any PRs or energy changes?"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              selectionColor={colors.primary}
              accessibilityLabel="Session notes"
            />
          </View>

          {/* Delete Workout Action */}
          <View style={styles.deleteSection}>
            <Pressable
              style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete this workout record"
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={styles.deleteBtnText}>Delete Workout Record</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  headerTitleCol: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  headerSub: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    minHeight: 44,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textInverse,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 18,
  },
  fieldSection: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: 48,
  },
  textArea: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: 100,
  },
  deleteSection: {
    marginTop: 24,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    minHeight: 48,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
  },
  pressed: {
    opacity: 0.7,
  },
});
