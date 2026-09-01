import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bodyKeys } from '@/features/body/body-query-keys';
import { profileKeys } from '@/features/profile/profile-queries';
import { todayKeys } from '@/features/today/today-queries';
import {
  acceptDailyAnalysis,
  claimDailyAnalysisForDisplay,
  dismissDailyAnalysis,
  ensureDailyAnalysis,
  fetchDailyAnalysis,
} from '@/services/ai/daily-analysis-service';

export const dailyAnalysisKeys = {
  all: ['daily-analysis'] as const,
  detail: (analysisId: string) => [...dailyAnalysisKeys.all, 'detail', analysisId] as const,
  ensure: (userId: string, date: string, timeZone: string) =>
    [...dailyAnalysisKeys.all, 'ensure', userId, date, timeZone] as const,
};

export function useEnsureDailyAnalysis(
  userId: string,
  date: string,
  timeZone: string,
  enabled: boolean,
) {
  return useQuery({
    enabled: Boolean(enabled && userId && date && timeZone),
    gcTime: 1000 * 60 * 60 * 24,
    queryFn: () => ensureDailyAnalysis(date, timeZone),
    queryKey: dailyAnalysisKeys.ensure(userId, date, timeZone),
    retry: 1,
    staleTime: 1000 * 60 * 15,
  });
}

export function useDailyAnalysis(analysisId: string) {
  return useQuery({
    enabled: Boolean(analysisId),
    queryFn: () => fetchDailyAnalysis(analysisId),
    queryKey: dailyAnalysisKeys.detail(analysisId),
  });
}

export function useClaimDailyAnalysisForDisplay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: claimDailyAnalysisForDisplay,
    onSuccess: (analysis) => {
      if (analysis) {
        queryClient.setQueryData(dailyAnalysisKeys.detail(analysis.id), analysis);
      }
    },
  });
}

export function useDismissDailyAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dismissDailyAnalysis,
    onSuccess: (analysis) => {
      queryClient.setQueryData(dailyAnalysisKeys.detail(analysis.id), analysis);
      void queryClient.invalidateQueries({ queryKey: dailyAnalysisKeys.all });
    },
  });
}

export function useAcceptDailyAnalysis(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptDailyAnalysis,
    onSuccess: async (analysis) => {
      queryClient.setQueryData(dailyAnalysisKeys.detail(analysis.id), analysis);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dailyAnalysisKeys.all }),
        queryClient.invalidateQueries({ queryKey: profileKeys.detail(userId) }),
        queryClient.invalidateQueries({ queryKey: todayKeys.all }),
        queryClient.invalidateQueries({ queryKey: bodyKeys.all }),
      ]);
    },
  });
}
