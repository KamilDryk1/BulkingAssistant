import { parseDailyAnalysisResult } from '@/features/ai/daily-analysis-schema';
import type {
  DailyAnalysisResult,
  EnsureDailyAnalysisResponse,
} from '@/features/ai/daily-analysis-types';
import { getSupabaseClient } from '@/services/supabase/get-client';
import type { AiDailyAnalysisRow } from '@/types/database';

export async function ensureDailyAnalysis(analysisDate: string, timeZone: string) {
  const { data, error } = await getSupabaseClient().functions.invoke<EnsureDailyAnalysisResponse>(
    'ensure-daily-analysis',
    { body: { analysisDate, timeZone } },
  );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('DAILY_ANALYSIS_EMPTY_RESPONSE');
  }

  return data;
}

export async function fetchDailyAnalysis(analysisId: string) {
  const { data, error } = await getSupabaseClient()
    .from('ai_daily_analyses')
    .select('*')
    .eq('id', analysisId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function claimDailyAnalysisForDisplay(analysisId: string) {
  const { data, error } = await getSupabaseClient().rpc('claim_ai_daily_analysis_for_display', {
    analysis_id_value: analysisId,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function dismissDailyAnalysis(analysisId: string) {
  const { data, error } = await getSupabaseClient().rpc('dismiss_ai_daily_analysis', {
    analysis_id_value: analysisId,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function acceptDailyAnalysis(analysisId: string) {
  const { data, error } = await getSupabaseClient().rpc('accept_ai_daily_analysis', {
    analysis_id_value: analysisId,
  });

  if (error) {
    throw error;
  }

  return data;
}

export function getDailyAnalysisResult(analysis: AiDailyAnalysisRow): DailyAnalysisResult | null {
  if (analysis.status !== 'no_action' && analysis.status !== 'suggestion') {
    return null;
  }

  return parseDailyAnalysisResult({
    category: analysis.category,
    confidence: analysis.confidence,
    evidence: analysis.evidence,
    message: analysis.message,
    priority: analysis.priority,
    proposedAction: analysis.proposed_action,
    status: analysis.status,
    title: analysis.title,
  });
}
