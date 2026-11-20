import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ThemeColors } from '../../theme/colors';
import { useThemeColors, useThemedStyles } from '../../theme/theme';
import {
  ACTIVITY_OPTIONS,
  GOAL_OPTIONS,
  type ActivityLevel,
  type FitnessGoal,
  type SuggestedNutrition,
} from './types';

interface SmartCalibratorCardProps {
  weightInput: string;
  setWeightInput: (val: string) => void;
  goalChoice: FitnessGoal;
  setGoalChoice: (val: FitnessGoal) => void;
  activityChoice: ActivityLevel;
  setActivityChoice: (val: ActivityLevel) => void;
  suggestedNutrition: SuggestedNutrition;
  onApplySuggestion: () => void;
}

export function SmartCalibratorCard({
  weightInput,
  setWeightInput,
  goalChoice,
  setGoalChoice,
  activityChoice,
  setActivityChoice,
  suggestedNutrition,
  onApplySuggestion,
}: SmartCalibratorCardProps) {
  const colors = useThemeColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Ionicons name="sparkles" size={14} color={colors.secondary} />
        <Text style={styles.sectionHeader}>SMART NUTRITION CALIBRATOR</Text>
      </View>
      <View style={styles.cardGroup}>
        {/* Weight Input Row */}
        <View style={styles.inputRow}>
          <View style={styles.inputMeta}>
            <Text style={styles.inputTitle}>Current Body Weight</Text>
            <Text style={styles.inputSub}>Used to compute baseline metabolic rate</Text>
          </View>
          <View style={styles.numberInputBox}>
            <TextInput
              style={styles.numberInput}
              value={weightInput}
              onChangeText={(t) => setWeightInput(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              maxLength={5}
              placeholder="72"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.secondary}
            />
            <Text style={styles.unitText}>kg</Text>
          </View>
        </View>

        {/* Goal Selector */}
        <Text style={styles.subLabel}>PRIMARY GOAL</Text>
        <View style={styles.optionsGrid}>
          {GOAL_OPTIONS.map((opt) => {
            const isSelected = goalChoice === opt.key;
            return (
              <Pressable
                key={opt.key}
                style={({ pressed }) => [
                  styles.optionCard,
                  isSelected && styles.optionCardActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => setGoalChoice(opt.key)}
              >
                <View style={styles.optionHeader}>
                  <Ionicons
                    name={opt.icon}
                    size={16}
                    color={isSelected ? colors.secondary : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.optionTitle,
                      isSelected && styles.optionTitleActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.optionBadge,
                    isSelected && styles.optionBadgeActive,
                  ]}
                >
                  {opt.badge}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Activity Level Selector */}
        <Text style={styles.subLabel}>DAILY ACTIVITY LEVEL</Text>
        <View style={styles.activityList}>
          {ACTIVITY_OPTIONS.map((opt) => {
            const isSelected = activityChoice === opt.key;
            return (
              <Pressable
                key={opt.key}
                style={({ pressed }) => [
                  styles.activityRow,
                  isSelected && styles.activityRowActive,
                  pressed && styles.pressed,
                ]}
                onPress={() => setActivityChoice(opt.key)}
              >
                <View
                  style={[
                    styles.activityIconBox,
                    isSelected && styles.activityIconBoxActive,
                  ]}
                >
                  <Ionicons
                    name={opt.icon}
                    size={16}
                    color={isSelected ? colors.calories : colors.textMuted}
                  />
                </View>
                <View style={styles.activityTextCol}>
                  <Text
                    style={[
                      styles.activityTitle,
                      isSelected && styles.activityTitleActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Text style={styles.activityFrequency}>{opt.frequency}</Text>
                </View>
                <View
                  style={[
                    styles.radioCircle,
                    isSelected && styles.radioCircleActive,
                  ]}
                >
                  {isSelected && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Dynamic Recommendation Box */}
        <View style={styles.recommendationBox}>
          <View style={styles.recommendationTopRow}>
            <Text style={styles.recLabel}>RECOMMENDED DAILY TARGET</Text>
            <Text style={styles.recCals}>
              {suggestedNutrition.calories.toLocaleString()}{' '}
              <Text style={styles.recUnit}>kcal</Text>
            </Text>
          </View>

          {/* Macro Pills */}
          <View style={styles.recMacroPills}>
            <View style={[styles.macroPill, { borderColor: colors.softBlueBorder }]}>
              <Text style={[styles.macroPillVal, { color: colors.protein }]}>
                {suggestedNutrition.protein}g
              </Text>
              <Text style={styles.macroPillTag}>Protein</Text>
            </View>
            <View style={[styles.macroPill, { borderColor: colors.softGreenBorder }]}>
              <Text style={[styles.macroPillVal, { color: colors.carbs }]}>
                {suggestedNutrition.carbs}g
              </Text>
              <Text style={styles.macroPillTag}>Carbs</Text>
            </View>
            <View style={[styles.macroPill, { borderColor: colors.cardBorder }]}>
              <Text style={[styles.macroPillVal, { color: colors.fat }]}>
                {suggestedNutrition.fat}g
              </Text>
              <Text style={styles.macroPillTag}>Fat</Text>
            </View>
          </View>

          <Text style={styles.recExplanation}>
            {suggestedNutrition.explanation}
          </Text>

          {/* Apply Button */}
          <Pressable
            style={({ pressed }) => [styles.applyBtn, pressed && styles.pressed]}
            onPress={onApplySuggestion}
          >
            <Ionicons name="sparkles" size={16} color={colors.textInverse} />
            <Text style={styles.applyBtnText}>Apply Suggested Targets</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: {
      marginBottom: 24,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    sectionHeader: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      color: colors.textMuted,
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
    subLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      color: colors.textMuted,
      marginTop: 16,
      marginBottom: 8,
    },
    optionsGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    optionCard: {
      flex: 1,
      backgroundColor: colors.cardHover,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      padding: 10,
      alignItems: 'center',
      gap: 4,
    },
    optionCardActive: {
      borderColor: colors.secondary,
      backgroundColor: colors.secondaryMuted,
    },
    pressed: {
      opacity: 0.7,
    },
    optionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    optionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    optionTitleActive: {
      color: colors.secondary,
    },
    optionBadge: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.textMuted,
    },
    optionBadgeActive: {
      color: colors.secondary,
      fontWeight: '700',
    },
    activityList: {
      gap: 8,
    },
    activityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardHover,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      padding: 12,
      gap: 12,
    },
    activityRowActive: {
      borderColor: colors.calories,
      backgroundColor: colors.caloriesMuted,
    },
    activityIconBox: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityIconBoxActive: {
      backgroundColor: colors.card,
    },
    activityTextCol: {
      flex: 1,
    },
    activityTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    activityTitleActive: {
      color: colors.calories,
    },
    activityFrequency: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    radioCircle: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: colors.cardBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioCircleActive: {
      borderColor: colors.calories,
    },
    radioDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.calories,
    },
    recommendationBox: {
      backgroundColor: colors.cardHover,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 14,
      marginTop: 16,
    },
    recommendationTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    recLabel: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
      color: colors.textMuted,
    },
    recCals: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    recUnit: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.calories,
    },
    recMacroPills: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    macroPill: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      paddingVertical: 8,
      alignItems: 'center',
    },
    macroPillVal: {
      fontSize: 14,
      fontWeight: '800',
    },
    macroPillTag: {
      fontSize: 9,
      fontWeight: '600',
      color: colors.textMuted,
      marginTop: 2,
    },
    recExplanation: {
      fontSize: 11,
      color: colors.textSecondary,
      lineHeight: 16,
      marginBottom: 12,
    },
    applyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.secondary,
      borderRadius: 12,
      paddingVertical: 12,
    },
    applyBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textInverse,
    },
  });
}
