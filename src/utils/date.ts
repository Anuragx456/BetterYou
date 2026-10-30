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
