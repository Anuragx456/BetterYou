import { describe, expect, it } from 'bun:test';
import {
  addLocalDays,
  formatDateLabel,
  getLocalDateString,
  getLocalDayDifference,
  getRecentDaysList,
} from '../date';
import { calculateWorkoutVolume } from '../../store/useFitnessStore';

describe('Date & Fitness Calculation Utilities', () => {
  it('formats dates in local YYYY-MM-DD correctly', () => {
    const fixedDate = new Date(2026, 4, 15); // May 15, 2026
    const str = getLocalDateString(fixedDate);
    expect(str).toBe('2026-05-15');
  });

  it('calculates calendar day differences accurately', () => {
    expect(getLocalDayDifference('2026-05-14', '2026-05-15')).toBe(1);
    expect(getLocalDayDifference('2026-05-10', '2026-05-15')).toBe(5);
    expect(getLocalDayDifference('2026-05-15', '2026-05-14')).toBe(-1);
  });

  it('adds and subtracts local calendar days accurately', () => {
    expect(addLocalDays('2026-05-15', 1)).toBe('2026-05-16');
    expect(addLocalDays('2026-05-15', -1)).toBe('2026-05-14');
    expect(addLocalDays('2026-05-01', -1)).toBe('2026-04-30');
  });

  it('formats human readable date labels correctly', () => {
    const today = getLocalDateString();
    expect(formatDateLabel(today)).toBe('Today');
    expect(formatDateLabel(addLocalDays(today, -1))).toBe('Yesterday');
  });

  it('generates recent days list ending in today', () => {
    const days = getRecentDaysList(7);
    expect(days.length).toBe(7);
    expect(days[days.length - 1].isToday).toBe(true);
    expect(days[days.length - 1].dateStr).toBe(getLocalDateString());
  });


  it('computes total volume only from completed sets', () => {
    const exercises = [
      {
        id: 'bench',
        name: 'Barbell Bench Press',
        sets: [
          { id: 's1', setNumber: 1, weightKg: 80, reps: 10, completed: true },  // 800 kg
          { id: 's2', setNumber: 2, weightKg: 90, reps: 8, completed: true },   // 720 kg
          { id: 's3', setNumber: 3, weightKg: 100, reps: 5, completed: false }, // not completed
        ],
      },
      {
        id: 'curls',
        name: 'Bicep Curls',
        sets: [
          { id: 's4', setNumber: 1, weightKg: 15, reps: 12, completed: true }, // 180 kg
        ],
      },
    ];

    const volume = calculateWorkoutVolume(exercises);
    expect(volume).toBe(800 + 720 + 180); // 1700 kg
  });
});
