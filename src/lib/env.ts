type SupabaseEnvironment =
  | {
      configured: true;
      key: string;
      url: string;
    }
  | {
      configured: false;
      missing: readonly string[];
    };

function getSupabaseEnvironment(): SupabaseEnvironment {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const missing = [
    !url ? 'EXPO_PUBLIC_SUPABASE_URL' : null,
    !key ? 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY' : null,
  ].filter((value): value is string => Boolean(value));

  if (missing.length > 0 || !key || !url) {
    return { configured: false, missing };
  }

  return { configured: true, key, url };
}

export const env = {
  supabase: getSupabaseEnvironment(),
} as const;
