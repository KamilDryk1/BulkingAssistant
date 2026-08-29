import { useMutation, useQueryClient } from '@tanstack/react-query';

import { setAppLocale } from '@/i18n';

import {
  completeOnboarding,
  type CompleteOnboardingInput,
  updateProfile,
  type UpdateProfileInput,
} from './profile-service';

export const profileKeys = {
  all: ['profile'] as const,
  detail: (userId: string) => [...profileKeys.all, userId] as const,
};

export function useCompleteOnboarding(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CompleteOnboardingInput) => completeOnboarding(input),
    onSuccess: async (profile) => {
      queryClient.setQueryData(profileKeys.detail(userId), profile);
      await setAppLocale(profile.locale);
    },
  });
}

export function useUpdateProfile(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(userId, input),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKeys.detail(userId), profile);
    },
  });
}
