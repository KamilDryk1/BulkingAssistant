export type DailyAnalysisMode = 'disabled' | 'live' | 'mock';

export type DailyAnalysisFunctionConfig = {
  allowDebugReset: boolean;
  logContext: boolean;
  mode: DailyAnalysisMode;
  openAiApiKey: string | null;
  openAiModel: string | null;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  supabaseUrl: string;
};

function requireEnvironmentVariable(name: string) {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`MISSING_${name}`);
  }

  return value;
}

function readBoolean(name: string) {
  return Deno.env.get(name)?.trim().toLowerCase() === 'true';
}

function readMode(): DailyAnalysisMode {
  const value = Deno.env.get('AI_DAILY_ANALYSIS_MODE')?.trim().toLowerCase() ?? 'live';

  if (value === 'disabled' || value === 'live' || value === 'mock') {
    return value;
  }

  throw new Error('INVALID_AI_DAILY_ANALYSIS_MODE');
}

export function getDailyAnalysisFunctionConfig(): DailyAnalysisFunctionConfig {
  const mode = readMode();

  return {
    allowDebugReset: readBoolean('AI_DAILY_ANALYSIS_ALLOW_DEBUG_RESET'),
    logContext: readBoolean('AI_DAILY_ANALYSIS_LOG_CONTEXT'),
    mode,
    openAiApiKey: mode === 'live' ? requireEnvironmentVariable('OPENAI_API_KEY') : null,
    openAiModel: mode === 'live' ? requireEnvironmentVariable('OPENAI_DAILY_ANALYSIS_MODEL') : null,
    supabaseAnonKey: requireEnvironmentVariable('SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: requireEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY'),
    supabaseUrl: requireEnvironmentVariable('SUPABASE_URL'),
  };
}

export function getMockDailyAnalysisJson() {
  return requireEnvironmentVariable('AI_DAILY_ANALYSIS_MOCK_RESULT');
}
