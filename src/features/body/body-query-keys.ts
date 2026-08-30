export const bodyKeys = {
  activityHistory: (userId: string) => [...bodyKeys.all, 'activity-history', userId] as const,
  all: ['body'] as const,
  overview: (userId: string, date: string) => [...bodyKeys.all, 'overview', userId, date] as const,
};
