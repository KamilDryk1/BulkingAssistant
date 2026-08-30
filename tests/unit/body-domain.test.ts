import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateWeightTrend,
  selectLatestWeightPerDay,
  shiftDateKey,
} from '../../src/features/body/body-domain';
import type { WeightLogRow } from '../../src/types/database';

function createWeightLog(id: string, date: string, weightKg: number, hour = 12): WeightLogRow {
  const recordedAt = `${date}T${String(hour).padStart(2, '0')}:00:00.000Z`;

  return {
    created_at: recordedAt,
    id,
    recorded_at: recordedAt,
    updated_at: recordedAt,
    user_id: 'test-user',
    weight_kg: weightKg,
  };
}

test('selects only the latest measurement from each local calendar day', () => {
  const points = selectLatestWeightPerDay([
    createWeightLog('1', '2026-08-28', 70, 8),
    createWeightLog('2', '2026-08-28', 71, 16),
    createWeightLog('3', '2026-08-29', 72),
  ]);

  assert.deepEqual(points, [
    { date: '2026-08-28', weightKg: 71 },
    { date: '2026-08-29', weightKg: 72 },
  ]);
});

test('calculates the current seven-day average and change against the previous week', () => {
  const previousWeek = Array.from({ length: 7 }, (_, index) =>
    createWeightLog(`previous-${index}`, `2026-08-${String(16 + index).padStart(2, '0')}`, 69),
  );
  const currentWeek = Array.from({ length: 7 }, (_, index) =>
    createWeightLog(`current-${index}`, `2026-08-${String(23 + index).padStart(2, '0')}`, 70),
  );
  const summary = calculateWeightTrend([...previousWeek, ...currentWeek], '2026-08-29');

  assert.equal(summary.sevenDayAverageKg, 70);
  assert.equal(summary.weeklyChangeKg, 1);
  assert.equal(summary.chartPoints.at(-1)?.averageWeightKg, 70);
});

test('keeps the weekly change unavailable until both periods contain a measurement', () => {
  const summary = calculateWeightTrend(
    [createWeightLog('current', '2026-08-29', 70)],
    '2026-08-29',
  );

  assert.equal(summary.sevenDayAverageKg, 70);
  assert.equal(summary.weeklyChangeKg, null);
});

test('shifts calendar date keys across month and year boundaries', () => {
  assert.equal(shiftDateKey('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDateKey('2026-12-31', 1), '2027-01-01');
});
