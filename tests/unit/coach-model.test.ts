import assert from 'node:assert/strict';
import test from 'node:test';

import {
  runCoachTurn,
  type CoachModelResponse,
  type CoachResponseRequest,
} from '../../src/features/ai/coach-model';

const context = {
  analysisContext: null,
  appLocale: 'en' as const,
  displayWeightUnit: 'kg' as const,
  localDate: '2026-09-02',
};

test('runs a read tool and returns a final answer without a paid call', async () => {
  const requests: CoachResponseRequest[] = [];
  const responses: CoachModelResponse[] = [
    {
      id: 'response-1',
      output: [
        {
          arguments: '{}',
          call_id: 'call-1',
          name: 'get_weight_trend',
          type: 'function_call',
        },
      ],
      status: 'completed',
    },
    {
      id: 'response-2',
      output: [],
      output_text: 'Your rolling average is stable.',
      status: 'completed',
    },
  ];
  let responseIndex = 0;
  const result = await runCoachTurn(
    async (request) => {
      requests.push(request);
      return responses[responseIndex++];
    },
    async (tool) => ({
      kind: 'read',
      pendingConfirmation: false,
      result: { weeklyRate: { kg: 0.1 } },
      tool,
    }),
    'configured-agent-model',
    [{ content: 'How is my weight trend?', role: 'user' }],
    context,
  );

  assert.equal(result.text, 'Your rolling average is stable.');
  assert.equal(result.responseId, 'response-2');
  assert.equal(requests[0].model, 'configured-agent-model');
  assert.equal(requests[0].store, false);
  assert.equal(requests[0].parallel_tool_calls, false);
  assert.deepEqual(requests[0].include, ['reasoning.encrypted_content']);
  assert.equal((requests[1].input.at(-1) as { type: string }).type, 'function_call_output');
});

test('stops tool access after staging a persistent action', async () => {
  const planId = '11111111-1111-4111-8111-111111111111';
  const exerciseId = '22222222-2222-4222-8222-222222222222';
  const requests: CoachResponseRequest[] = [];
  const responses: CoachModelResponse[] = [
    {
      id: 'proposal-call',
      output: [
        {
          arguments: JSON.stringify({
            exerciseIds: [exerciseId],
            name: 'Upper',
            workoutPlanId: planId,
          }),
          call_id: 'call-plan',
          name: 'update_workout_plan',
          type: 'function_call',
        },
      ],
      status: 'completed',
    },
    {
      id: 'proposal-message',
      output: [],
      output_text: 'I prepared the permanent plan change for confirmation.',
      status: 'completed',
    },
  ];
  let responseIndex = 0;
  const result = await runCoachTurn(
    async (request) => {
      requests.push(request);
      return responses[responseIndex++];
    },
    async (tool) => ({
      kind: 'persistent_write',
      pendingConfirmation: true,
      result: { confirmationRequired: true },
      tool,
    }),
    'configured-agent-model',
    [{ content: 'Apply that permanently.', role: 'user' }],
    context,
  );

  assert.equal(result.pendingConfirmation, true);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].tools.length > 0, true);
  assert.equal(requests[1].tools.length, 0);
});

test('rejects multiple tool calls in one response', async () => {
  await assert.rejects(
    runCoachTurn(
      async () => ({
        output: [
          { arguments: '{}', call_id: 'one', name: 'get_today_context', type: 'function_call' },
          { arguments: '{}', call_id: 'two', name: 'get_weight_trend', type: 'function_call' },
        ],
        status: 'completed',
      }),
      async (tool) => ({ kind: 'read', pendingConfirmation: false, result: {}, tool }),
      'configured-agent-model',
      [{ content: 'Check both.', role: 'user' }],
      context,
    ),
    /OPENAI_MULTIPLE_TOOL_CALLS/,
  );
});
