import React, { useMemo } from 'react';
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

  // Live BMI calculation for responsive physical feedback
  const bmiInfo = useMemo(() => {
    const h = parseFloat(heightStr);
    const w = parseFloat(weightStr);
    if (!h || !w || h < 100 || h > 250 || w < 30 || w > 250) {
      return null;
    }
    const heightM = h / 100;
    const bmi = w / (heightM * heightM);
    const bmiVal = Math.round(bmi * 10) / 10;

    let category = 'Healthy range';
    let color = colors.success;

    if (bmiVal < 18.5) {
      category = 'Underweight';
      color = colors.warning;
    } else if (bmiVal < 25) {
      category = 'Healthy range';
      color = colors.success;
    } else if (bmiVal < 30) {
      category = 'Overweight';
      color = colors.warning;
    } else {
      category = 'Elevated';
      color = colors.danger;
    }

    return { value: bmiVal, category, color };
  }, [heightStr, weightStr, colors.success, colors.warning, colors.danger]);

  return (
    <View style={styles.stepWrapper}>
      {/* Category Tag */}
      <View style={styles.badgeRow}>
        <View style={styles.badgeIconWrapper}>
          <Ionicons name="person" size={13} color={colors.primary} />
        </View>
        <Text style={styles.badgeText}>PHYSIOLOGICAL PROFILE</Text>
      </View>

      <Text style={styles.stepTitle}>Tell Us About Yourself</Text>
      <Text style={styles.stepDesc}>
        BetterYou computes your precise Basal Metabolic Rate (BMR) using the clinically validated Mifflin-St Jeor formula.
      </Text>

      {/* Sex Selector */}
      <View style={styles.sectionHeader}>
        <Text style={styles.inputLabel}>Biological Sex</Text>
        <Text style={styles.sectionHint}>Used for hormonal & metabolic formula</Text>
      </View>

      <View style={styles.sexRow}>
        <Pressable
          style={[styles.sexCard, sex === 'male' && styles.sexCardSelected]}
          onPress={() => {
            safeHaptics.selection();
            setSex('male');
          }}
          accessibilityRole="button"
          accessibilityLabel="Male"
          testID="onboarding-sex-male"
        >
          <View style={[styles.sexIconCircle, sex === 'male' && styles.sexIconCircleSelected]}>
            <Ionicons
              name="man"
              size={24}
              color={sex === 'male' ? colors.primary : colors.textMuted}
            />
          </View>
          <View style={styles.sexInfo}>
            <Text style={[styles.sexCardText, sex === 'male' && styles.sexCardTextSelected]}>
              Male
            </Text>
            <Text style={styles.sexCardSub}>+5 kcal formula factor</Text>
          </View>
          <View style={[styles.radioCircle, sex === 'male' && styles.radioCircleSelected]}>
            {sex === 'male' && <View style={styles.radioDot} />}
          </View>
        </Pressable>

        <Pressable
          style={[styles.sexCard, sex === 'female' && styles.sexCardSelected]}
          onPress={() => {
            safeHaptics.selection();
            setSex('female');
          }}
          accessibilityRole="button"
          accessibilityLabel="Female"
          testID="onboarding-sex-female"
        >
          <View style={[styles.sexIconCircle, sex === 'female' && styles.sexIconCircleSelected]}>
            <Ionicons
              name="woman"
              size={24}
              color={sex === 'female' ? colors.primary : colors.textMuted}
            />
          </View>
          <View style={styles.sexInfo}>
            <Text style={[styles.sexCardText, sex === 'female' && styles.sexCardTextSelected]}>
              Female
            </Text>
            <Text style={styles.sexCardSub}>-161 kcal formula factor</Text>
          </View>
          <View style={[styles.radioCircle, sex === 'female' && styles.radioCircleSelected]}>
            {sex === 'female' && <View style={styles.radioDot} />}
          </View>
        </Pressable>
      </View>

      {/* Biometric Metric Cards */}
      <View style={styles.metricsGroup}>
        {/* Age */}
        <View style={styles.metricCard}>
          <View style={styles.metricLeft}>
            <View style={styles.metricIconBox}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.metricLabel}>Age</Text>
              <Text style={styles.metricHint}>Chronological years</Text>
            </View>
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.metricInput}
              keyboardType="numeric"
              value={ageStr}
              onChangeText={setAgeStr}
              placeholder="25"
              placeholderTextColor={colors.textMuted}
              maxLength={3}
              testID="onboarding-input-age"
            />
            <Text style={styles.metricUnit}>yrs</Text>
          </View>
        </View>

        {/* Height */}
        <View style={styles.metricCard}>
          <View style={styles.metricLeft}>
            <View style={styles.metricIconBox}>
              <Ionicons name="resize-outline" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.metricLabel}>Height</Text>
              <Text style={styles.metricHint}>Standing height</Text>
            </View>
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.metricInput}
              keyboardType="numeric"
              value={heightStr}
              onChangeText={setHeightStr}
              placeholder="175"
              placeholderTextColor={colors.textMuted}
              maxLength={3}
              testID="onboarding-input-height"
            />
            <Text style={styles.metricUnit}>cm</Text>
          </View>
        </View>

        {/* Weight */}
        <View style={styles.metricCard}>
          <View style={styles.metricLeft}>
            <View style={styles.metricIconBox}>
              <Ionicons name="scale-outline" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.metricLabel}>Current Weight</Text>
              <Text style={styles.metricHint}>Morning fasted weight</Text>
            </View>
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.metricInput}
              keyboardType="decimal-pad"
              value={weightStr}
              onChangeText={setWeightStr}
              placeholder="70"
              placeholderTextColor={colors.textMuted}
              maxLength={5}
              testID="onboarding-input-weight"
            />
            <Text style={styles.metricUnit}>kg</Text>
          </View>
        </View>
      </View>

      {/* Live BMI indicator */}
      {bmiInfo && (
        <View style={styles.bmiCard}>
          <View style={styles.bmiHeader}>
            <View style={styles.bmiTag}>
              <Text style={styles.bmiTagText}>BODY MASS INDEX</Text>
            </View>
            <Text style={[styles.bmiCategory, { color: bmiInfo.color }]}>
              {bmiInfo.category}
            </Text>
          </View>
          <View style={styles.bmiValueRow}>
            <Text style={styles.bmiNumber}>{bmiInfo.value}</Text>
            <Text style={styles.bmiScale}>kg/m² (normal range 18.5 – 24.9)</Text>
          </View>
        </View>
      )}

      {/* Continue CTA */}
      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel="Continue to energy and goals"
        testID="onboarding-step1-next"
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
      paddingBottom: 28,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
    },
    badgeIconWrapper: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.9,
      color: colors.primary,
    },
    stepTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.4,
      marginBottom: 8,
    },
    stepDesc: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      marginBottom: 22,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 10,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    sectionHint: {
      fontSize: 11,
      color: colors.textMuted,
    },
    sexRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    sexCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      gap: 10,
    },
    sexCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceSubtle,
    },
    sexIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sexIconCircleSelected: {
      backgroundColor: colors.primaryMuted,
    },
    sexInfo: {
      flex: 1,
    },
    sexCardText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    sexCardTextSelected: {
      color: colors.primary,
    },
    sexCardSub: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 2,
    },
    radioCircle: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioCircleSelected: {
      borderColor: colors.primary,
    },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    metricsGroup: {
      gap: 10,
      marginBottom: 16,
    },
    metricCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    metricLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    metricIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metricLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    metricHint: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 1,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      minWidth: 88,
      justifyContent: 'flex-end',
    },
    metricInput: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'right',
      paddingVertical: 2,
      minWidth: 42,
    },
    metricUnit: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginLeft: 4,
    },
    bmiCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      padding: 12,
      marginBottom: 20,
    },
    bmiHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    bmiTag: {
      backgroundColor: colors.surfaceSubtle,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    bmiTagText: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.textMuted,
      letterSpacing: 0.5,
    },
    bmiCategory: {
      fontSize: 12,
      fontWeight: '700',
    },
    bmiValueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
    },
    bmiNumber: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
    },
    bmiScale: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      gap: 8,
      marginTop: 8,
    },
    btnPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.99 }],
    },
    primaryBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
}
