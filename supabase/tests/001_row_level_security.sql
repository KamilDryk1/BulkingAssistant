begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select is(
  (
    select count(*)::integer
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'profiles',
        'exercises',
        'activity_definitions',
        'workout_plans',
        'workout_plan_exercises',
        'weekly_schedule_items',
        'daily_schedule_overrides',
        'daily_schedule_override_items',
        'workout_sessions',
        'workout_session_exercises',
        'workout_sets',
        'activity_logs',
        'weight_logs',
        'nutrition_target_snapshots'
      )
      and relation.relrowsecurity
  ),
  14,
  'RLS is enabled on every exposed application table'
);

set local session_replication_role = replica;

insert into public.profiles (user_id, locale)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'en'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'pl');

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
    '30000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    null,
    null,
    null,
    'User A exercise',
    'chest',
    'other',
    true
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    null,
    null,
    null,
    'User B exercise',
    'back',
    'other',
    true
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    null,
    'rls-test-global',
    'RLS Test',
    'Test RLS',
    null,
    'legs',
    'barbell',
    false
  );

insert into public.workout_plans (id, user_id, name)
values
  (
    '40000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'User A plan'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'User B plan'
  );

set local session_replication_role = origin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

select results_eq(
  $$select user_id from public.profiles$$,
  $$values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid)$$,
  'A user can only read their own profile'
);

select results_eq(
  $$select id from public.workout_plans$$,
  $$values ('40000000-0000-4000-8000-000000000001'::uuid)$$,
  'A user can only read their own workout plans'
);

select results_eq(
  $$select count(*) from public.exercises$$,
  $$values (2::bigint)$$,
  'A user sees global catalog rows and their own custom rows'
);

select is_empty(
  $$select id from public.exercises where id = '30000000-0000-4000-8000-000000000002'$$,
  'Another user custom exercise is private'
);

select lives_ok(
  $$
    insert into public.weight_logs (user_id, weight_kg)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 80)
  $$,
  'A user can insert their own weight log'
);

select throws_ok(
  $$
    insert into public.weight_logs (user_id, weight_kg)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 80)
  $$,
  '42501',
  'new row violates row-level security policy for table "weight_logs"',
  'A user cannot insert a weight log for another user'
);

select is_empty(
  $$
    update public.profiles
    set preferred_weight_unit = 'lb'
    where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    returning user_id
  $$,
  'A user cannot update another profile'
);

select is_empty(
  $$
    update public.exercises
    set name_en = 'Changed'
    where id = '30000000-0000-4000-8000-000000000003'
    returning id
  $$,
  'Authenticated users cannot mutate the global exercise catalog'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);

select is_empty(
  $$select id from public.weight_logs$$,
  'A second user cannot read the first user weight log'
);

select results_eq(
  $$select id from public.workout_plans$$,
  $$values ('40000000-0000-4000-8000-000000000002'::uuid)$$,
  'The second user sees only their own workout plan'
);

select * from finish();
rollback;
