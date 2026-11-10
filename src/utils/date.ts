/**
 * Date utilities ensuring consistent local-date formatting and comparisons
 * avoiding UTC vs. Local timezone desynchronization.
 */

/**
 * Returns YYYY-MM-DD in the user's local device timezone.
 */
export function getLocalDateString(dateInput?: Date | string | number): string {
  const date = dateInput
    ? dateInput instanceof Date
      ? dateInput
      : new Date(dateInput)
    : new Date();

  if (isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if two timestamps/dates correspond to the same calendar day in local timezone.
 */
export function isSameLocalDay(
  dateA: Date | string | number,
  dateB: Date | string | number
): boolean {
  const strA = getLocalDateString(dateA);
  const strB = getLocalDateString(dateB);
  return Boolean(strA && strB && strA === strB);
}

/**
 * Calculates day difference between two YYYY-MM-DD local dates (dateBStr - dateAStr)
 * in local calendar days.
 */
export function getLocalDayDifference(dateAStr: string, dateBStr: string): number {
  if (!dateAStr || !dateBStr) return 0;
  const [y1, m1, d1] = dateAStr.split('-').map(Number);
  const [y2, m2, d2] = dateBStr.split('-').map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;

  const dA = new Date(y1, m1 - 1, d1).getTime();
  const dB = new Date(y2, m2 - 1, d2).getTime();
  return Math.round((dB - dA) / (1000 * 60 * 60 * 24));
}

/**
 * Adds or subtracts calendar days to a YYYY-MM-DD string.
 */
export function addLocalDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const target = new Date(y, m - 1, d + days);
  return getLocalDateString(target);
}

/**
 * Returns human-readable label for a YYYY-MM-DD date string (e.g. "Today", "Yesterday", or "Thu, May 15").
 */
export function formatDateLabel(dateStr: string): string {
  const todayStr = getLocalDateString();
  const diff = getLocalDayDifference(dateStr, todayStr);

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';

  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const target = new Date(y, m - 1, d);
  return target.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export interface DayItem {
  dateStr: string;
  dayNum: number;
  dayName: string;
  isToday: boolean;
}

/**
 * Returns a list of past N calendar days ending today.
 */
export function getRecentDaysList(count: number = 7): DayItem[] {
  const todayStr = getLocalDateString();
  const result: DayItem[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const dStr = addLocalDays(todayStr, -i);
    const [y, m, d] = dStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    result.push({
      dateStr: dStr,
      dayNum: d,
      dayName: dateObj.toLocaleDateString('en-US', { weekday: 'narrow' }), // M, T, W...
      isToday: i === 0,
    });
  }

  return result;
}

/**
 * Returns formatted month and year label, e.g. "Feb 2025" or "Nov 2026".
 */
export function formatMonthYear(dateStr?: string): string {
  const [y, m, d] = (dateStr || getLocalDateString()).split('-').map(Number);
  const dateObj = new Date(y, (m || 1) - 1, d || 1);
  return dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Returns the 7 calendar days of the week (Sunday through Saturday) for the given date.
 */
export function getWeekDaysList(referenceDateStr?: string): DayItem[] {
  const baseStr = referenceDateStr || getLocalDateString();
  const [y, m, d] = baseStr.split('-').map(Number);
  const refDate = new Date(y, (m || 1) - 1, d || 1);
  const dayOfWeek = refDate.getDay(); // 0 is Sunday, 6 is Saturday
  const sunday = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - dayOfWeek);

  const result: DayItem[] = [];
  const todayStr = getLocalDateString();
  const dayNamesShort = ['SUN', 'MON', 'TUE', 'WED', 'THR', 'FRI', 'SAT'];

  for (let i = 0; i < 7; i++) {
    const cur = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
    const curStr = getLocalDateString(cur);
    result.push({
      dateStr: curStr,
      dayNum: cur.getDate(),
      dayName: dayNamesShort[i],
      isToday: curStr === todayStr,
    });
  }
  return result;
}


