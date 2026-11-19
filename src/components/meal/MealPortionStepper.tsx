import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../theme/theme';
import { safeHaptics } from '../../utils/haptics';

const PORTION_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export interface MealPortionStepperProps {
  portionMultiplier: number;
  onAdjustPortion: (delta: number) => void;
  onSetPortion: (multiplier: number) => void;
}

export const MealPortionStepper = React.memo(function MealPortionStepper({
  portionMultiplier,
  onAdjustPortion,
  onSetPortion,
}: MealPortionStepperProps) {
  const colors = useThemeColors();

  return (
    <View
      style={[
        styles.portionCleanCard,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
      ]}
    >
      <View style={styles.portionStepperRow}>
        <Pressable
          style={({ pressed }) => [
            styles.portionStepBtn,
            { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder },
            pressed && styles.pressed,
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => onAdjustPortion(-0.1)}
        >
          <Ionicons name="remove" size={18} color={colors.text} />
        </Pressable>

        <View style={styles.portionDisplayCol}>
          <Text style={[styles.portionValueClean, { color: colors.text }]}>
            {portionMultiplier.toFixed(1)}x
          </Text>
          <Text style={[styles.portionLabelClean, { color: colors.textSecondary }]}>
            Portion
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.portionStepBtn,
            { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder },
            pressed && styles.pressed,
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => onAdjustPortion(0.1)}
        >
          <Ionicons name="add" size={18} color={colors.text} />
        </Pressable>
      </View>

      {/* Quick Preset Row */}
      <View style={styles.presetCleanRow}>
        {PORTION_PRESETS.map((preset) => {
          const isSelected = portionMultiplier === preset;
          return (
            <Pressable
              key={preset}
              style={({ pressed }) => [
                styles.presetCleanBtn,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder },
                isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                pressed && styles.pressed,
              ]}
              onPress={() => {
                safeHaptics.selection();
                onSetPortion(preset);
              }}
            >
              <Text
                style={[
                  styles.presetCleanBtnText,
                  { color: colors.textSecondary },
                  isSelected && { color: colors.textInverse, fontWeight: '700' },
                ]}
              >
                {preset}x
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  portionCleanCard: {
    borderRadius: 20,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
  },
  portionStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 14,
  },
  portionStepBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portionDisplayCol: {
    alignItems: 'center',
    minWidth: 70,
  },
  portionValueClean: {
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  portionLabelClean: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  presetCleanRow: {
    flexDirection: 'row',
    gap: 6,
  },
  presetCleanBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  presetCleanBtnSelected: {},
  presetCleanBtnText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  presetCleanBtnTextSelected: {},
  pressed: {
    opacity: 0.8,
  },
});
