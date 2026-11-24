/**
 * Retraining schedule presets (Fase 4C, owner ruling K2). The `latih_ulang` DAG runs every day at
 * 02.00 WIB and its first task asks the Core API whether that day is a training day. Manual runs
 * from the admin page do not depend on the schedule.
 */
export const SCHEDULE_PRESETS = [
  'weekly_monday',
  'daily',
  'biweekly_monday',
  'monthly_first_monday',
  'manual',
] as const;
export type SchedulePreset = (typeof SCHEDULE_PRESETS)[number];
export const DEFAULT_SCHEDULE: SchedulePreset = 'weekly_monday';

export const PRESET_LABELS: Record<SchedulePreset, string> = {
  weekly_monday: 'Setiap Senin pukul 02.00 WIB',
  daily: 'Setiap hari pukul 02.00 WIB',
  biweekly_monday: 'Dua minggu sekali: Senin minggu genap pukul 02.00 WIB',
  monthly_first_monday: 'Senin pertama setiap bulan pukul 02.00 WIB',
  manual: 'Hanya manual dari halaman admin',
};

/** ISO 8601 week number of a calendar date (YYYY-MM-DD). */
export function isoWeek(date: string): number {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of this week decides the year
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

/** Whether the preset trains on this WIB calendar date (YYYY-MM-DD). */
export function trainsOn(preset: SchedulePreset, date: string): boolean {
  const d = new Date(`${date}T00:00:00Z`);
  const monday = d.getUTCDay() === 1;
  switch (preset) {
    case 'daily':
      return true;
    case 'weekly_monday':
      return monday;
    case 'biweekly_monday':
      return monday && isoWeek(date) % 2 === 0;
    case 'monthly_first_monday':
      return monday && d.getUTCDate() <= 7;
    case 'manual':
      return false;
  }
}

/** The next WIB date on or after `date` on which the preset trains (null for manual). */
export function nextTrainingDate(preset: SchedulePreset, date: string): string | null {
  if (preset === 'manual') return null;
  const d = new Date(`${date}T00:00:00Z`);
  for (let i = 0; i < 70; i++) {
    const day = d.toISOString().slice(0, 10);
    if (trainsOn(preset, day)) return day;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return null;
}
