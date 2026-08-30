import { getLocalDateKey } from '@/features/training/training-domain';
import type { WeightLogRow } from '@/types/database';

import type { DailyWeightPoint, WeightTrendPoint, WeightTrendSummary } from './body-types';

export const weightChartDays = 28;

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function shiftDateKey(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getBodyHistoryStartIso(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const rollingAverageLeadInDays = 6;
  const start = new Date(year, month - 1, day - weightChartDays - rollingAverageLeadInDays + 1);
  return start.toISOString();
}

export function selectLatestWeightPerDay(weightLogs: readonly WeightLogRow[]): DailyWeightPoint[] {
  const latestByDay = new Map<string, WeightLogRow>();

  weightLogs.forEach((log) => {
    const date = getLocalDateKey(new Date(log.recorded_at));
    const current = latestByDay.get(date);

    if (!current || Date.parse(log.recorded_at) > Date.parse(current.recorded_at)) {
      latestByDay.set(date, log);
    }
  });

  return [...latestByDay.entries()]
    .map(([date, log]) => ({ date, weightKg: log.weight_kg }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function averageInRange(points: readonly DailyWeightPoint[], startDate: string, endDate: string) {
  const values = points
    .filter((point) => point.date >= startDate && point.date <= endDate)
    .map((point) => point.weightKg);

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function createRollingAveragePoints(
  points: readonly DailyWeightPoint[],
  dateKey: string,
): WeightTrendPoint[] {
  const chartStart = shiftDateKey(dateKey, -(weightChartDays - 1));

  return points
    .filter((point) => point.date >= chartStart && point.date <= dateKey)
    .map((point) => {
      const averageWeightKg = averageInRange(points, shiftDateKey(point.date, -6), point.date);

      return averageWeightKg === null ? null : { averageWeightKg, date: point.date };
    })
    .filter((point): point is WeightTrendPoint => point !== null);
}

export function calculateWeightTrend(
  weightLogs: readonly WeightLogRow[],
  dateKey: string,
): WeightTrendSummary {
  const points = selectLatestWeightPerDay(weightLogs);
  const currentAverage = averageInRange(points, shiftDateKey(dateKey, -6), dateKey);
  const previousAverage = averageInRange(
    points,
    shiftDateKey(dateKey, -13),
    shiftDateKey(dateKey, -7),
  );

  return {
    chartPoints: createRollingAveragePoints(points, dateKey),
    sevenDayAverageKg: currentAverage,
    weeklyChangeKg:
      currentAverage === null || previousAverage === null ? null : currentAverage - previousAverage,
  };
}
