import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

import { isCurrentDateInTimeZone } from '@/features/ai/daily-analysis-domain.ts';
import {
  runCoachTurn,
  type CoachHistoryMessage,
  type CoachModelResponse,
  type CoachResponseRequest,
  type CoachToolCall,
} from '@/features/ai/coach-model.ts';
import {
  getCoachToolKind,
  parseCoachToolArguments,
  type CoachToolArguments,
} from '@/features/ai/coach-tools.ts';
import type { AiToolRunRow, AppLocale, Database, Json } from '@/types/database.ts';

import {
  getCoachFunctionConfig,
  getMockCoachResponses,
  type CoachFunctionConfig,
} from './config.ts';
import { CoachToolRepository } from './tool-repository.ts';

type AppClient = SupabaseClient<Database>;

type SendRequest = {
  action: 'send';
  analysisId?: string;
  clientRequestId: string;
  conversationId?: string;
  localDate: string;
  message: string;
  timeZone: string;
};

type ResolveRequest = {
  action: 'confirm' | 'cancel';
  localDate: string;
  timeZone: string;
  toolRunId: string;
};

type CoachRequest = SendRequest | ResolveRequest;

type TurnClaim = {
  conversation_id: string;
  processing_token: string | null;
  should_process: boolean;
  user_message_id: string;
};

type ConfirmationClaim = {
  conversation_id: string;
  processing_token: string;
  tool_arguments: Json;
  tool_name: string;
};

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };
const uuidPattern =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { headers: jsonHeaders, status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseUuid(value: unknown, field: string, optional = false) {
  if (optional && value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }

  return value;
}

function parseRuntimeContext(value: Record<string, unknown>) {
  if (
    typeof value.localDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.localDate) ||
    typeof value.timeZone !== 'string' ||
    value.timeZone.length < 1 ||
    value.timeZone.length > 100
  ) {
    throw new Error('INVALID_RUNTIME_CONTEXT');
  }

  return { localDate: value.localDate, timeZone: value.timeZone };
}

function parseRequest(value: unknown): CoachRequest {
  if (!isRecord(value)) {
    throw new Error('INVALID_REQUEST_BODY');
  }

  const runtime = parseRuntimeContext(value);
  if (value.action === 'send') {
    if (
      typeof value.message !== 'string' ||
      value.message.trim().length < 1 ||
      value.message.trim().length > 2000
    ) {
      throw new Error('INVALID_MESSAGE');
    }

    return {
      action: 'send',
      analysisId: parseUuid(value.analysisId, 'analysis_id', true),
      clientRequestId: parseUuid(value.clientRequestId, 'client_request_id')!,
      conversationId: parseUuid(value.conversationId, 'conversation_id', true),
      ...runtime,
      message: value.message.trim(),
    };
  }

  if (value.action === 'confirm' || value.action === 'cancel') {
    return {
      action: value.action,
      ...runtime,
      toolRunId: parseUuid(value.toolRunId, 'tool_run_id')!,
    };
  }

  throw new Error('INVALID_ACTION');
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('AUTHENTICATION_REQUIRED');
  }

  return authorization.slice('Bearer '.length).trim();
}

function createUserClient(config: CoachFunctionConfig, token: string): AppClient {
  return createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function createAdminClient(config: CoachFunctionConfig): AppClient {
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

function sanitizeFailureCode(value: unknown) {
  const message = value instanceof Error ? value.message : String(value);
  const prefix = message
    .split(':', 1)[0]
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_');
  return (prefix || 'AI_COACH_FAILED').slice(0, 80);
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

async function fetchBundle(client: AppClient, conversationId: string) {
  const [conversationResult, messageResult, toolResult] = await Promise.all([
    client.from('ai_conversations').select('*').eq('id', conversationId).single(),
    client
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at')
      .order('id'),
    client
      .from('ai_tool_runs')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at')
      .order('id'),
  ]);
  const error = conversationResult.error ?? messageResult.error ?? toolResult.error;
  if (error || !conversationResult.data) {
    throw new Error(`CONVERSATION_QUERY_FAILED:${error?.message ?? 'missing conversation'}`);
  }

  return {
    conversation: conversationResult.data,
    messages: messageResult.data ?? [],
    toolRuns: toolResult.data ?? [],
  };
}

async function beginTurn(
  admin: AppClient,
  userId: string,
  request: SendRequest,
): Promise<TurnClaim> {
  const { data, error } = await admin.rpc('begin_ai_coach_turn', {
    request_user_id: userId,
    requested_conversation_id: request.conversationId ?? null,
    requested_source_analysis_id: request.analysisId ?? null,
    user_client_request_id: request.clientRequestId,
    user_message_content: request.message,
  });
  if (error || !data?.[0]) {
    throw new Error(`COACH_TURN_CLAIM_FAILED:${error?.message ?? 'empty result'}`);
  }

  return data[0];
}

async function fetchHistory(client: AppClient, conversationId: string) {
  const { data, error } = await client
    .from('ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(24);
  if (error) {
    throw new Error(`COACH_HISTORY_QUERY_FAILED:${error.message}`);
  }

  const newestFirst = data ?? [];
  const selected: typeof newestFirst = [];
  let characterCount = 0;
  for (const message of newestFirst) {
    if (selected.length > 0 && characterCount + message.content.length > 24000) {
      break;
    }
    selected.push(message);
    characterCount += message.content.length;
  }

  return selected
    .reverse()
    .map((message): CoachHistoryMessage => ({ content: message.content, role: message.role }));
}

async function fetchConversationContext(client: AppClient, conversationId: string) {
  const { data: conversation, error } = await client
    .from('ai_conversations')
    .select('*')
    .eq('id', conversationId)
    .single();
  if (error || !conversation) {
    throw new Error(`CONVERSATION_QUERY_FAILED:${error?.message ?? 'missing conversation'}`);
  }

  if (!conversation.source_analysis_id) {
    return null;
  }

  const { data: analysis, error: analysisError } = await client
    .from('ai_daily_analyses')
    .select('*')
    .eq('id', conversation.source_analysis_id)
    .maybeSingle();
  if (analysisError) {
    throw new Error(`SOURCE_ANALYSIS_QUERY_FAILED:${analysisError.message}`);
  }

  return analysis
    ? JSON.stringify({
        category: analysis.category,
        evidence: analysis.evidence,
        message: analysis.message,
        proposedAction: analysis.proposed_action,
        title: analysis.title,
      })
    : null;
}

async function completeTurn(
  admin: AppClient,
  userId: string,
  conversationId: string,
  processingToken: string,
  content: string,
  responseId: string | null,
) {
  const { data, error } = await admin.rpc('complete_ai_coach_turn', {
    assistant_message_content: content,
    request_user_id: userId,
    requested_conversation_id: conversationId,
    requested_processing_token: processingToken,
    response_id: responseId,
  });
  if (error || !data) {
    throw new Error(`COACH_TURN_COMPLETION_FAILED:${error?.message ?? 'empty result'}`);
  }

  return data;
}

async function failTurn(
  admin: AppClient,
  userId: string,
  conversationId: string,
  processingToken: string,
  code: string,
) {
  const { error } = await admin.rpc('fail_ai_coach_turn', {
    failure_code: code,
    request_user_id: userId,
    requested_conversation_id: conversationId,
    requested_processing_token: processingToken,
  });
  if (error) {
    console.error('ai-coach-failure-state-write-failed', {
      code: sanitizeFailureCode(error.message),
      conversationId,
    });
  }
}

async function createToolRun(
  admin: AppClient,
  userId: string,
  conversationId: string,
  tool: CoachToolArguments,
  call: CoachToolCall,
  responseId: string | null,
) {
  const kind = getCoachToolKind(tool.name);
  const { data, error } = await admin
    .from('ai_tool_runs')
    .insert({
      arguments: toJson(tool.arguments),
      conversation_id: conversationId,
      provider_call_id: call.callId,
      provider_response_id: responseId,
      status: 'running',
      tool_kind: kind,
      tool_name: tool.name,
      user_id: userId,
    })
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(`TOOL_AUDIT_CREATE_FAILED:${error?.message ?? 'empty result'}`);
  }

  return data;
}

async function recoverAuditedWrite(
  admin: AppClient,
  userId: string,
  claim: TurnClaim,
  locale: AppLocale,
  repository: CoachToolRepository,
) {
  const { data: userMessage, error: messageError } = await admin
    .from('ai_messages')
    .select('*')
    .eq('id', claim.user_message_id)
    .eq('user_id', userId)
    .single();
  if (messageError || !userMessage) {
    throw new Error('COACH_USER_MESSAGE_QUERY_FAILED');
  }

  const { data: toolRuns, error: toolError } = await admin
    .from('ai_tool_runs')
    .select('*')
    .eq('conversation_id', claim.conversation_id)
    .eq('user_id', userId)
    .gte('created_at', userMessage.created_at)
    .neq('tool_kind', 'read')
    .in('status', ['succeeded', 'awaiting_confirmation', 'running'])
    .order('created_at');
  if (toolError) {
    throw new Error(`COACH_WRITE_RECOVERY_QUERY_FAILED:${toolError.message}`);
  }
  let recoveredRuns = toolRuns ?? [];
  if (!recoveredRuns.length) {
    return null;
  }

  const running = recoveredRuns.find((toolRun) => toolRun.status === 'running');
  if (running) {
    if (Date.now() - new Date(running.updated_at).getTime() < 2 * 60 * 1000) {
      throw new Error('COACH_WRITE_IS_STILL_PROCESSING');
    }

    try {
      const tool = parseCoachToolArguments(running.tool_name, JSON.stringify(running.arguments));
      const operation = await repository.execute(tool, running.id);
      const persistent = isPersistentTool(tool);
      const recovered = await updateToolRun(admin, running.id, {
        completed_at: persistent ? null : new Date().toISOString(),
        confirmation_summary: operation.confirmationSummary,
        error_code: null,
        high_level_change: operation.highLevelChange,
        result:
          getCoachToolKind(tool.name) === 'read' ? { success: true } : toJson(operation.result),
        status: persistent ? 'awaiting_confirmation' : 'succeeded',
      });
      recoveredRuns = recoveredRuns.map((toolRun) =>
        toolRun.id === recovered.id ? recovered : toolRun,
      );
    } catch (error) {
      await updateToolRun(admin, running.id, {
        completed_at: new Date().toISOString(),
        error_code: sanitizeFailureCode(error),
        status: 'failed',
      });
      return null;
    }
  }

  const pending =
    recoveredRuns.find((toolRun) => toolRun.status === 'awaiting_confirmation') ?? null;
  const changes = recoveredRuns
    .map((toolRun) => toolRun.high_level_change)
    .filter((value): value is string => Boolean(value));
  const content = pending?.confirmation_summary
    ? locale === 'pl'
      ? `Ta zmiana czeka na Twoje potwierdzenie: ${pending.confirmation_summary}`
      : `This change is waiting for your confirmation: ${pending.confirmation_summary}`
    : changes.length > 0
      ? changes.join('\n')
      : locale === 'pl'
        ? 'Żądana zmiana została już wykonana.'
        : 'The requested change was already completed.';
  const message = await completeTurn(
    admin,
    userId,
    claim.conversation_id,
    claim.processing_token!,
    content,
    null,
  );
  if (pending) {
    await updateToolRun(admin, pending.id, { assistant_message_id: message.id });
  }

  return message;
}

async function updateToolRun(admin: AppClient, toolRunId: string, update: Partial<AiToolRunRow>) {
  const { data, error } = await admin
    .from('ai_tool_runs')
    .update(update)
    .eq('id', toolRunId)
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(`TOOL_AUDIT_UPDATE_FAILED:${error?.message ?? 'empty result'}`);
  }

  return data;
}

function createMockResponseCreator(responses: readonly unknown[]) {
  let index = 0;
  return async (_request: CoachResponseRequest): Promise<CoachModelResponse> => {
    const response = responses[index];
    index += 1;
    if (!isRecord(response)) {
      throw new Error('INVALID_AI_COACH_MOCK_RESPONSE');
    }

    return response as CoachModelResponse;
  };
}

function isPersistentTool(
  tool: CoachToolArguments,
): tool is Extract<
  CoachToolArguments,
  { name: 'create_workout_plan' | 'update_workout_plan' | 'update_nutrition_adjustment' }
> {
  return getCoachToolKind(tool.name) === 'persistent_write';
}

async function handleSend(
  config: CoachFunctionConfig,
  userClient: AppClient,
  admin: AppClient,
  userId: string,
  request: SendRequest,
) {
  const claim = await beginTurn(admin, userId, request);
  if (!claim.should_process) {
    return jsonResponse({
      ...(await fetchBundle(userClient, claim.conversation_id)),
      outcome: 'existing',
    });
  }

  const processingToken = claim.processing_token!;
  let pendingToolRunId: string | null = null;
  try {
    if (config.mode === 'disabled') {
      throw new Error('AI_COACH_DISABLED');
    }

    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (profileError || !profile) {
      throw new Error(`PROFILE_QUERY_FAILED:${profileError?.message ?? 'missing profile'}`);
    }

    const repository = new CoachToolRepository(
      userClient,
      userId,
      request.localDate,
      request.timeZone,
    );
    const recoveredWrite = await recoverAuditedWrite(
      admin,
      userId,
      claim,
      profile.locale,
      repository,
    );
    if (recoveredWrite) {
      return jsonResponse({
        ...(await fetchBundle(userClient, claim.conversation_id)),
        outcome: 'completed',
      });
    }

    const [history, analysisContext] = await Promise.all([
      fetchHistory(userClient, claim.conversation_id),
      fetchConversationContext(userClient, claim.conversation_id),
    ]);
    let createResponse;
    if (config.mode === 'mock') {
      createResponse = createMockResponseCreator(getMockCoachResponses());
    } else {
      const openAi = new OpenAI({ apiKey: config.openAiApiKey! });
      createResponse = async (modelRequest: CoachResponseRequest): Promise<CoachModelResponse> => {
        const response = (await openAi.responses.create(
          modelRequest as unknown as Parameters<typeof openAi.responses.create>[0],
        )) as unknown as CoachModelResponse;
        return {
          id: response.id,
          output: response.output,
          output_text: response.output_text,
          status: response.status,
        };
      };
    }

    const result = await runCoachTurn(
      createResponse,
      async (tool, call, responseId) => {
        const audit = await createToolRun(
          admin,
          userId,
          claim.conversation_id,
          tool,
          call,
          responseId,
        );
        try {
          const operation = await repository.execute(tool, audit.id);
          const persistent = isPersistentTool(tool);
          const status = persistent ? 'awaiting_confirmation' : 'succeeded';
          await updateToolRun(admin, audit.id, {
            completed_at: persistent ? null : new Date().toISOString(),
            confirmation_summary: operation.confirmationSummary,
            high_level_change: operation.highLevelChange,
            result:
              getCoachToolKind(tool.name) === 'read' ? { success: true } : toJson(operation.result),
            status,
          });
          if (persistent) {
            pendingToolRunId = audit.id;
          }
          if (config.logToolResults) {
            console.info('ai-coach-tool-result', {
              conversationId: claim.conversation_id,
              result: operation.result,
              tool: tool.name,
            });
          }

          return {
            kind: getCoachToolKind(tool.name),
            pendingConfirmation: persistent,
            result: operation.result,
            tool,
          };
        } catch (error) {
          const code = sanitizeFailureCode(error);
          await updateToolRun(admin, audit.id, {
            completed_at: new Date().toISOString(),
            error_code: code,
            result: { error: code, success: false },
            status: 'failed',
          });
          return {
            kind: getCoachToolKind(tool.name),
            pendingConfirmation: false,
            result: { error: code, success: false },
            tool,
          };
        }
      },
      config.openAiModel ?? 'mock-coach',
      history,
      {
        analysisContext,
        appLocale: profile.locale,
        displayWeightUnit: profile.preferred_weight_unit,
        localDate: request.localDate,
      },
    );

    const message = await completeTurn(
      admin,
      userId,
      claim.conversation_id,
      processingToken,
      result.text,
      result.responseId,
    );
    if (pendingToolRunId) {
      await updateToolRun(admin, pendingToolRunId, { assistant_message_id: message.id });
    }

    return jsonResponse({
      ...(await fetchBundle(userClient, claim.conversation_id)),
      outcome: 'completed',
    });
  } catch (error) {
    const code = sanitizeFailureCode(error);
    await failTurn(admin, userId, claim.conversation_id, processingToken, code);
    console.error('ai-coach-turn-failed', { code, conversationId: claim.conversation_id });
    return jsonResponse({ error: code }, code === 'AI_COACH_DISABLED' ? 503 : 500);
  }
}

async function claimConfirmation(admin: AppClient, userId: string, toolRunId: string) {
  const { data, error } = await admin.rpc('claim_ai_coach_confirmation', {
    request_user_id: userId,
    requested_tool_run_id: toolRunId,
  });
  if (error || !data?.[0]) {
    throw new Error(`COACH_CONFIRMATION_CLAIM_FAILED:${error?.message ?? 'empty result'}`);
  }

  return data[0] as ConfirmationClaim;
}

function resolutionText(locale: AppLocale, action: 'cancel' | 'failure', change?: string | null) {
  if (action === 'cancel') {
    return locale === 'pl'
      ? 'Anulowano. Żadna trwała zmiana nie została wprowadzona.'
      : 'Cancelled. No persistent change was made.';
  }

  return locale === 'pl'
    ? `Nie udało się zastosować tej zmiany${change ? `: ${change}` : '.'}`
    : `I couldn't apply that change${change ? `: ${change}` : '.'}`;
}

async function handleResolution(
  userClient: AppClient,
  admin: AppClient,
  userId: string,
  request: ResolveRequest,
) {
  const { data: existingRun, error: existingRunError } = await userClient
    .from('ai_tool_runs')
    .select('*')
    .eq('id', request.toolRunId)
    .single();
  if (existingRunError || !existingRun) {
    throw new Error('PENDING_COACH_ACTION_NOT_FOUND');
  }

  if (['succeeded', 'failed', 'cancelled'].includes(existingRun.status)) {
    return jsonResponse({
      ...(await fetchBundle(userClient, existingRun.conversation_id)),
      outcome: 'existing',
    });
  }

  const runningRecently =
    existingRun.status === 'running' &&
    Date.now() - new Date(existingRun.updated_at).getTime() < 2 * 60 * 1000;
  if (runningRecently) {
    return jsonResponse(
      {
        ...(await fetchBundle(userClient, existingRun.conversation_id)),
        outcome: 'processing',
      },
      202,
    );
  }

  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (profileError || !profile) {
    throw new Error('PROFILE_QUERY_FAILED');
  }
  const claim = await claimConfirmation(admin, userId, request.toolRunId);

  if (request.action === 'cancel') {
    await updateToolRun(admin, request.toolRunId, {
      cancelled_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      status: 'cancelled',
    });
    await completeTurn(
      admin,
      userId,
      claim.conversation_id,
      claim.processing_token,
      resolutionText(profile.locale, 'cancel'),
      null,
    );
    return jsonResponse({
      ...(await fetchBundle(userClient, claim.conversation_id)),
      outcome: 'cancelled',
    });
  }

  try {
    const tool = parseCoachToolArguments(claim.tool_name, JSON.stringify(claim.tool_arguments));
    if (!isPersistentTool(tool)) {
      throw new Error('CONFIRMATION_TOOL_IS_NOT_PERSISTENT');
    }
    const repository = new CoachToolRepository(
      userClient,
      userId,
      request.localDate,
      request.timeZone,
    );
    const operation = await repository.executePersistent(tool, request.toolRunId);
    await updateToolRun(admin, request.toolRunId, {
      completed_at: new Date().toISOString(),
      high_level_change: operation.highLevelChange,
      result: toJson(operation.result),
      status: 'succeeded',
    });
    await completeTurn(
      admin,
      userId,
      claim.conversation_id,
      claim.processing_token,
      operation.highLevelChange ?? (profile.locale === 'pl' ? 'Zastosowano zmianę.' : 'Applied.'),
      null,
    );
    return jsonResponse({
      ...(await fetchBundle(userClient, claim.conversation_id)),
      outcome: 'confirmed',
    });
  } catch (error) {
    const code = sanitizeFailureCode(error);
    await updateToolRun(admin, request.toolRunId, {
      completed_at: new Date().toISOString(),
      error_code: code,
      result: { error: code, success: false },
      status: 'failed',
    });
    await completeTurn(
      admin,
      userId,
      claim.conversation_id,
      claim.processing_token,
      resolutionText(profile.locale, 'failure'),
      null,
    );
    return jsonResponse({
      ...(await fetchBundle(userClient, claim.conversation_id)),
      outcome: 'confirmed',
    });
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  try {
    const config = getCoachFunctionConfig();
    const token = getBearerToken(request);
    const userClient = createUserClient(config, token);
    const user = await authenticateUser(userClient, token);
    const body = parseRequest(await request.json());
    if (!isCurrentDateInTimeZone(body.localDate, body.timeZone)) {
      return jsonResponse({ error: 'LOCAL_DATE_MUST_BE_CURRENT' }, 400);
    }

    const admin = createAdminClient(config);
    return body.action === 'send'
      ? await handleSend(config, userClient, admin, user.id, body)
      : await handleResolution(userClient, admin, user.id, body);
  } catch (error) {
    const code = sanitizeFailureCode(error);
    const status =
      code === 'AUTHENTICATION_REQUIRED' ? 401 : code.startsWith('INVALID_') ? 400 : 500;
    console.error('ai-coach-request-failed', { code });
    return jsonResponse({ error: code }, status);
  }
});
