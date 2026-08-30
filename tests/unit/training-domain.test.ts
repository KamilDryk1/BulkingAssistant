import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addScheduleItem,
  addUniqueItem,
  getActivityDisplayName,
  getExerciseDisplayName,
  getIsoWeekday,
  moveItem,
  resolveScheduleForDate,
} from '../../src/features/training/training-domain';
import type { ActivityDefinitionRow, ExerciseRow } from '../../src/types/database';

test('resolves ISO weekdays without treating Sunday as zero', () => {
  assert.equal(getIsoWeekday('2026-08-24'), 1);
  assert.equal(getIsoWeekday('2026-08-30'), 7);
});

test('a date-specific override takes precedence without changing the weekly items', () => {
  const weeklyItems = [
    {
      id: 'weekly-upper',
      itemType: 'workout' as const,
      position: 0,
      referenceId: 'upper',
      weekday: 4,
    },
  ];
  const override = {
    date: '2026-08-27',
    id: 'override-thursday',
    items: [{ itemType: 'workout' as const, referenceId: 'lower' }],
  };

  const resolved = resolveScheduleForDate('2026-08-27', weeklyItems, override);

  assert.equal(resolved.source, 'override');
  assert.deepEqual(resolved.items, override.items);
  assert.equal(weeklyItems[0]?.referenceId, 'upper');
});

test('falls back to the ordered weekly schedule when no override exists', () => {
  const resolved = resolveScheduleForDate(
    '2026-08-27',
    [
      {
        id: 'boxing',
        itemType: 'activity',
        position: 1,
        referenceId: 'boxing',
        weekday: 4,
      },
      {
        id: 'upper',
        itemType: 'workout',
        position: 0,
        referenceId: 'upper',
        weekday: 4,
      },
    ],
    null,
  );

  assert.equal(resolved.source, 'weekly');
  assert.deepEqual(
    resolved.items.map((item) => item.referenceId),
    ['upper', 'boxing'],
  );
});

test('rest replaces other scheduled items and adding an activity removes rest', () => {
  const rest = addScheduleItem([{ itemType: 'workout', referenceId: 'upper' }], {
    itemType: 'rest',
    referenceId: null,
  });
  assert.deepEqual(rest, [{ itemType: 'rest', referenceId: null }]);

  const activeDay = addScheduleItem(rest, {
    itemType: 'activity',
    referenceId: 'cycling',
  });
  assert.deepEqual(activeDay, [{ itemType: 'activity', referenceId: 'cycling' }]);
});

test('moves ordered items without mutating the original array', () => {
  const original = ['bench', 'row', 'squat'];
  assert.deepEqual(moveItem(original, 2, 0), ['squat', 'bench', 'row']);
  assert.deepEqual(original, ['bench', 'row', 'squat']);
});

test('adds a newly created exercise once while preserving the current order', () => {
  const selected = ['bench', 'row'];

  assert.deepEqual(addUniqueItem(selected, 'pulldown'), ['bench', 'row', 'pulldown']);
  assert.deepEqual(addUniqueItem(selected, 'bench'), selected);
  assert.deepEqual(selected, ['bench', 'row']);
});

test('localizes predefined names while preserving custom names', () => {
  const exercise = {
    custom_name: null,
    is_custom: false,
    name_en: 'Bench Press',
    name_pl: 'Wyciskanie sztangi',
  } as ExerciseRow;
  const activity = {
    custom_name: 'Rower z rodziną',
    is_custom: true,
    name_en: null,
    name_pl: null,
  } as ActivityDefinitionRow;

  assert.equal(getExerciseDisplayName(exercise, 'pl'), 'Wyciskanie sztangi');
  assert.equal(getActivityDisplayName(activity, 'en'), 'Rower z rodziną');
});
