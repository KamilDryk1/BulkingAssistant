import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDailyAnalysisContext } from '../../src/features/ai/daily-analysis-domain';
import { runDailyAnalysisModel } from '../../src/features/ai/daily-analysis-model';

const context = buildDailyAnalysisContext({
  activities: [],
  analysisDate: '2026-08-28',
  completedWorkouts: [],
  displayWeightUnit: 'kg',
  goal: 'gain',
  goalChangedDate: null,
  locale: 'en',
  nutrition: null,
  plannedWorkouts: [],
  strengthSets: [],
  trainingChangedDate: null,
  weights: [],
});

test('uses the configured model and strict Responses schema without a paid call', async () => {
  let requestSeen: Parameters<typeof runDailyAnalysisModel>[0] extends (
    request: infer Request,
  ) => Promise<unknown>
    ? Request
    : never;
  const response = await runDailyAnalysisModel(
    async (request) => {
      requestSeen = request;
      return {
        id: 'response-test',
        output_text: JSON.stringify({
          category: 'none',
          confidence: 'low',
          evidence: [],
          message: null,
          priority: 'low',
          proposedAction: { type: 'none', unit: null, value: null },
          status: 'no_action',
          title: null,
        }),
        status: 'completed',
      };
    },
    'configured-test-model',
    context,
  );

  assert.equal(requestSeen!.model, 'configured-test-model');
  assert.equal(requestSeen!.store, false);
  assert.equal(requestSeen!.text.format.type, 'json_schema');
  assert.equal(requestSeen!.text.format.strict, true);
  assert.equal(response.responseId, 'response-test');
  assert.equal(response.result.status, 'no_action');
});

test('rejects invalid mock output before it can be persisted', async () => {
  await assert.rejects(
    runDailyAnalysisModel(
      async () => ({ output_text: '{"status":"suggestion"}', status: 'completed' }),
      'configured-test-model',
      context,
    ),
  );
});
