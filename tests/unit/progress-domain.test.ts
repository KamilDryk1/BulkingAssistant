import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProgressSessionPoints,
  calculateEstimatedOneRepMax,
  getProgressPeriodStartDate,
  getProgressSummary,
  selectBestCompletedSet,
} from '../../src/features/progress/progress-domain';
import type { ProgressSetSource } from '../../src/features/progress/progress-types';

function createSet(
  setId: string,
  sessionId: string,
  sessionDate: string,
  weightKg: number,
  reps: number,
  completed = true,
): ProgressSetSource {
  return {
    completedAt: completed ? `${sessionDate}T11:00:00.000Z` : null,
    exerciseId: 'bench-press',
    reps,
    sessionDate,
    sessionId,
    sessionStartedAt: `${sessionDate}T10:00:00.000Z`,
    setId,
    weightKg,
  };
}

test('calculates estimated 1RM with the Epley formula', () => {
  assert.equal(calculateEstimatedOneRepMax(60, 10), 80);
  assert.equal(calculateEstimatedOneRepMax(90, 5), 105);
});

test('selects the heaviest completed set and uses reps as the tie breaker', () => {
  const bestSet = selectBestCompletedSet([
    createSet('unfinished', 'session-1', '2026-08-01', 100, 1, false),
    createSet('lighter', 'session-1', '2026-08-01', 60, 12),
    createSet('fewer-reps', 'session-1', '2026-08-01', 70, 5),
    createSet('winner', 'session-1', '2026-08-01', 70, 7),
  ]);

  assert.deepEqual(bestSet, { reps: 7, setId: 'winner', weightKg: 70 });
});

test('builds one chronological point per session from completed sets only', () => {
  const points = buildProgressSessionPoints(
    [
      createSet('later-heavy', 'session-2', '2026-08-20', 70, 5),
      createSet('earlier-volume', 'session-1', '2026-08-01', 60, 10),
      createSet('earlier-heavy', 'session-1', '2026-08-01', 65, 5),
      createSet('ignored', 'session-2', '2026-08-20', 100, 10, false),
    ],
    'bench-press',
  );

  assert.equal(points.length, 2);
  assert.equal(points[0].sessionId, 'session-1');
  assert.equal(points[0].bestSet.setId, 'earlier-heavy');
  assert.equal(points[0].estimatedOneRepMaxKg, 80);
  assert.equal(points[1].estimatedOneRepMaxSet.setId, 'later-heavy');
});

test('summarizes estimated 1RM change between the first and latest recent session', () => {
  const points = buildProgressSessionPoints(
    [
      createSet('first', 'session-1', '2026-08-01', 60, 10),
      createSet('latest', 'session-2', '2026-08-20', 75, 5),
    ],
    'bench-press',
  );
  const summary = getProgressSummary(points, 'estimatedOneRepMax');

  assert.equal(summary.current?.valueKg, 87.5);
  assert.deepEqual(summary.trend, { kind: 'weight', valueKg: 7.5 });
});

test('reports a reps trend when best-set weight stays the same', () => {
  const points = buildProgressSessionPoints(
    [
      createSet('first', 'session-1', '2026-08-01', 70, 5),
      createSet('latest', 'session-2', '2026-08-20', 70, 8),
    ],
    'bench-press',
  );

  assert.deepEqual(getProgressSummary(points, 'bestSet').trend, { kind: 'reps', value: 3 });
});

test('calculates the inclusive start of an eight-week period', () => {
  assert.equal(getProgressPeriodStartDate('2026-08-30'), '2026-07-06');
});
