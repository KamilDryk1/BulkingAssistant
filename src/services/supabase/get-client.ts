import { supabase } from './client';

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  return supabase;
}
