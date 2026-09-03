import type {
  CoachConversationBundle,
  CoachMutationResponse,
  ResolveCoachToolInput,
  SendCoachMessageInput,
} from '@/features/ai/coach-types';
import { getSupabaseClient } from '@/services/supabase/get-client';
import type { AiConversationRow } from '@/types/database';

export async function fetchCoachConversations(): Promise<AiConversationRow[]> {
  const { data, error } = await getSupabaseClient()
    .from('ai_conversations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(30);
  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function fetchCoachConversation(
  conversationId: string,
): Promise<CoachConversationBundle> {
  const client = getSupabaseClient();
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
    throw error ?? new Error('COACH_CONVERSATION_NOT_FOUND');
  }

  return {
    conversation: conversationResult.data,
    messages: messageResult.data ?? [],
    toolRuns: toolResult.data ?? [],
  };
}

export async function sendCoachMessage(
  input: SendCoachMessageInput,
): Promise<CoachMutationResponse> {
  const { data, error } = await getSupabaseClient().functions.invoke<CoachMutationResponse>(
    'ai-coach',
    {
      body: {
        action: 'send',
        analysisId: input.analysisId,
        clientRequestId: input.clientRequestId,
        conversationId: input.conversationId,
        localDate: input.localDate,
        message: input.message,
        timeZone: input.timeZone,
      },
    },
  );
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('COACH_EMPTY_RESPONSE');
  }
  if (data.outcome === 'existing' && data.conversation.status === 'processing') {
    throw new Error('COACH_STILL_PROCESSING');
  }

  return data;
}

async function resolveCoachTool(
  action: 'confirm' | 'cancel',
  input: ResolveCoachToolInput,
): Promise<CoachMutationResponse> {
  const { data, error } = await getSupabaseClient().functions.invoke<CoachMutationResponse>(
    'ai-coach',
    {
      body: {
        action,
        localDate: input.localDate,
        timeZone: input.timeZone,
        toolRunId: input.toolRunId,
      },
    },
  );
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('COACH_EMPTY_RESPONSE');
  }

  return data;
}

export function confirmCoachTool(input: ResolveCoachToolInput) {
  return resolveCoachTool('confirm', input);
}

export function cancelCoachTool(input: ResolveCoachToolInput) {
  return resolveCoachTool('cancel', input);
}

export function createCoachRequestId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
