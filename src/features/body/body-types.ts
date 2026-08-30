import type { ActivityLogRow, WeightLogRow } from '@/types/database';

export type DailyWeightPoint = {
  date: string;
  weightKg: number;
};

export type WeightTrendPoint = {
  date: string;
  averageWeightKg: number;
};

export type WeightTrendSummary = {
  chartPoints: WeightTrendPoint[];
  sevenDayAverageKg: number | null;
  weeklyChangeKg: number | null;
};

export type BodyData = {
  recentActivities: ActivityLogRow[];
  weightLogs: WeightLogRow[];
};

export type ActivityHistoryPage = {
  items: ActivityLogRow[];
  nextPage: number | null;
};
