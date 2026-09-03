import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bodyKeys } from '@/features/body/body-query-keys';
import { profileKeys } from '@/features/profile/profile-queries';
import { progressKeys } from '@/features/progress/progress-query-keys';
import { todayKeys } from '@/features/today/today-queries';
import { trainingKeys } from '@/features/training/training-queries';
import { workoutKeys } from '@/features/workout/workout-queries';
import {
  cancelCoachTool,
  confirmCoachTool,
  fetchCoachConversation,
  fetchCoachConversations,
  sendCoachMessage,
} from '@/services/ai/coach-service';

import type { ResolveCoachToolInput, SendCoachMessageInput } from './coach-types';

export const coachKeys = {
  all: ['ai-coach'] as const,
  conversation: (conversationId: string) =>
    [...coachKeys.all, 'conversation', conversationId] as const,
  conversations: () => [...coachKeys.all, 'conversations'] as const,
};

export function useCoachConversations(enabled = true) {
  return useQuery({
    enabled,
    queryFn: fetchCoachConversations,
    queryKey: coachKeys.conversations(),
  });
}

export function useCoachConversation(conversationId: string) {
  return useQuery({
    enabled: Boolean(conversationId),
    queryFn: () => fetchCoachConversation(conversationId),
    queryKey: coachKeys.conversation(conversationId),
  });
}

function useHandleCoachMutationSuccess() {
  const queryClient = useQueryClient();

  return async (response: Awaited<ReturnType<typeof sendCoachMessage>>) => {
    queryClient.setQueryData(coachKeys.conversation(response.conversation.id), response);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: coachKeys.conversations() }),
      queryClient.invalidateQueries({ queryKey: todayKeys.all }),
      queryClient.invalidateQueries({ queryKey: trainingKeys.all }),
      queryClient.invalidateQueries({ queryKey: workoutKeys.all }),
      queryClient.invalidateQueries({ queryKey: bodyKeys.all }),
      queryClient.invalidateQueries({ queryKey: progressKeys.all }),
      queryClient.invalidateQueries({ queryKey: profileKeys.all }),
    ]);
  };
}

export function useSendCoachMessage() {
  const handleSuccess = useHandleCoachMutationSuccess();

  return useMutation({
    mutationFn: (input: SendCoachMessageInput) => sendCoachMessage(input),
    onSuccess: handleSuccess,
  });
}

export function useConfirmCoachTool() {
  const handleSuccess = useHandleCoachMutationSuccess();

  return useMutation({
    mutationFn: (input: ResolveCoachToolInput) => confirmCoachTool(input),
    onSuccess: handleSuccess,
  });
}

export function useCancelCoachTool() {
  const handleSuccess = useHandleCoachMutationSuccess();

  return useMutation({
    mutationFn: (input: ResolveCoachToolInput) => cancelCoachTool(input),
    onSuccess: handleSuccess,
  });
}
