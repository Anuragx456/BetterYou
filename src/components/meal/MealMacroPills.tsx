import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../theme/theme';

export interface MealMacroPillsProps {
  scaledCalories: number;
  scaledProtein: number;
  scaledCarbs: number;
  scaledFat: number;
}

export const MealMacroPills = React.memo(function MealMacroPills({
  scaledCalories,
  scaledProtein,
  scaledCarbs,
  scaledFat,
}: MealMacroPillsProps) {
  const colors = useThemeColors();

  return (
    <>
      {/* Calorie Hero Metric */}
      <View style={styles.calorieHeroContainer}>
        <Text style={[styles.calorieHeroNumber, { color: colors.text }]}>
          {scaledCalories}{' '}
          <Text style={[styles.calorieHeroUnit, { color: colors.textSecondary }]}>
            kcal
          </Text>
        </Text>
      </View>

      {/* Minimal 3 Macro Pills */}
      <View style={styles.macroPillsRow}>
        <View
          style={[
            styles.macroPillClean,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Ionicons name="barbell-outline" size={14} color={colors.protein} />
          <View style={styles.macroPillTextCol}>
            <Text style={[styles.macroPillValue, { color: colors.text }]}>
              {scaledProtein}g
            </Text>
            <Text style={[styles.macroPillLabel, { color: colors.textSecondary }]}>
              Protein
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.macroPillClean,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Ionicons name="nutrition-outline" size={14} color={colors.carbs} />
          <View style={styles.macroPillTextCol}>
            <Text style={[styles.macroPillValue, { color: colors.text }]}>
              {scaledCarbs}g
            </Text>
            <Text style={[styles.macroPillLabel, { color: colors.textSecondary }]}>
              Carbs
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.macroPillClean,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          <Ionicons name="water-outline" size={14} color={colors.fat} />
          <View style={styles.macroPillTextCol}>
            <Text style={[styles.macroPillValue, { color: colors.text }]}>
              {scaledFat}g
            </Text>
            <Text style={[styles.macroPillLabel, { color: colors.textSecondary }]}>
              Fat
            </Text>
          </View>
        </View>
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  calorieHeroContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  calorieHeroNumber: {
    fontSize: 44,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  calorieHeroUnit: {
    fontSize: 18,
    fontWeight: '500',
  },
  macroPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  macroPillClean: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  macroPillTextCol: {
    alignItems: 'flex-start',
  },
  macroPillValue: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  macroPillLabel: {
    fontSize: 10,
  },
});
