import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addScheduleItem,
  addUniqueItem,
  getActivityDisplayName,
  getExerciseDisplayName,
  getIsoWeekDateKeys,
  getIsoWeekday,
  getSuggestedWorkoutDuration,
  isScheduleDraftValid,
  moveItem,
  resolveScheduleForDate,
  resolveScheduleForWeek,
} from '../../src/features/training/training-domain';
import type { ActivityDefinitionRow, ExerciseRow } from '../../src/types/database';

test('resolves ISO weekdays without treating Sunday as zero', () => {
  assert.equal(getIsoWeekday('2026-08-24'), 1);
  assert.equal(getIsoWeekday('2026-08-30'), 7);
});

test('resolves the complete Monday-to-Sunday week around a date', () => {
  assert.deepEqual(getIsoWeekDateKeys(new Date(2026, 7, 30, 12)), [
    '2026-08-24',
    '2026-08-25',
    '2026-08-26',
    '2026-08-27',
    '2026-08-28',
    '2026-08-29',
    '2026-08-30',
  ]);
});

test('a date-specific override takes precedence without changing the weekly items', () => {
  const weeklyItems = [
    {
      durationMinutes: 60,
      id: 'weekly-upper',
      intensity: 'moderate' as const,
      itemType: 'workout' as const,
      position: 0,
      referenceId: 'upper',
      weekday: 4,
    },
  ];
  const override = {
    date: '2026-08-27',
    id: 'override-thursday',
    items: [
      {
        durationMinutes: 45,
        intensity: 'hard' as const,
        itemType: 'workout' as const,
        referenceId: 'lower',
      },
    ],
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
        durationMinutes: 60,
        id: 'boxing',
        intensity: 'moderate' as const,
        itemType: 'activity',
        position: 1,
        referenceId: 'boxing',
        weekday: 4,
      },
      {
        durationMinutes: 75,
        id: 'upper',
        intensity: 'hard' as const,
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

test('resolves weekly items and replaces only dates with an override', () => {
  const weeklyItems = [
    {
      durationMinutes: 60,
      id: 'weekly-upper',
      intensity: 'moderate' as const,
      itemType: 'workout' as const,
      position: 0,
      referenceId: 'upper',
      weekday: 1,
    },
    {
      durationMinutes: 45,
      id: 'weekly-run',
      intensity: 'light' as const,
      itemType: 'activity' as const,
      position: 0,
      referenceId: 'run',
      weekday: 2,
    },
  ];
  const overrides = [
    {
      date: '2026-08-25',
      id: 'tuesday-rest',
      items: [
        {
          durationMinutes: null,
          intensity: null,
          itemType: 'rest' as const,
          referenceId: null,
        },
      ],
    },
  ];

  assert.deepEqual(
    resolveScheduleForWeek(['2026-08-24', '2026-08-25'], weeklyItems, overrides).map(
      (item) => item.itemType,
    ),
    ['workout', 'rest'],
  );
});

test('rest replaces other scheduled items and adding an activity removes rest', () => {
  const rest = addScheduleItem(
    [
      {
        durationMinutes: 60,
        intensity: 'moderate',
        itemType: 'workout',
        referenceId: 'upper',
      },
    ],
    { durationMinutes: null, intensity: null, itemType: 'rest', referenceId: null },
  );
  assert.deepEqual(rest, [
    { durationMinutes: null, intensity: null, itemType: 'rest', referenceId: null },
  ]);

  const activeDay = addScheduleItem(rest, {
    durationMinutes: 45,
    intensity: 'light',
    itemType: 'activity',
    referenceId: 'cycling',
  });
  assert.deepEqual(activeDay, [
    {
      durationMinutes: 45,
      intensity: 'light',
      itemType: 'activity',
      referenceId: 'cycling',
    },
  ]);
});

test('validates schedule energy inputs and suggests bounded workout durations', () => {
  assert.equal(getSuggestedWorkoutDuration(6), 65);
  assert.equal(getSuggestedWorkoutDuration(100), 120);
  assert.equal(
    isScheduleDraftValid([
      {
        durationMinutes: 60,
        intensity: 'moderate',
        itemType: 'workout',
        referenceId: 'upper',
      },
    ]),
    true,
  );
  assert.equal(
    isScheduleDraftValid([
      { durationMinutes: null, intensity: 'moderate', itemType: 'activity', referenceId: 'run' },
    ]),
    false,
  );
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
