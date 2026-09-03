export type CoachMode = 'disabled' | 'live' | 'mock';

export type CoachFunctionConfig = {
  logToolResults: boolean;
  mode: CoachMode;
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

function readMode(): CoachMode {
  const value = Deno.env.get('AI_COACH_MODE')?.trim().toLowerCase() ?? 'live';
  if (value === 'disabled' || value === 'live' || value === 'mock') {
    return value;
  }

  throw new Error('INVALID_AI_COACH_MODE');
}

export function getCoachFunctionConfig(): CoachFunctionConfig {
  const mode = readMode();

  return {
    logToolResults: Deno.env.get('AI_COACH_LOG_TOOL_RESULTS')?.trim().toLowerCase() === 'true',
    mode,
    openAiApiKey: mode === 'live' ? requireEnvironmentVariable('OPENAI_API_KEY') : null,
    openAiModel: mode === 'live' ? requireEnvironmentVariable('OPENAI_AGENT_MODEL') : null,
    supabaseAnonKey: requireEnvironmentVariable('SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: requireEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY'),
    supabaseUrl: requireEnvironmentVariable('SUPABASE_URL'),
  };
}

export function getMockCoachResponses() {
  const value = requireEnvironmentVariable('AI_COACH_MOCK_RESPONSES');
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('INVALID_AI_COACH_MOCK_RESPONSES');
  }

  return parsed;
}
