import { describe, expect, it } from 'bun:test';
import {
  calculateStreakDays,
  formatWeeklySummaryShareText,
  generateWeeklySummary,
} from '../weeklySummaryService';
import {
  DailyGoals,
  MealLog,
  ScannedProduct,
  WorkoutSession,
} from '../../types';

describe('Weekly Summary Service (weeklySummaryService.ts)', () => {
  const dummyGoals: DailyGoals = {
    calorieTarget: 2200,
    proteinTargetGrams: 160,
    carbsTargetGrams: 220,
    fatTargetGrams: 60,
  };

  it('handles empty weeks gracefully with zero values and negative target delta', () => {
    const summary = generateWeeklySummary([], [], [], dummyGoals, '2026-11-15');

    expect(summary.weekEnd).toBe('2026-11-15');
    expect(summary.weekStart).toBe('2026-11-09');
    expect(summary.totalVolumeKg).toBe(0);
    expect(summary.workoutCount).toBe(0);
    expect(summary.avgDailyCalories).toBe(0);
    expect(summary.calorieTargetDelta).toBe(-2200);
    expect(summary.prsThisWeek).toBe(0);
    expect(summary.streakDays).toBe(0);
    expect(summary.productsScreened).toBe(0);
  });

  it('accurately aggregates workouts, calories, and scanned products within the 7-day window', () => {
    const targetDate = '2026-11-15'; // Window: 2026-11-09 to 2026-11-15

    const workouts: WorkoutSession[] = [
      {
        id: 'w1',
        title: 'Push Day',
        startedAt: '2026-11-10T10:00:00.000Z',
        completedAt: '2026-11-10T11:00:00.000Z',
        durationSeconds: 3600,
        totalVolumeKg: 2000,
        exercises: [
          {
            id: 'e1',
            name: 'Bench Press',
            sets: [
              { id: 's1', setNumber: 1, weightKg: 80, reps: 10, completed: true },
              { id: 's2', setNumber: 2, weightKg: 80, reps: 10, completed: true },
            ],
          },
        ],
      },
      {
        id: 'w2',
        title: 'Pull Day',
        startedAt: '2026-11-12T10:00:00.000Z',
        completedAt: '2026-11-12T11:00:00.000Z',
        durationSeconds: 3600,
        totalVolumeKg: 1500,
        exercises: [
          {
            id: 'e2',
            name: 'Deadlift',
            sets: [
              { id: 's3', setNumber: 1, weightKg: 120, reps: 5, completed: true },
            ],
          },
        ],
      },
      // Workout outside window (prior)
      {
        id: 'w_old',
        title: 'Old Session',
        startedAt: '2026-11-01T10:00:00.000Z',
        completedAt: '2026-11-01T11:00:00.000Z',
        durationSeconds: 3600,
        totalVolumeKg: 5000,
        exercises: [],
      },
    ];

    const meals: MealLog[] = [
      {
        id: 'm1',
        dishName: 'Chicken Rice',
        timestamp: '2026-11-10T13:00:00.000Z',
        calories: 700,
        protein: 50,
        carbs: 80,
        fat: 15,
        estimatedWeightGrams: 400,
        portionMultiplier: 1,
        ingredientsDetected: ['Chicken', 'Rice'],
      },
      {
        id: 'm2',
        dishName: 'Paneer Curry',
        timestamp: '2026-11-12T19:00:00.000Z',
        calories: 700,
        protein: 30,
        carbs: 40,
        fat: 35,
        estimatedWeightGrams: 350,
        portionMultiplier: 1,
        ingredientsDetected: ['Paneer'],
      },
      // Meal outside window
      {
        id: 'm_old',
        dishName: 'Old Meal',
        timestamp: '2026-11-05T13:00:00.000Z',
        calories: 1200,
        protein: 40,
        carbs: 100,
        fat: 20,
        estimatedWeightGrams: 500,
        portionMultiplier: 1,
        ingredientsDetected: [],
      },
    ];

    const products: ScannedProduct[] = [
      {
        id: 'p1',
        productName: 'Biscuits',
        scannedAt: '2026-11-11T15:00:00.000Z',
        report: { overallSafetyScore: 75, riskLevel: 'Safe', harmfulIngredients: [], cleanSummary: 'Clean' },
      },
      {
        id: 'p_old',
        productName: 'Shampoo',
        scannedAt: '2026-11-02T15:00:00.000Z',
        report: { overallSafetyScore: 50, riskLevel: 'Moderate', harmfulIngredients: [], cleanSummary: 'Mod' },
      },
    ];

    const summary = generateWeeklySummary(workouts, meals, products, dummyGoals, targetDate);

    expect(summary.workoutCount).toBe(2);
    // w1 volume: 80*10 + 80*10 = 1600. w2 volume: 120*5 = 600. Total = 2200.
    expect(summary.totalVolumeKg).toBe(2200);
    // Calories: 700 + 700 = 1400 / 7 = 200
    expect(summary.avgDailyCalories).toBe(200);
    expect(summary.calorieTargetDelta).toBe(200 - 2200); // -2000
    expect(summary.productsScreened).toBe(1);
  });

  it('correctly handles leap year week across February 29', () => {
    // 2024 is a leap year. Feb 25 to Mar 2 spans Feb 29.
    const targetDate = '2024-03-02';
    const leapDayMeal: MealLog = {
      id: 'm_leap',
      dishName: 'Leap Day Feast',
      timestamp: '2024-02-29T12:00:00.000Z',
      calories: 2100,
      protein: 100,
      carbs: 200,
      fat: 50,
      estimatedWeightGrams: 600,
      portionMultiplier: 1,
      ingredientsDetected: [],
    };

    const summary = generateWeeklySummary([], [leapDayMeal], [], dummyGoals, targetDate);

    expect(summary.weekStart).toBe('2024-02-25');
    expect(summary.weekEnd).toBe('2024-03-02');
    expect(summary.avgDailyCalories).toBe(300); // 2100 / 7 = 300
  });

  it('detects PRs across time when current week weight exceeds prior sessions', () => {
    const priorWorkouts: WorkoutSession[] = [
      {
        id: 'w_prior',
        title: 'Past Bench Session',
        startedAt: '2026-10-15T10:00:00.000Z',
        completedAt: '2026-10-15T11:00:00.000Z',
        durationSeconds: 3600,
        totalVolumeKg: 1000,
        exercises: [
          {
            id: 'e1',
            name: 'Bench Press',
            sets: [
              { id: 's1', setNumber: 1, weightKg: 100, reps: 5, completed: true },
            ],
          },
          {
            id: 'e2',
            name: 'Overhead Press',
            sets: [
              { id: 's2', setNumber: 1, weightKg: 60, reps: 5, completed: true },
            ],
          },
        ],
      },
    ];

    const currentWeekWorkouts: WorkoutSession[] = [
      {
        id: 'w_this_week',
        title: 'New PR Push Session',
        startedAt: '2026-11-12T10:00:00.000Z',
        completedAt: '2026-11-12T11:00:00.000Z',
        durationSeconds: 3600,
        totalVolumeKg: 1500,
        exercises: [
          // Exceeds prior 100kg -> PR!
          {
            id: 'e1_new',
            name: 'bench press',
            sets: [
              { id: 's3', setNumber: 1, weightKg: 105, reps: 3, completed: true },
            ],
          },
          // 55kg does NOT exceed prior 60kg -> NOT a PR
          {
            id: 'e2_new',
            name: 'overhead press',
            sets: [
              { id: 's4', setNumber: 1, weightKg: 55, reps: 5, completed: true },
            ],
          },
          // New exercise without prior recorded sessions -> Baseline, not an existing PR broken
          {
            id: 'e3_new',
            name: 'Incline Dumbbell Press',
            sets: [
              { id: 's5', setNumber: 1, weightKg: 30, reps: 10, completed: true },
            ],
          },
        ],
      },
    ];

    const allWorkouts = [...priorWorkouts, ...currentWeekWorkouts];
    const summary = generateWeeklySummary(allWorkouts, [], [], dummyGoals, '2026-11-15');

    expect(summary.prsThisWeek).toBe(1);
    expect(summary.prDetails).toBeDefined();
    expect(summary.prDetails?.[0].exerciseName.toLowerCase()).toBe('bench press');
    expect(summary.prDetails?.[0].weightKg).toBe(105);
    expect(summary.prDetails?.[0].previousMaxKg).toBe(100);
  });

  describe('Streak Calculation (calculateStreakDays)', () => {
    it('calculates consecutive active days ending today', () => {
      const targetDate = '2026-11-15';
      const meals: MealLog[] = [
        {
          id: 'm1',
          dishName: 'Meal 1',
          timestamp: '2026-11-15T12:00:00.000Z',
          calories: 500,
          protein: 30,
          carbs: 40,
          fat: 10,
          estimatedWeightGrams: 300,
          portionMultiplier: 1,
          ingredientsDetected: [],
        },
        {
          id: 'm2',
          dishName: 'Meal 2',
          timestamp: '2026-11-14T12:00:00.000Z',
          calories: 500,
          protein: 30,
          carbs: 40,
          fat: 10,
          estimatedWeightGrams: 300,
          portionMultiplier: 1,
          ingredientsDetected: [],
        },
      ];
      const workouts: WorkoutSession[] = [
        {
          id: 'w1',
          title: 'Workout',
          startedAt: '2026-11-13T10:00:00.000Z',
          completedAt: '2026-11-13T11:00:00.000Z',
          durationSeconds: 3600,
          totalVolumeKg: 1000,
          exercises: [],
        },
      ];

      // 15th, 14th, 13th = 3 consecutive days
      const streak = calculateStreakDays(workouts, meals, targetDate);
      expect(streak).toBe(3);
    });

    it('maintains streak from yesterday if user has not yet logged today', () => {
      const targetDate = '2026-11-15';
      const meals: MealLog[] = [
        {
          id: 'm1',
          dishName: 'Yesterday Meal',
          timestamp: '2026-11-14T12:00:00.000Z',
          calories: 500,
          protein: 30,
          carbs: 40,
          fat: 10,
          estimatedWeightGrams: 300,
          portionMultiplier: 1,
          ingredientsDetected: [],
        },
        {
          id: 'm2',
          dishName: '2 Days Ago Meal',
          timestamp: '2026-11-13T12:00:00.000Z',
          calories: 500,
          protein: 30,
          carbs: 40,
          fat: 10,
          estimatedWeightGrams: 300,
          portionMultiplier: 1,
          ingredientsDetected: [],
        },
      ];

      const streak = calculateStreakDays([], meals, targetDate);
      expect(streak).toBe(2);
    });

    it('returns 0 streak when there is a multi-day gap', () => {
      const targetDate = '2026-11-15';
      const meals: MealLog[] = [
        {
          id: 'm1',
          dishName: 'Old Meal',
          timestamp: '2026-11-10T12:00:00.000Z', // 5 days ago
          calories: 500,
          protein: 30,
          carbs: 40,
          fat: 10,
          estimatedWeightGrams: 300,
          portionMultiplier: 1,
          ingredientsDetected: [],
        },
      ];

      const streak = calculateStreakDays([], meals, targetDate);
      expect(streak).toBe(0);
    });
  });

  describe('formatWeeklySummaryShareText', () => {
    it('formats a share text with BetterYou branding, formatted numbers, and zero tracking links', () => {
      const summary = {
        weekStart: '2026-11-09',
        weekEnd: '2026-11-15',
        totalVolumeKg: 12500,
        workoutCount: 4,
        avgDailyCalories: 2150,
        calorieTargetDelta: -50,
        prsThisWeek: 2,
        streakDays: 7,
        productsScreened: 3,
      };

      const shareText = formatWeeklySummaryShareText(summary);

      expect(shareText).toContain('✨ My Week on BetterYou');
      expect(shareText).toContain('12,500 kg total volume');
      expect(shareText).toContain('4 sessions');
      expect(shareText).toContain('2150 kcal/day avg (-50 kcal vs target)');
      expect(shareText).toContain('2 new PRs!');
      expect(shareText).toContain('Active Streak: 7 days');
      expect(shareText).toContain('Products Screened: 3');
      expect(shareText).toContain('Tracked offline with BetterYou');
      // Zero tracking links, no http/https
      expect(shareText).not.toContain('http://');
      expect(shareText).not.toContain('https://');
      expect(shareText).not.toContain('utm_');
    });
  });
});
