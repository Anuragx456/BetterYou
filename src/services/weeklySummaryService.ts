import {
  DailyGoals,
  MealLog,
  ScannedProduct,
  WorkoutSession,
} from '../types';
import { addLocalDays, getLocalDateString } from '../utils/date';

export interface PrDetail {
  exerciseName: string;
  weightKg: number;
  previousMaxKg: number;
}

export interface WeeklySummary {
  weekStart: string; // YYYY-MM-DD
  weekEnd: string;   // YYYY-MM-DD
  totalVolumeKg: number;
  workoutCount: number;
  avgDailyCalories: number;
  calorieTargetDelta: number;
  prsThisWeek: number;
  prDetails?: PrDetail[];
  streakDays: number;
  productsScreened: number;
}

/**
 * Calculates continuous active streak days ending at or just before targetDate.
 * An active day is one where either a workout was performed or a meal was logged.
 */
export function calculateStreakDays(
  workouts: WorkoutSession[],
  meals: MealLog[],
  targetDate: Date | string = new Date()
): number {
  const activeDates = new Set<string>();

  for (const w of workouts) {
    const d = getLocalDateString(w.completedAt || w.startedAt || w.date);
    if (d) activeDates.add(d);
  }

  for (const m of meals) {
    const d = getLocalDateString(m.timestamp || m.date);
    if (d) activeDates.add(d);
  }

  const targetStr = getLocalDateString(targetDate);
  if (!targetStr) return 0;

  // If active today (targetDate), start counting back from today.
  // Otherwise if active yesterday, streak is alive from yesterday.
  let checkDate: string | null = null;
  if (activeDates.has(targetStr)) {
    checkDate = targetStr;
  } else {
    const yesterday = addLocalDays(targetStr, -1);
    if (activeDates.has(yesterday)) {
      checkDate = yesterday;
    } else {
      return 0;
    }
  }

  let streak = 0;
  let curr = checkDate;
  while (curr && activeDates.has(curr)) {
    streak++;
    curr = addLocalDays(curr, -1);
  }

  return streak;
}

/**
 * Pure function aggregating 7-day fitness, nutrition, and product screening performance.
 *
 * @param workouts Complete list of workout sessions (used for both current week and prior PR baseline)
 * @param meals Complete list of logged meals
 * @param scannedProducts Complete list of scanned products
 * @param goals User's daily nutritional goals
 * @param targetDate Reference date for the week ending day (defaults to today)
 */
export function generateWeeklySummary(
  workouts: WorkoutSession[],
  meals: MealLog[],
  scannedProducts: ScannedProduct[],
  goals: DailyGoals,
  targetDate: Date | string = new Date()
): WeeklySummary {
  const weekEnd = getLocalDateString(targetDate);
  const weekStart = addLocalDays(weekEnd, -6);

  // 1. Filter workouts into this week and prior history
  const weekWorkouts: WorkoutSession[] = [];
  const priorWorkouts: WorkoutSession[] = [];

  for (const w of workouts) {
    const d = getLocalDateString(w.completedAt || w.startedAt || w.date);
    if (!d) continue;

    if (d >= weekStart && d <= weekEnd) {
      weekWorkouts.push(w);
    } else if (d < weekStart) {
      priorWorkouts.push(w);
    }
  }

  // Calculate total volume and workout count
  let totalVolumeKg = 0;
  for (const w of weekWorkouts) {
    let sessionVolume = 0;
    if (w.exercises && Array.isArray(w.exercises)) {
      for (const ex of w.exercises) {
        if (ex.sets && Array.isArray(ex.sets)) {
          for (const s of ex.sets) {
            if (s.completed && s.weightKg > 0 && s.reps > 0) {
              sessionVolume += s.weightKg * s.reps;
            }
          }
        }
      }
    }
    // Fall back to recorded session totalVolumeKg if sets are empty
    totalVolumeKg += sessionVolume > 0 ? sessionVolume : (w.totalVolumeKg || 0);
  }
  totalVolumeKg = Math.round(totalVolumeKg * 10) / 10;
  const workoutCount = weekWorkouts.length;

  // 2. PR detection across time
  // Find highest weight achieved per exercise in all prior workouts
  const priorMaxMap = new Map<string, number>();
  for (const w of priorWorkouts) {
    if (!w.exercises) continue;
    for (const ex of w.exercises) {
      const nameKey = ex.name.toLowerCase().trim();
      if (!nameKey || !ex.sets) continue;
      for (const s of ex.sets) {
        if (s.completed && s.weightKg > 0 && s.reps > 0) {
          const currentMax = priorMaxMap.get(nameKey) || 0;
          if (s.weightKg > currentMax) {
            priorMaxMap.set(nameKey, s.weightKg);
          }
        }
      }
    }
  }

  // Find max weight in this week's workouts and compare with prior
  const weekMaxMap = new Map<string, { weightKg: number; originalName: string }>();
  for (const w of weekWorkouts) {
    if (!w.exercises) continue;
    for (const ex of w.exercises) {
      const nameKey = ex.name.toLowerCase().trim();
      if (!nameKey || !ex.sets) continue;
      for (const s of ex.sets) {
        if (s.completed && s.weightKg > 0 && s.reps > 0) {
          const entry = weekMaxMap.get(nameKey);
          if (!entry || s.weightKg > entry.weightKg) {
            weekMaxMap.set(nameKey, { weightKg: s.weightKg, originalName: ex.name });
          }
        }
      }
    }
  }

  const prDetails: PrDetail[] = [];
  for (const [nameKey, entry] of weekMaxMap.entries()) {
    const priorMax = priorMaxMap.get(nameKey) || 0;
    // An established PR requires beating a previously recorded non-zero personal best
    if (priorMax > 0 && entry.weightKg > priorMax) {
      prDetails.push({
        exerciseName: entry.originalName,
        weightKg: entry.weightKg,
        previousMaxKg: priorMax,
      });
    }
  }

  const prsThisWeek = prDetails.length;

  // 3. Nutrition: Meals within the week
  let totalCalories = 0;
  for (const m of meals) {
    const d = getLocalDateString(m.timestamp || m.date);
    if (d && d >= weekStart && d <= weekEnd) {
      totalCalories += m.calories || 0;
    }
  }
  const avgDailyCalories = Math.round(totalCalories / 7);
  const target = goals?.calorieTarget || 0;
  const calorieTargetDelta = target > 0 ? avgDailyCalories - target : 0;

  // 4. Products screened within the week
  let productsScreened = 0;
  for (const p of scannedProducts) {
    const d = getLocalDateString(p.scannedAt);
    if (d && d >= weekStart && d <= weekEnd) {
      productsScreened++;
    }
  }

  // 5. Streak days
  const streakDays = calculateStreakDays(workouts, meals, targetDate);

  return {
    weekStart,
    weekEnd,
    totalVolumeKg,
    workoutCount,
    avgDailyCalories,
    calorieTargetDelta,
    prsThisWeek,
    prDetails,
    streakDays,
    productsScreened,
  };
}

/**
 * Formats a clean text share card with zero tracking links, no PII,
 * and only "BetterYou" branding.
 */
export function formatWeeklySummaryShareText(summary: WeeklySummary): string {
  const deltaStr =
    summary.calorieTargetDelta > 0
      ? `+${summary.calorieTargetDelta}`
      : `${summary.calorieTargetDelta}`;

  const lines = [
    '✨ My Week on BetterYou',
    `📅 ${summary.weekStart} to ${summary.weekEnd}`,
    '',
    `🏋️ Workouts: ${summary.workoutCount} sessions (${summary.totalVolumeKg.toLocaleString()} kg total volume)`,
    `🔥 Nutrition: ${summary.avgDailyCalories} kcal/day avg (${deltaStr} kcal vs target)`,
    summary.prsThisWeek > 0
      ? `🏆 Personal Records: ${summary.prsThisWeek} new PR${summary.prsThisWeek > 1 ? 's' : ''}!`
      : null,
    summary.streakDays > 0 ? `⚡ Active Streak: ${summary.streakDays} days` : null,
    summary.productsScreened > 0 ? `🛡️ Products Screened: ${summary.productsScreened}` : null,
    '',
    'Tracked offline with BetterYou',
  ].filter(Boolean) as string[];

  return lines.join('\n');
}
