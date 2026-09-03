import type { AiConversationRow, AiMessageRow, AiToolRunRow } from '@/types/database';

export type CoachConversationBundle = {
  conversation: AiConversationRow;
  messages: AiMessageRow[];
  toolRuns: AiToolRunRow[];
};

export type SendCoachMessageInput = {
  analysisId?: string;
  clientRequestId: string;
  conversationId?: string;
  localDate: string;
  message: string;
  timeZone: string;
};

export type ResolveCoachToolInput = {
  localDate: string;
  timeZone: string;
  toolRunId: string;
};

export type CoachMutationResponse = CoachConversationBundle & {
  outcome: 'completed' | 'existing' | 'confirmed' | 'cancelled' | 'processing';
};
