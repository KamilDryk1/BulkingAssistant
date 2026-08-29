import { getLocalDateKey } from '@/features/training/training-domain';
import type { WeightLogRow } from '@/types/database';

export function getLocalDayBounds(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 1);

  return { endIso: end.toISOString(), startIso: start.toISOString() };
}

export function getSevenDayStartIso(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day - 6).toISOString();
}

export function calculateSevenDayAverage(weightLogs: readonly WeightLogRow[]) {
  const latestByDay = new Map<string, WeightLogRow>();

  weightLogs.forEach((log) => {
    const dayKey = getLocalDateKey(new Date(log.recorded_at));
    const current = latestByDay.get(dayKey);

    if (!current || new Date(log.recorded_at).getTime() > new Date(current.recorded_at).getTime()) {
      latestByDay.set(dayKey, log);
    }
  });

  if (latestByDay.size === 0) {
    return null;
  }

  const total = [...latestByDay.values()].reduce((sum, log) => sum + log.weight_kg, 0);
  return total / latestByDay.size;
}
