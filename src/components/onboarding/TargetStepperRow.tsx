import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors } from '../../theme/theme';
import { safeHaptics } from '../../utils/haptics';

interface TargetStepperRowProps {
  title: string;
  desc: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  value: number;
  unit: string;
  step: number;
  min: number;
  onValueChange: (val: number) => void;
  testIdMinus?: string;
  testIdPlus?: string;
  testIdInput?: string;
}

export const TargetStepperRow: React.FC<TargetStepperRowProps> = ({
  title,
  desc,
  iconName,
  iconColor,
  iconBg,
  value,
  unit,
  step,
  min,
  onValueChange,
  testIdMinus,
  testIdPlus,
  testIdInput,
}) => {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.adjustCard}>
      <View style={styles.adjustLeft}>
        <View style={[styles.macroIconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={iconName} size={18} color={iconColor} />
        </View>
        <View style={styles.adjustTextWrapper}>
          <Text style={styles.adjustTitle}>{title}</Text>
          <Text style={styles.adjustDesc}>{desc}</Text>
        </View>
      </View>

      <View style={styles.stepperControl}>
        <Pressable
          style={styles.stepperBtn}
          onPress={() => {
            safeHaptics.selection();
            onValueChange(Math.max(min, value - step));
          }}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${title.toLowerCase()}`}
          testID={testIdMinus}
        >
          <Ionicons name="remove" size={16} color={colors.text} />
        </Pressable>

        <View style={styles.stepperValueBox}>
          <TextInput
            style={styles.stepperInput}
            keyboardType="numeric"
            value={String(value)}
            onChangeText={(txt) => {
              onValueChange(parseInt(txt, 10) || 0);
            }}
            testID={testIdInput}
          />
          <Text style={styles.stepperUnit}>{unit}</Text>
        </View>

        <Pressable
          style={styles.stepperBtn}
          onPress={() => {
            safeHaptics.selection();
            onValueChange(value + step);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${title.toLowerCase()}`}
          testID={testIdPlus}
        >
          <Ionicons name="add" size={16} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    adjustCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 14,
      padding: 12,
    },
    adjustLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    macroIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    adjustTextWrapper: {
      flex: 1,
    },
    adjustTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    adjustDesc: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1,
    },
    stepperControl: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 10,
      overflow: 'hidden',
    },
    stepperBtn: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepperValueBox: {
      flexDirection: 'row',
      alignItems: 'baseline',
      minWidth: 54,
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    stepperInput: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      paddingVertical: 2,
    },
    stepperUnit: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textSecondary,
      marginLeft: 2,
    },
  });
}
