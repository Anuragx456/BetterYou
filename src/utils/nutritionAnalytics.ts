/**
 * Nutrition and Bodyweight Analytics Utilities
 *
 * Computes 28-day calorie vs target trends, 7-day moving averages,
 * and 7-day / 30-day weight progress deltas.
 */

import { BodyMeasurement, MealLog } from '../types';
import { addLocalDays, getLocalDateString } from './date';

export interface CalorieTrendDay {
  date: string; // YYYY-MM-DD
  dayLabel: string;
  totalCalories: number;
  targetCalories: number;
  deltaCalories: number;
  hasData: boolean;
}

export interface CalorieTrendSummary {
  days: CalorieTrendDay[];
  averageCalories: number;
  targetCalories: number;
  daysLogged: number;
}

export interface WeightAnalyticsSummary {
  currentWeight: number | null;
  currentWeightDate: string | null;
  sevenDayAverage: number | null;
  deltaVsSevenDaysAgo: number | null;
  deltaVsThirtyDaysAgo: number | null;
  weightTrend: 'losing' | 'gaining' | 'maintaining' | 'neutral';
  historyPoints: { date: string; weightKg: number }[];
}

/**
 * Aggregates meals over the last 28 calendar days ending on todayDate.
 */
export function aggregate28DayCalories(
  meals: MealLog[],
  dailyCalorieTarget: number,
  todayDate: string = getLocalDateString()
): CalorieTrendSummary {
  const target = Math.max(0, Math.round(dailyCalorieTarget));

  // Build map of total calories per date
  const caloriesByDate = new Map<string, number>();
  for (const meal of meals) {
    const mealDate = meal.date || (meal.timestamp ? meal.timestamp.split('T')[0] : '');
    if (!mealDate) continue;
    const current = caloriesByDate.get(mealDate) || 0;
    caloriesByDate.set(mealDate, current + Math.max(0, meal.calories || 0));
  }

  // Generate 28 continuous calendar days from 27 days ago to today
  const days: CalorieTrendDay[] = [];
  let sumLoggedCalories = 0;
  let daysLogged = 0;

  for (let i = 27; i >= 0; i--) {
    const dayDate = addLocalDays(todayDate, -i);
    const hasData = caloriesByDate.has(dayDate);
    const totalCalories = caloriesByDate.get(dayDate) || 0;

    if (hasData) {
      sumLoggedCalories += totalCalories;
      daysLogged++;
    }

    const [, month, day] = dayDate.split('-');
    const dayLabel = `${month}/${day}`;

    days.push({
      date: dayDate,
      dayLabel,
      totalCalories,
      targetCalories: target,
      deltaCalories: totalCalories - target,
      hasData,
    });
  }

  const averageCalories = daysLogged > 0 ? Math.round(sumLoggedCalories / daysLogged) : 0;

  return {
    days,
    averageCalories,
    targetCalories: target,
    daysLogged,
  };
}

/**
 * Computes 7-day weight moving average and progress deltas vs 7 days ago and 30 days ago.
 */
export function calculateWeightAveragesAndDeltas(
  measurements: BodyMeasurement[],
  todayDate: string = getLocalDateString()
): WeightAnalyticsSummary {
  if (!measurements || measurements.length === 0) {
    return {
      currentWeight: null,
      currentWeightDate: null,
      sevenDayAverage: null,
      deltaVsSevenDaysAgo: null,
      deltaVsThirtyDaysAgo: null,
      weightTrend: 'neutral',
      historyPoints: [],
    };
  }

  // Sort ascending by date
  const sorted = [...measurements]
    .filter((m) => m && typeof m.weightKg === 'number' && m.weightKg > 0 && Boolean(m.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

  if (sorted.length === 0) {
    return {
      currentWeight: null,
      currentWeightDate: null,
      sevenDayAverage: null,
      deltaVsSevenDaysAgo: null,
      deltaVsThirtyDaysAgo: null,
      weightTrend: 'neutral',
      historyPoints: [],
    };
  }

  // De-duplicate multiple weights on same date (keep latest)
  const byDateMap = new Map<string, number>();
  for (const m of sorted) {
    byDateMap.set(m.date, m.weightKg);
  }

  const historyPoints = Array.from(byDateMap.entries()).map(([date, weightKg]) => ({
    date,
    weightKg,
  }));

  const latestEntry = sorted[sorted.length - 1];
  const currentWeight = latestEntry.weightKg;
  const currentWeightDate = latestEntry.date;

  // 1. Calculate 7-day average (window: [today - 6 days, today])
  const date7DaysAgo = addLocalDays(todayDate, -6);
  const recent7DayWeights: number[] = [];
  for (const [d, w] of byDateMap.entries()) {
    if (d >= date7DaysAgo && d <= todayDate) {
      recent7DayWeights.push(w);
    }
  }

  const sevenDayAverage =
    recent7DayWeights.length > 0
      ? Math.round((recent7DayWeights.reduce((a, b) => a + b, 0) / recent7DayWeights.length) * 10) / 10
      : currentWeight;

  // 2. Previous 7-day window (days 7 to 13 ago)
  const priorWindowStart = addLocalDays(todayDate, -13);
  const priorWindowEnd = addLocalDays(todayDate, -7);
  const prior7DayWeights: number[] = [];
  for (const [d, w] of byDateMap.entries()) {
    if (d >= priorWindowStart && d <= priorWindowEnd) {
      prior7DayWeights.push(w);
    }
  }

  let deltaVsSevenDaysAgo: number | null = null;
  if (prior7DayWeights.length > 0) {
    const priorAvg = prior7DayWeights.reduce((a, b) => a + b, 0) / prior7DayWeights.length;
    deltaVsSevenDaysAgo = Math.round((sevenDayAverage - priorAvg) * 10) / 10;
  } else {
    // Fallback: Find closest measurement on or before 7 days ago
    const olderPoint = historyPoints.filter((p) => p.date <= priorWindowEnd).pop();
    if (olderPoint) {
      deltaVsSevenDaysAgo = Math.round((currentWeight - olderPoint.weightKg) * 10) / 10;
    }
  }

  // 3. 30 days ago comparison (window: days 25 to 35 ago, or nearest before 30 days)
  const target30DaysAgo = addLocalDays(todayDate, -30);
  let deltaVsThirtyDaysAgo: number | null = null;
  const pointAround30 = historyPoints.filter((p) => p.date <= target30DaysAgo).pop();
  if (pointAround30) {
    deltaVsThirtyDaysAgo = Math.round((currentWeight - pointAround30.weightKg) * 10) / 10;
  }

  // Trend detection
  let weightTrend: 'losing' | 'gaining' | 'maintaining' | 'neutral' = 'neutral';
  const effectiveDelta = deltaVsSevenDaysAgo !== null ? deltaVsSevenDaysAgo : deltaVsThirtyDaysAgo;
  if (effectiveDelta !== null) {
    if (effectiveDelta <= -0.3) {
      weightTrend = 'losing';
    } else if (effectiveDelta >= 0.3) {
      weightTrend = 'gaining';
    } else {
      weightTrend = 'maintaining';
    }
  }

  return {
    currentWeight,
    currentWeightDate,
    sevenDayAverage,
    deltaVsSevenDaysAgo,
    deltaVsThirtyDaysAgo,
    weightTrend,
    historyPoints,
  };
}
