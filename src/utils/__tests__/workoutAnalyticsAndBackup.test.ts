import { describe, it, expect } from 'bun:test';
import {
  detectPersonalRecord,
  getPreviousSessionExerciseValues,
} from '../workoutAnalytics';
import {
  generateJsonBackup,
  generateWorkoutsCsv,
  generateMealsCsv,
} from '../../services/backupService';
import { WorkoutSession, MealLog } from '../../types';

describe('Workout Analytics & PR Detection', () => {
  const sampleWorkouts: WorkoutSession[] = [
    {
      id: 'w1',
      title: 'Push Day',
      startedAt: '2026-11-01T10:00:00.000Z',
      completedAt: '2026-11-01T10:45:00.000Z',
      durationSeconds: 2700,
      totalVolumeKg: 2400,
      exercises: [
        {
          id: 'e1',
          name: 'Barbell Bench Press',
          sets: [
            { id: 's1', setNumber: 1, weightKg: 80, reps: 10, completed: true },
            { id: 's2', setNumber: 2, weightKg: 85, reps: 8, completed: true },
            { id: 's3', setNumber: 3, weightKg: 90, reps: 5, completed: true },
          ],
        },
      ],
    },
    {
      id: 'w2',
      title: 'Push Day 2',
      startedAt: '2026-11-03T10:00:00.000Z',
      completedAt: '2026-11-03T10:45:00.000Z',
      durationSeconds: 2700,
      totalVolumeKg: 2600,
      exercises: [
        {
          id: 'e2',
          name: 'Barbell Bench Press',
          sets: [
            { id: 's4', setNumber: 1, weightKg: 85, reps: 10, completed: true },
            { id: 's5', setNumber: 2, weightKg: 90, reps: 8, completed: true },
            { id: 's6', setNumber: 3, weightKg: 95, reps: 5, completed: true },
          ],
        },
      ],
    },
  ];

  it('retrieves values from the most recent session for an exercise', () => {
    const prev = getPreviousSessionExerciseValues('Barbell Bench Press', sampleWorkouts);
    expect(prev).not.toBeNull();
    expect(prev?.lastDate).toBe('2026-11-03');
    expect(prev?.sets.length).toBe(3);
    expect(prev?.sets[0]?.weightKg).toBe(85);
    expect(prev?.summaryText).toContain('85kg×10');
  });

  it('returns null for an unlogged exercise', () => {
    const prev = getPreviousSessionExerciseValues('Overhead Cable Extension', sampleWorkouts);
    expect(prev).toBeNull();
  });

  it('detects an all-time weight Personal Record (PR)', () => {
    // Max past weight in sampleWorkouts was 95kg
    const prCheck1 = detectPersonalRecord('Barbell Bench Press', 92, 5, sampleWorkouts);
    expect(prCheck1.isWeightPr).toBe(false);

    const prCheck2 = detectPersonalRecord('Barbell Bench Press', 100, 5, sampleWorkouts);
    expect(prCheck2.isWeightPr).toBe(true);
    expect(prCheck2.previousMaxWeight).toBe(95);
  });

  it('detects a set volume PR', () => {
    // Max past set volume was 90 * 8 = 720kg or 85 * 10 = 850kg
    const prCheck = detectPersonalRecord('Barbell Bench Press', 90, 10, sampleWorkouts); // 900kg
    expect(prCheck.isVolumePr).toBe(true);
  });
});

describe('Backup & Export Service (CSV / JSON)', () => {
  const sampleWorkouts: WorkoutSession[] = [
    {
      id: 'w1',
      title: 'Leg Day',
      startedAt: '2026-11-02T10:00:00.000Z',
      completedAt: '2026-11-02T10:50:00.000Z',
      durationSeconds: 3000,
      totalVolumeKg: 3500,
      exercises: [
        {
          id: 'e1',
          name: 'Barbell Back Squat',
          sets: [
            { id: 's1', setNumber: 1, weightKg: 100, reps: 10, completed: true },
          ],
        },
      ],
    },
  ];

  const sampleMeals: MealLog[] = [
    {
      id: 'm1',
      timestamp: '2026-11-02T12:30:00.000Z',
      dishName: 'Paneer Bhurji & Roti',
      estimatedWeightGrams: 350,
      calories: 520,
      protein: 28,
      carbs: 45,
      fat: 22,
      portionMultiplier: 1,
      ingredientsDetected: ['Paneer', 'Roti'],
    },
  ];

  it('generates valid structured JSON backup', () => {
    const json = generateJsonBackup(sampleWorkouts, sampleMeals);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.workouts.length).toBe(1);
    expect(parsed.meals.length).toBe(1);
    expect(parsed.workouts[0].title).toBe('Leg Day');
  });

  it('generates CSV with proper headers for workouts', () => {
    const csv = generateWorkoutsCsv(sampleWorkouts);
    expect(csv).toContain('Date,Workout_Title,Duration_Minutes');
    expect(csv).toContain('"Leg Day"');
    expect(csv).toContain('"Barbell Back Squat"');
    expect(csv).toContain('100,10,1000,true');
  });

  it('generates CSV with proper headers for meals', () => {
    const csv = generateMealsCsv(sampleMeals);
    expect(csv).toContain('Date,Timestamp,Dish_Name');
    expect(csv).toContain('"Paneer Bhurji & Roti"');
    expect(csv).toContain('520,28,45,22');
  });
});
