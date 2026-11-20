import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UserSex } from '../../utils/nutritionTargets';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors } from '../../theme/theme';
import { safeHaptics } from '../../utils/haptics';

interface StepBasicsProps {
  sex: UserSex;
  setSex: (sex: UserSex) => void;
  ageStr: string;
  setAgeStr: (age: string) => void;
  heightStr: string;
  setHeightStr: (height: string) => void;
  weightStr: string;
  setWeightStr: (weight: string) => void;
  onNext: () => void;
}

export const StepBasics: React.FC<StepBasicsProps> = ({
  sex,
  setSex,
  ageStr,
  setAgeStr,
  heightStr,
  setHeightStr,
  weightStr,
  setWeightStr,
  onNext,
}) => {
  const colors = useThemeColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.stepWrapper}>
      <View style={styles.badgeRow}>
        <Ionicons name="person" size={14} color={colors.primary} />
        <Text style={styles.badgeText}>PHYSIOLOGICAL PROFILE</Text>
      </View>
      <Text style={styles.stepTitle}>Tell Us About Yourself</Text>
      <Text style={styles.stepDesc}>
        BetterYou calculates your precise Basal Metabolic Rate (BMR) using the clinically validated Mifflin-St Jeor formula.
      </Text>

      {/* Sex Selector */}
      <Text style={styles.inputLabel}>Biological Sex</Text>
      <View style={styles.sexRow}>
        <Pressable
          style={[styles.sexCard, sex === 'male' && styles.sexCardSelected]}
          onPress={() => {
            safeHaptics.selection();
            setSex('male');
          }}
          accessibilityRole="button"
          accessibilityLabel="Male"
        >
          <Ionicons
            name="man"
            size={28}
            color={sex === 'male' ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.sexCardText, sex === 'male' && styles.sexCardTextSelected]}>
            Male
          </Text>
        </Pressable>

        <Pressable
          style={[styles.sexCard, sex === 'female' && styles.sexCardSelected]}
          onPress={() => {
            safeHaptics.selection();
            setSex('female');
          }}
          accessibilityRole="button"
          accessibilityLabel="Female"
        >
          <Ionicons
            name="woman"
            size={28}
            color={sex === 'female' ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.sexCardText, sex === 'female' && styles.sexCardTextSelected]}>
            Female
          </Text>
        </Pressable>
      </View>

      {/* Age */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Age (years)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={ageStr}
          onChangeText={setAgeStr}
          placeholder="25"
          placeholderTextColor={colors.textMuted}
          maxLength={3}
        />
      </View>

      {/* Height */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Height (cm)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={heightStr}
          onChangeText={setHeightStr}
          placeholder="175"
          placeholderTextColor={colors.textMuted}
          maxLength={3}
        />
      </View>

      {/* Weight */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Current Weight (kg)</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={weightStr}
          onChangeText={setWeightStr}
          placeholder="70"
          placeholderTextColor={colors.textMuted}
          maxLength={5}
        />
      </View>

      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel="Continue"
      >
        <Text style={styles.primaryBtnText}>Continue</Text>
        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    stepWrapper: {
      paddingBottom: 24,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      color: colors.primary,
    },
    stepTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
    },
    stepDesc: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    sexRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    sexCard: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      gap: 8,
    },
    sexCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceSubtle,
    },
    sexCardText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textMuted,
    },
    sexCardTextSelected: {
      color: colors.primary,
      fontWeight: '700',
    },
    inputGroup: {
      marginBottom: 16,
    },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      gap: 8,
      marginTop: 12,
    },
    btnPressed: {
      opacity: 0.88,
    },
    primaryBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
}
