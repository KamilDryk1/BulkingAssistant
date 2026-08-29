begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

set local session_replication_role = replica;

insert into auth.users (id)
values
  ('ca000000-0000-4000-8000-000000000001'),
  ('ca000000-0000-4000-8000-000000000002');

insert into public.profiles (user_id, locale)
values
  ('ca000000-0000-4000-8000-000000000001', 'en'),
  ('ca000000-0000-4000-8000-000000000002', 'pl');

insert into public.exercises (
  id,
  owner_user_id,
  slug,
  name_en,
  name_pl,
  custom_name,
  muscle_group,
  equipment,
  is_custom
) values
  (
    'ca100000-0000-4000-8000-000000000001',
    null,
    'domain-test-global',
    'Domain Test',
    'Test domeny',
    null,
    'chest',
    'barbell',
    false
  ),
  (
    'ca100000-0000-4000-8000-000000000002',
    'ca000000-0000-4000-8000-000000000001',
    null,
    null,
    null,
    'User A domain exercise',
    'back',
    'cable',
    true
  ),
  (
    'ca100000-0000-4000-8000-000000000003',
    'ca000000-0000-4000-8000-000000000002',
    null,
    null,
    null,
    'User B domain exercise',
    'legs',
    'machine',
    true
  );

insert into public.activity_definitions (
  id,
  slug,
  name_en,
  name_pl,
  is_custom
) values (
  'ca200000-0000-4000-8000-000000000001',
  'domain-test-activity',
  'Domain activity',
  'Aktywność domenowa',
  false
);

insert into public.workout_plans (id, user_id, name)
values
  (
    'ca300000-0000-4000-8000-000000000001',
    'ca000000-0000-4000-8000-000000000001',
    'User A plan'
  ),
  (
    'ca300000-0000-4000-8000-000000000002',
    'ca000000-0000-4000-8000-000000000002',
    'User B plan'
  );

set local session_replication_role = origin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ca000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$
    select public.save_workout_plan(
      'ca300000-0000-4000-8000-000000000001',
      'Updated plan',
      array[
        'ca100000-0000-4000-8000-000000000002'::uuid,
        'ca100000-0000-4000-8000-000000000001'::uuid
      ]
    )
  $$,
  'A user can save an ordered workout plan atomically'
);

select results_eq(
  $$
    select exercise_id, position
    from public.workout_plan_exercises
    where workout_plan_id = 'ca300000-0000-4000-8000-000000000001'
    order by position
  $$,
  $$
    values
      ('ca100000-0000-4000-8000-000000000002'::uuid, 0),
      ('ca100000-0000-4000-8000-000000000001'::uuid, 1)
  $$,
  'Workout plan exercise order is persisted'
);

select throws_ok(
  $$
    select public.save_workout_plan(
      'ca300000-0000-4000-8000-000000000001',
      'Invalid plan',
      array['ca100000-0000-4000-8000-000000000003'::uuid]
    )
  $$,
  '42501',
  'One or more exercises are not available to this user',
  'A user cannot add another user custom exercise to a plan'
);

select throws_ok(
  $$
    select public.save_workout_plan(
      'ca300000-0000-4000-8000-000000000002',
      'Other user plan',
      array[]::uuid[]
    )
  $$,
  'P0002',
  'Workout plan not found',
  'A user cannot update another user workout plan'
);

select lives_ok(
  $$
    select public.replace_weekly_schedule_day(
      1,
      '[
        {"item_type":"workout","reference_id":"ca300000-0000-4000-8000-000000000001"},
        {"item_type":"activity","reference_id":"ca200000-0000-4000-8000-000000000001"}
      ]'::jsonb
    )
  $$,
  'A weekly schedule day can contain ordered workouts and activities'
);

select results_eq(
  $$
    select item_type::text, position
    from public.weekly_schedule_items
    where user_id = 'ca000000-0000-4000-8000-000000000001'
      and weekday = 1
    order by position
  $$,
  $$values ('workout'::text, 0), ('activity'::text, 1)$$,
  'Weekly schedule item order is persisted'
);

select throws_ok(
  $$
    select public.replace_weekly_schedule_day(
      2,
      '[
        {"item_type":"rest","reference_id":null},
        {"item_type":"workout","reference_id":"ca300000-0000-4000-8000-000000000001"}
      ]'::jsonb
    )
  $$,
  '22023',
  'Rest must be the only item for a day',
  'Rest cannot be combined with other weekly items'
);

select lives_ok(
  $$
    select public.replace_daily_schedule_override(
      '2026-08-31',
      '[{"item_type":"rest","reference_id":null}]'::jsonb
    )
  $$,
  'A user can create a date-specific schedule override'
);

select is(
  (
    select count(*)::integer
    from public.daily_schedule_override_items item
    join public.daily_schedule_overrides daily_override
      on daily_override.id = item.daily_override_id
    where daily_override.user_id = 'ca000000-0000-4000-8000-000000000001'
      and daily_override.scheduled_date = '2026-08-31'
      and item.item_type = 'rest'
  ),
  1,
  'The date-specific override stores its item'
);

select lives_ok(
  $$select public.delete_daily_schedule_override('2026-08-31')$$,
  'A user can remove a date-specific schedule override'
);

select is_empty(
  $$
    select id
    from public.daily_schedule_overrides
    where user_id = 'ca000000-0000-4000-8000-000000000001'
      and scheduled_date = '2026-08-31'
  $$,
  'Deleting an override restores weekly resolution'
);

select lives_ok(
  $$select public.delete_custom_exercise('ca100000-0000-4000-8000-000000000002')$$,
  'A user can delete their custom exercise even when a plan uses it'
);

select is_empty(
  $$select id from public.exercises where id = 'ca100000-0000-4000-8000-000000000002'$$,
  'The custom exercise is deleted'
);

select results_eq(
  $$
    select exercise_id
    from public.workout_plan_exercises
    where workout_plan_id = 'ca300000-0000-4000-8000-000000000001'
    order by position
  $$,
  $$values ('ca100000-0000-4000-8000-000000000001'::uuid)$$,
  'Deleting a custom exercise removes it from the user workout plans'
);

select * from finish();
rollback;
