/**
 * Date arithmetic on `YYYY-MM-DD` strings in UTC. No dependencies, no local
 * timezone, no DST surprises the day a vignette starts.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(iso: string): Date {
  if (!ISO_DATE.test(iso)) {
    throw new Error(`Expected a YYYY-MM-DD date, got ${JSON.stringify(iso)}`);
  }
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Not a real date: ${iso}`);
  return date;
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = parseDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

export function addMonths(iso: string, months: number): string {
  const date = parseDate(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDayOfMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDayOfMonth));
  return toISODate(date);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = parseDate(toIso).getTime() - parseDate(fromIso).getTime();
  return Math.round(ms / 86_400_000);
}

export function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

export function isBefore(a: string, b: string): boolean {
  return a < b;
}

export function todayISO(): string {
  return toISODate(new Date());
}
