import { dailyAnalysisJsonSchema, parseDailyAnalysisJson } from './daily-analysis-schema.ts';
import type { DailyAnalysisContext, DailyAnalysisResult } from './daily-analysis-types.ts';

export type DailyAnalysisModelResponse = {
  id?: string;
  output_text?: string;
  status?: string;
};

export type DailyAnalysisResponseCreator = (
  request: ReturnType<typeof buildDailyAnalysisRequest>,
) => Promise<DailyAnalysisModelResponse>;

const systemInstructions = `You are the automatic daily analysis layer in a fitness application.

Return a suggestion only when the supplied structured metrics show a meaningful situation that deserves the user's attention. Most normal days should be no_action. Never manufacture motivation or advice merely because you were called.

Use body-weight trends and rolling averages, never one measurement. Require repeated comparable strength observations before calling something a plateau or decline. Distinguish one exercise from a broad program issue. Respect the user's goal, recent goal or training changes, data-sufficiency flags, adherence, and activity changes. Make conservative adjustments, acknowledge uncertainty through confidence, and prefer no_action when evidence is weak or mixed.

Do not diagnose medical conditions or injuries. Do not claim that anything was changed. Do not return database IDs, commands, markdown, or fields outside the schema. Calorie adjustments, when truly justified, must be a non-zero 50 kcal step no larger than 300 kcal in either direction. Use review actions for non-nutrition suggestions.

Write user-facing title, message, and evidence in natural Polish when locale is pl and natural English when locale is en. Keep custom exercise and activity names exactly as supplied. Use only the preformatted display values when citing body weight so unit conversion remains deterministic.`;

export function buildDailyAnalysisRequest(model: string, context: DailyAnalysisContext) {
  return {
    input: `Analyze this compact, deterministic context:\n${JSON.stringify(context)}`,
    instructions: systemInstructions,
    max_output_tokens: 1200,
    model,
    reasoning: { effort: 'low' as const },
    store: false,
    text: {
      format: {
        description: 'A conservative daily fitness analysis result.',
        name: 'daily_fitness_analysis',
        schema: dailyAnalysisJsonSchema,
        strict: true,
        type: 'json_schema' as const,
      },
      verbosity: 'low' as const,
    },
  };
}

export async function runDailyAnalysisModel(
  createResponse: DailyAnalysisResponseCreator,
  model: string,
  context: DailyAnalysisContext,
): Promise<{ responseId: string | null; result: DailyAnalysisResult }> {
  const response = await createResponse(buildDailyAnalysisRequest(model, context));

  if (response.status && response.status !== 'completed') {
    throw new Error('OPENAI_INCOMPLETE_RESPONSE');
  }

  if (!response.output_text) {
    throw new Error('OPENAI_EMPTY_RESPONSE');
  }

  return {
    responseId: response.id ?? null,
    result: parseDailyAnalysisJson(response.output_text),
  };
}
