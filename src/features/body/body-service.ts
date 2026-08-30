import { getSupabaseClient } from '@/services/supabase/get-client';

import { getBodyHistoryStartIso } from './body-domain';
import type { ActivityHistoryPage, BodyData } from './body-types';

export const activityHistoryPageSize = 20;
const recentActivityCount = 4;

export async function fetchBodyData(userId: string, date: string): Promise<BodyData> {
  const client = getSupabaseClient();
  const [weightResult, activityResult] = await Promise.all([
    client
      .from('weight_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('recorded_at', getBodyHistoryStartIso(date))
      .order('recorded_at', { ascending: false }),
    client
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('activity_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(recentActivityCount),
  ]);

  const firstError = [weightResult.error, activityResult.error].find(Boolean);
  if (firstError) {
    throw firstError;
  }

  return {
    recentActivities: activityResult.data ?? [],
    weightLogs: weightResult.data ?? [],
  };
}

export async function fetchActivityHistory(
  userId: string,
  page: number,
): Promise<ActivityHistoryPage> {
  const start = page * activityHistoryPageSize;
  const end = start + activityHistoryPageSize;
  const { data, error } = await getSupabaseClient()
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('activity_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(start, end);

  if (error) {
    throw error;
  }

  const hasMore = (data?.length ?? 0) > activityHistoryPageSize;

  return {
    items: (data ?? []).slice(0, activityHistoryPageSize),
    nextPage: hasMore ? page + 1 : null,
  };
}
