import { describe, expect, it } from 'bun:test';
import { BodyMeasurement, MealLog } from '../../types';
import {
  aggregate28DayCalories,
  calculateWeightAveragesAndDeltas,
} from '../nutritionAnalytics';

describe('Nutrition & Weight Analytics (nutritionAnalytics.ts)', () => {
  describe('28-Day Calorie Aggregation (aggregate28DayCalories)', () => {
    it('generates continuous 28 daily buckets ending in today', () => {
      const today = '2026-05-28';
      const sampleMeals: MealLog[] = [
        {
          id: 'm1',
          dishName: 'Eggs & Toast',
          calories: 500,
          protein: 30,
          carbs: 45,
          fat: 20,
          estimatedWeightGrams: 250,
          portionMultiplier: 1.0,
          ingredientsDetected: ['Eggs', 'Bread'],
          timestamp: '2026-05-28T08:00:00Z',
          date: '2026-05-28',
        },
        {
          id: 'm2',
          dishName: 'Chicken Rice',
          calories: 750,
          protein: 55,
          carbs: 80,
          fat: 18,
          estimatedWeightGrams: 400,
          portionMultiplier: 1.0,
          ingredientsDetected: ['Chicken', 'Rice'],
          timestamp: '2026-05-28T13:00:00Z',
          date: '2026-05-28',
        },
        {
          id: 'm3',
          dishName: 'Protein Shake',
          calories: 300,
          protein: 40,
          carbs: 10,
          fat: 5,
          estimatedWeightGrams: 300,
          portionMultiplier: 1.0,
          ingredientsDetected: ['Whey'],
          timestamp: '2026-05-27T16:00:00Z',
          date: '2026-05-27',
        },
      ];

      const target = 2200;
      const result = aggregate28DayCalories(sampleMeals, target, today);

      expect(result.days.length).toBe(28);
      expect(result.targetCalories).toBe(2200);

      // Last item should be today (2026-05-28)
      const lastDay = result.days[27];
      expect(lastDay.date).toBe('2026-05-28');
      expect(lastDay.totalCalories).toBe(1250); // 500 + 750
      expect(lastDay.deltaCalories).toBe(1250 - 2200); // -950
      expect(lastDay.hasData).toBe(true);

      // Yesterday (2026-05-27)
      const yesterday = result.days[26];
      expect(yesterday.date).toBe('2026-05-27');
      expect(yesterday.totalCalories).toBe(300);
      expect(yesterday.hasData).toBe(true);

      // Days with no logs
      const day26Ago = result.days[0];
      expect(day26Ago.totalCalories).toBe(0);
      expect(day26Ago.hasData).toBe(false);

      expect(result.daysLogged).toBe(2);
      expect(result.averageCalories).toBe(Math.round((1250 + 300) / 2)); // 775
    });

    it('handles empty meals list gracefully', () => {
      const result = aggregate28DayCalories([], 2000, '2026-05-28');
      expect(result.days.length).toBe(28);
      expect(result.daysLogged).toBe(0);
      expect(result.averageCalories).toBe(0);
    });
  });

  describe('Weight Averages & Deltas (calculateWeightAveragesAndDeltas)', () => {
    it('returns null fields for empty measurements', () => {
      const result = calculateWeightAveragesAndDeltas([]);
      expect(result.currentWeight).toBeNull();
      expect(result.sevenDayAverage).toBeNull();
      expect(result.deltaVsSevenDaysAgo).toBeNull();
      expect(result.deltaVsThirtyDaysAgo).toBeNull();
      expect(result.weightTrend).toBe('neutral');
    });

    it('calculates 7-day average and accurate 7-day and 30-day weight deltas', () => {
      const today = '2026-05-30';
      const measurements: BodyMeasurement[] = [
        // 30 days ago (2026-04-30): 75.0 kg
        { id: 'bm_0', date: '2026-04-30', weightKg: 75.0, createdAt: 1 },

        // Week 2 ago (days 7-13 ago): average ~ 74.0 kg
        { id: 'bm_1', date: '2026-05-18', weightKg: 74.2, createdAt: 2 },
        { id: 'bm_2', date: '2026-05-20', weightKg: 73.8, createdAt: 3 },

        // Recent 7 days (days 0-6 ago): average ~ 73.0 kg
        { id: 'bm_3', date: '2026-05-26', weightKg: 73.2, createdAt: 4 },
        { id: 'bm_4', date: '2026-05-28', weightKg: 73.0, createdAt: 5 },
        { id: 'bm_5', date: '2026-05-30', weightKg: 72.8, createdAt: 6 },
      ];

      const result = calculateWeightAveragesAndDeltas(measurements, today);

      expect(result.currentWeight).toBe(72.8);
      expect(result.currentWeightDate).toBe('2026-05-30');

      // 7-day average: (73.2 + 73.0 + 72.8) / 3 = 73.0 kg
      expect(result.sevenDayAverage).toBe(73.0);

      // Prior week average: (74.2 + 73.8) / 2 = 74.0 kg
      // Delta vs 7 days ago: 73.0 - 74.0 = -1.0 kg
      expect(result.deltaVsSevenDaysAgo).toBe(-1.0);

      // Delta vs 30 days ago: 72.8 - 75.0 = -2.2 kg
      expect(result.deltaVsThirtyDaysAgo).toBe(-2.2);

      // Weight trend should be 'losing'
      expect(result.weightTrend).toBe('losing');
    });

    it('detects gaining and maintaining trends accurately', () => {
      const today = '2026-05-30';

      // Gaining
      const gainingMeasurements: BodyMeasurement[] = [
        { id: 'bm_1', date: '2026-05-20', weightKg: 80.0, createdAt: 1 },
        { id: 'bm_2', date: '2026-05-30', weightKg: 81.2, createdAt: 2 },
      ];
      const gainResult = calculateWeightAveragesAndDeltas(gainingMeasurements, today);
      expect(gainResult.weightTrend).toBe('gaining');

      // Maintaining
      const maintainingMeasurements: BodyMeasurement[] = [
        { id: 'bm_3', date: '2026-05-20', weightKg: 75.0, createdAt: 1 },
        { id: 'bm_4', date: '2026-05-30', weightKg: 75.1, createdAt: 2 },
      ];
      const maintResult = calculateWeightAveragesAndDeltas(maintainingMeasurements, today);
      expect(maintResult.weightTrend).toBe('maintaining');
    });
  });
});
