import type { SupportedLocale } from '@/i18n';
import { getSupabaseClient } from '@/services/supabase/get-client';

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signUpWithPassword(email: string, password: string, locale: SupportedLocale) {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email: email.trim(),
    options: { data: { locale } },
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOut() {
  const { error } = await getSupabaseClient().auth.signOut();

  if (error) {
    throw error;
  }
}
