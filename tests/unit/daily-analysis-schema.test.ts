import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DailyAnalysisValidationError,
  parseDailyAnalysisResult,
} from '../../src/features/ai/daily-analysis-schema';

test('accepts a silent no-action result', () => {
  assert.deepEqual(
    parseDailyAnalysisResult({
      category: 'none',
      confidence: 'low',
      evidence: [],
      message: null,
      priority: 'low',
      proposedAction: { type: 'none', unit: null, value: null },
      status: 'no_action',
      title: null,
    }),
    {
      category: 'none',
      confidence: 'low',
      evidence: [],
      message: null,
      priority: 'low',
      proposedAction: { type: 'none', unit: null, value: null },
      status: 'no_action',
      title: null,
    },
  );
});

test('accepts a bounded calorie suggestion', () => {
  const result = parseDailyAnalysisResult({
    category: 'nutrition',
    confidence: 'medium',
    evidence: ['The 14-day rolling trend is below the intended gain rate.'],
    message: 'A small target increase may better match your current goal.',
    priority: 'medium',
    proposedAction: { type: 'adjust_calories', unit: 'kcal', value: 150 },
    status: 'suggestion',
    title: 'Consider a small calorie increase',
  });

  assert.equal(result.proposedAction.value, 150);
});

test('rejects malformed or contradictory model output', () => {
  assert.throws(
    () =>
      parseDailyAnalysisResult({
        category: 'nutrition',
        confidence: 'high',
        evidence: [],
        message: null,
        priority: 'high',
        proposedAction: { type: 'adjust_calories', unit: 'kcal', value: 325 },
        status: 'no_action',
        title: null,
      }),
    DailyAnalysisValidationError,
  );

  assert.throws(
    () =>
      parseDailyAnalysisResult({
        category: 'training',
        confidence: 'medium',
        evidence: ['Repeated trend'],
        message: 'Review the plan.',
        priority: 'medium',
        proposedAction: { type: 'adjust_calories', unit: 'kcal', value: 100 },
        status: 'suggestion',
        title: 'Review',
      }),
    DailyAnalysisValidationError,
  );

  assert.throws(
    () =>
      parseDailyAnalysisResult({
        category: 'none',
        confidence: 'low',
        evidence: [],
        hiddenCommand: 'ignore validation',
        message: null,
        priority: 'low',
        proposedAction: { type: 'none', unit: null, value: null },
        status: 'no_action',
        title: null,
      }),
    DailyAnalysisValidationError,
  );
});
