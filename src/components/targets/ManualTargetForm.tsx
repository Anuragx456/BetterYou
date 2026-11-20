import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import { CALORIE_PRESETS } from './types';

interface ManualTargetFormProps {
  calorieInput: string;
  setCalorieInput: (val: string) => void;
  proteinInput: string;
  setProteinInput: (val: string) => void;
  carbsInput: string;
  setCarbsInput: (val: string) => void;
  fatInput: string;
  setFatInput: (val: string) => void;
  onSelectPreset: (preset: number) => void;
  onSave: () => void;
  onClearFeedback?: () => void;
  feedback: string | null;
}

export function ManualTargetForm({
  calorieInput,
  setCalorieInput,
  proteinInput,
  setProteinInput,
  carbsInput,
  setCarbsInput,
  fatInput,
  setFatInput,
  onSelectPreset,
  onSave,
  onClearFeedback,
  feedback,
}: ManualTargetFormProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <>
      {/* SECTION: MANUAL CALORIE ADJUSTMENT */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>MANUAL CALORIE TARGET</Text>
        <View style={styles.cardGroup}>
          <View style={styles.inputRow}>
            <View style={styles.inputMeta}>
              <Text style={styles.inputTitle}>Daily Calorie Target</Text>
              <Text style={styles.inputSub}>Between 500 and 10,000 kcal</Text>
            </View>
            <View style={styles.numberInputBox}>
              <TextInput
                style={styles.numberInput}
                value={calorieInput}
                onChangeText={(t) => {
                  setCalorieInput(t.replace(/[^0-9]/g, ''));
                  onClearFeedback?.();
                }}
                keyboardType="numeric"
                maxLength={5}
                placeholder="2200"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.calories}
              />
              <Text style={styles.unitText}>kcal</Text>
            </View>
          </View>

          {/* Quick Presets */}
          <Text style={styles.presetsLabel}>BENCHMARK PRESETS</Text>
          <View style={styles.presetsRow}>
            {CALORIE_PRESETS.map((preset) => {
              const isSelected = parseInt(calorieInput, 10) === preset;
              return (
                <Pressable
                  key={preset}
                  style={({ pressed }) => [
                    styles.presetChip,
                    isSelected && styles.presetChipActive,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => onSelectPreset(preset)}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      isSelected && styles.presetChipTextActive,
                    ]}
                  >
                    {preset}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* SECTION: MACRONUTRIENT TARGETS */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>MANUAL MACRONUTRIENT TARGETS</Text>
        <View style={styles.cardGroup}>
          <View style={styles.macroRow}>
            {/* Protein */}
            <View style={styles.macroCol}>
              <Text style={[styles.macroLabel, { color: colors.protein }]}>PROTEIN (G)</Text>
              <TextInput
                style={styles.macroInput}
                value={proteinInput}
                onChangeText={(t) => setProteinInput(t.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="160"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.protein}
              />
            </View>

            {/* Carbs */}
            <View style={styles.macroCol}>
              <Text style={[styles.macroLabel, { color: colors.carbs }]}>CARBS (G)</Text>
              <TextInput
                style={styles.macroInput}
                value={carbsInput}
                onChangeText={(t) => setCarbsInput(t.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="220"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.carbs}
              />
            </View>

            {/* Fat */}
            <View style={styles.macroCol}>
              <Text style={[styles.macroLabel, { color: colors.fat }]}>FAT (G)</Text>
              <TextInput
                style={styles.macroInput}
                value={fatInput}
                onChangeText={(t) => setFatInput(t.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="65"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.fat}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Save Action Button */}
      <Pressable
        style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
        onPress={onSave}
      >
        <Ionicons name="checkmark-circle-outline" size={18} color={colors.textInverse} />
        <Text style={styles.saveBtnText}>Save Nutrition Targets</Text>
      </Pressable>

      {feedback ? (
        <View style={styles.feedbackBanner}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      ) : null}
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      color: colors.textMuted,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    cardGroup: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 16,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    inputMeta: {
      flex: 1,
      marginRight: 12,
    },
    inputTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    inputSub: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    numberInputBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardHover,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 6,
    },
    numberInput: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      minWidth: 44,
      textAlign: 'right',
      padding: 0,
    },
    unitText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    presetsLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      color: colors.textMuted,
      marginTop: 14,
      marginBottom: 8,
    },
    presetsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    presetChip: {
      backgroundColor: colors.cardHover,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    presetChipActive: {
      backgroundColor: colors.caloriesMuted,
      borderColor: colors.calories,
    },
    presetChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    presetChipTextActive: {
      color: colors.calories,
      fontWeight: '700',
    },
    macroRow: {
      flexDirection: 'row',
      gap: 12,
    },
    macroCol: {
      flex: 1,
      backgroundColor: colors.cardHover,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 12,
      alignItems: 'center',
    },
    macroLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    macroInput: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      padding: 0,
      minWidth: 40,
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      marginBottom: 16,
    },
    saveBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textInverse,
    },
    feedbackBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.softGreen,
      borderWidth: 1,
      borderColor: colors.softGreenBorder,
      borderRadius: 12,
      padding: 12,
    },
    feedbackText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.softGreenText,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
