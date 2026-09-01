import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

import {
  dailyAnalysisContextVersion,
  isCurrentDateInTimeZone,
} from '@/features/ai/daily-analysis-domain.ts';
import { runDailyAnalysisModel } from '@/features/ai/daily-analysis-model.ts';
import { parseDailyAnalysisJson } from '@/features/ai/daily-analysis-schema.ts';
import type { DailyAnalysisResult } from '@/features/ai/daily-analysis-types.ts';
import type {
  AiAnalysisOutcomeReason,
  AiDailyAnalysisRow,
  Database,
  Json,
} from '@/types/database.ts';

import {
  getDailyAnalysisFunctionConfig,
  getMockDailyAnalysisJson,
  type DailyAnalysisFunctionConfig,
} from './config.ts';
import { fetchDailyAnalysisContext } from './context-repository.ts';

type AppClient = SupabaseClient<Database>;

type EnsureRequest = {
  analysisDate: string;
  debugReset?: boolean;
  timeZone: string;
};

type Claim = {
  analysis_id: string;
  analysis_status: AiDailyAnalysisRow['status'];
  processing_token: string;
  should_process: boolean;
};

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { headers: jsonHeaders, status });
}

function parseRequest(value: unknown): EnsureRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_REQUEST_BODY');
  }

  const request = value as Record<string, unknown>;
  if (
    typeof request.analysisDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(request.analysisDate) ||
    typeof request.timeZone !== 'string' ||
    request.timeZone.length < 1 ||
    request.timeZone.length > 100 ||
    (request.debugReset !== undefined && typeof request.debugReset !== 'boolean')
  ) {
    throw new Error('INVALID_REQUEST_BODY');
  }

  return {
    analysisDate: request.analysisDate,
    debugReset: request.debugReset,
    timeZone: request.timeZone,
  };
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('AUTHENTICATION_REQUIRED');
  }

  return authorization.slice('Bearer '.length).trim();
}

function createUserClient(config: DailyAnalysisFunctionConfig, token: string): AppClient {
  return createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function createAdminClient(config: DailyAnalysisFunctionConfig): AppClient {
  return createClient<Database>(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function authenticateUser(client: AppClient, token: string) {
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new Error('AUTHENTICATION_REQUIRED');
  }

  return data.user;
}

async function fetchAnalysis(client: AppClient, analysisId: string) {
  const { data, error } = await client
    .from('ai_daily_analyses')
    .select('*')
    .eq('id', analysisId)
    .maybeSingle();

  if (error) {
    throw new Error(`ANALYSIS_QUERY_FAILED:${error.message}`);
  }

  return data;
}

async function claimAnalysis(
  admin: AppClient,
  userId: string,
  request: EnsureRequest,
): Promise<Claim> {
  const { data, error } = await admin.rpc('claim_ai_daily_analysis', {
    analysis_user_id: userId,
    requested_analysis_date: request.analysisDate,
    requested_time_zone: request.timeZone,
  });

  if (error || !data?.[0]) {
    throw new Error(`ANALYSIS_CLAIM_FAILED:${error?.message ?? 'empty result'}`);
  }

  return data[0];
}

async function completeAnalysis(
  admin: AppClient,
  claim: Claim,
  result: DailyAnalysisResult,
  outcomeReason: AiAnalysisOutcomeReason,
  model: string | null,
  providerResponseId: string | null,
) {
  const { data, error } = await admin.rpc('complete_ai_daily_analysis', {
    analysis_id_value: claim.analysis_id,
    processing_token_value: claim.processing_token,
    result_category: result.category,
    result_confidence: result.confidence,
    result_context_version: dailyAnalysisContextVersion,
    result_evidence: result.evidence as Json,
    result_message: result.message,
    result_model: model,
    result_outcome_reason: outcomeReason,
    result_priority: result.priority,
    result_proposed_action: result.proposedAction as unknown as Json,
    result_provider_response_id: providerResponseId,
    result_status: result.status,
    result_title: result.title,
  });

  if (error || !data) {
    throw new Error(`ANALYSIS_COMPLETION_FAILED:${error?.message ?? 'empty result'}`);
  }

  return data;
}

async function failAnalysis(admin: AppClient, claim: Claim, failureCode: string) {
  const { error } = await admin.rpc('fail_ai_daily_analysis', {
    analysis_id_value: claim.analysis_id,
    failure_code: failureCode,
    processing_token_value: claim.processing_token,
  });

  if (error) {
    console.error('daily-analysis-failure-state-write-failed', {
      analysisId: claim.analysis_id,
      code: sanitizeFailureCode(error.message),
    });
  }
}

function noActionResult(): DailyAnalysisResult {
  return {
    category: 'none',
    confidence: 'low',
    evidence: [],
    message: null,
    priority: 'low',
    proposedAction: { type: 'none', unit: null, value: null },
    status: 'no_action',
    title: null,
  };
}

function sanitizeFailureCode(value: unknown) {
  const message = value instanceof Error ? value.message : String(value);
  const prefix = message
    .split(':', 1)[0]
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_');
  return (prefix || 'DAILY_ANALYSIS_FAILED').slice(0, 80);
}

async function maybeResetMockAnalysis(
  admin: AppClient,
  config: DailyAnalysisFunctionConfig,
  request: EnsureRequest,
  userId: string,
) {
  if (!request.debugReset) {
    return;
  }

  if (config.mode !== 'mock' || !config.allowDebugReset) {
    throw new Error('MOCK_RESET_NOT_ALLOWED');
  }

  const { error } = await admin
    .from('ai_daily_analyses')
    .delete()
    .eq('user_id', userId)
    .eq('analysis_date', request.analysisDate);

  if (error) {
    throw new Error(`MOCK_RESET_FAILED:${error.message}`);
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  let claim: Claim | null = null;
  let admin: AppClient | null = null;

  try {
    const config = getDailyAnalysisFunctionConfig();
    const token = getBearerToken(request);
    const userClient = createUserClient(config, token);
    const user = await authenticateUser(userClient, token);
    const body = parseRequest(await request.json());

    if (!isCurrentDateInTimeZone(body.analysisDate, body.timeZone)) {
      return jsonResponse({ error: 'ANALYSIS_DATE_MUST_BE_CURRENT_LOCAL_DATE' }, 400);
    }

    admin = createAdminClient(config);
    await maybeResetMockAnalysis(admin, config, body, user.id);
    claim = await claimAnalysis(admin, user.id, body);

    if (!claim.should_process) {
      return jsonResponse({
        analysis: await fetchAnalysis(userClient, claim.analysis_id),
        outcome: 'existing',
      });
    }

    if (config.mode === 'disabled') {
      const analysis = await completeAnalysis(
        admin,
        claim,
        noActionResult(),
        'disabled',
        null,
        null,
      );
      return jsonResponse({ analysis, outcome: 'completed' });
    }

    const context = await fetchDailyAnalysisContext(
      userClient,
      user.id,
      body.analysisDate,
      body.timeZone,
    );

    if (config.logContext) {
      console.info('daily-analysis-context', { analysisId: claim.analysis_id, context });
    }

    if (!context.sufficiency.canAnalyze) {
      const analysis = await completeAnalysis(
        admin,
        claim,
        noActionResult(),
        'insufficient_data',
        null,
        null,
      );
      return jsonResponse({ analysis, outcome: 'completed' });
    }

    if (config.mode === 'mock') {
      const result = parseDailyAnalysisJson(getMockDailyAnalysisJson());
      const analysis = await completeAnalysis(admin, claim, result, 'mock', null, null);
      return jsonResponse({ analysis, outcome: 'completed' });
    }

    const openAi = new OpenAI({ apiKey: config.openAiApiKey! });
    const modelResult = await runDailyAnalysisModel(
      async (modelRequest) => {
        const response = await openAi.responses.create(modelRequest);
        return {
          id: response.id,
          output_text: response.output_text,
          status: response.status,
        };
      },
      config.openAiModel!,
      context,
    );
    const analysis = await completeAnalysis(
      admin,
      claim,
      modelResult.result,
      'model',
      config.openAiModel,
      modelResult.responseId,
    );

    return jsonResponse({ analysis, outcome: 'completed' });
  } catch (error) {
    const failureCode = sanitizeFailureCode(error);
    console.error('daily-analysis-request-failed', {
      analysisId: claim?.analysis_id ?? null,
      code: failureCode,
    });

    if (admin && claim?.should_process) {
      await failAnalysis(admin, claim, failureCode);
      return jsonResponse({ analysis: null, outcome: 'failed' });
    }

    const status = failureCode === 'AUTHENTICATION_REQUIRED' ? 401 : 400;
    return jsonResponse({ error: failureCode }, status);
  }
});
