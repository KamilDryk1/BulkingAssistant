begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

select is(
  (
    select count(*)::integer
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'ai_conversations',
        'ai_messages',
        'ai_tool_runs',
        'daily_workout_exercise_overrides',
        'daily_workout_exercise_override_items'
      )
      and relation.relrowsecurity
  ),
  5,
  'RLS is enabled on every Stage 2 user-owned table'
);

set local session_replication_role = replica;

insert into auth.users (id)
values
  ('d2000000-0000-4000-8000-000000000001'),
  ('d2000000-0000-4000-8000-000000000002');

insert into public.profiles (user_id, locale, goal, onboarding_completed_at)
values
  ('d2000000-0000-4000-8000-000000000001', 'en', 'gain', now()),
  ('d2000000-0000-4000-8000-000000000002', 'pl', 'maintain', now());

insert into public.exercises (
  id,
  slug,
  name_en,
  name_pl,
  muscle_group,
  equipment,
  is_custom
) values
  (
    'd2100000-0000-4000-8000-000000000001',
    'coach-squat',
    'Squat',
    'Przysiad',
    'legs',
    'barbell',
    false
  ),
  (
    'd2100000-0000-4000-8000-000000000002',
    'coach-leg-press',
    'Leg Press',
    'Wypychanie na suwnicy',
    'legs',
    'machine',
    false
  );

insert into public.exercises (
  id,
  owner_user_id,
  custom_name,
  muscle_group,
  equipment,
  is_custom
) values (
  'd2100000-0000-4000-8000-000000000003',
  'd2000000-0000-4000-8000-000000000002',
  'Private exercise',
  'legs',
  'other',
  true
);

insert into public.workout_plans (id, user_id, name)
values (
  'd2200000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'Lower'
);

insert into public.workout_plan_exercises (workout_plan_id, exercise_id, position)
values (
  'd2200000-0000-4000-8000-000000000001',
  'd2100000-0000-4000-8000-000000000001',
  0
);

set local session_replication_role = origin;
set local role service_role;

select lives_ok(
  $$
    select * from public.begin_ai_coach_turn(
      'd2000000-0000-4000-8000-000000000001',
      null,
      'How is my training going?',
      'd2300000-0000-4000-8000-000000000001',
      null
    )
  $$,
  'The service layer can begin an authenticated Coach turn'
);

select is(
  (
    select count(*)::integer
    from public.ai_conversations
    where user_id = 'd2000000-0000-4000-8000-000000000001'
  ),
  1,
  'Beginning a turn creates one conversation'
);

select is(
  (
    select count(*)::integer
    from public.ai_messages
    where role = 'user'
      and user_id = 'd2000000-0000-4000-8000-000000000001'
  ),
  1,
  'Beginning a turn stores one user-visible message'
);

select is(
  (
    select should_process
    from public.begin_ai_coach_turn(
      'd2000000-0000-4000-8000-000000000001',
      null,
      'How is my training going?',
      'd2300000-0000-4000-8000-000000000001',
      null
    )
  ),
  false,
  'A concurrent retry with the same client request is idempotent'
);

select lives_ok(
  $$
    select public.complete_ai_coach_turn(
      'd2000000-0000-4000-8000-000000000001',
      (
        select id from public.ai_conversations
        where user_id = 'd2000000-0000-4000-8000-000000000001'
        limit 1
      ),
      (
        select processing_token from public.ai_conversations
        where user_id = 'd2000000-0000-4000-8000-000000000001'
        limit 1
      ),
      'Your recent training data is available.',
      'response-test'
    )
  $$,
  'The service layer can complete a claimed Coach turn'
);

select is(
  (
    select status from public.ai_conversations
    where user_id = 'd2000000-0000-4000-8000-000000000001'
    limit 1
  ),
  'idle'::public.ai_conversation_status,
  'Completing a turn releases the conversation claim'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd2000000-0000-4000-8000-000000000001', true);

select is(
  (select count(*)::integer from public.ai_conversations),
  1,
  'A user can read their own conversation'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd2000000-0000-4000-8000-000000000002', true);

select is_empty(
  $$select id from public.ai_conversations$$,
  'Another user cannot read a private Coach conversation'
);

select throws_ok(
  $$
    insert into public.ai_conversations (user_id)
    values ('d2000000-0000-4000-8000-000000000002')
  $$,
  '42501',
  'permission denied for table ai_conversations',
  'Clients cannot manufacture Coach conversations'
);

select throws_ok(
  $$
    select * from public.begin_ai_coach_turn(
      'd2000000-0000-4000-8000-000000000002',
      null,
      'Unauthorized service call',
      'd2300000-0000-4000-8000-000000000002',
      null
    )
  $$,
  '42501',
  'permission denied for function begin_ai_coach_turn',
  'Authenticated clients cannot call the service-only turn RPC'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd2000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$
    select public.replace_daily_workout_exercises(
      current_date,
      'd2200000-0000-4000-8000-000000000001',
      array['d2100000-0000-4000-8000-000000000002']::uuid[]
    )
  $$,
  'A controlled domain RPC creates a today-only exercise override'
);

select results_eq(
  $$
    select item.exercise_id
    from public.daily_workout_exercise_override_items item
    join public.daily_workout_exercise_overrides daily_override
      on daily_override.id = item.daily_workout_override_id
    order by item.position
  $$,
  $$values ('d2100000-0000-4000-8000-000000000002'::uuid)$$,
  'The date-specific override contains the replacement exercise'
);

select results_eq(
  $$
    select exercise_id
    from public.workout_plan_exercises
    where workout_plan_id = 'd2200000-0000-4000-8000-000000000001'
  $$,
  $$values ('d2100000-0000-4000-8000-000000000001'::uuid)$$,
  'A today-only override leaves the reusable plan unchanged'
);

select lives_ok(
  $$
    select public.start_workout_session(
      'd2200000-0000-4000-8000-000000000001',
      current_date
    )
  $$,
  'Starting a workout accepts the date-specific exercise snapshot'
);

select results_eq(
  $$
    select exercise_id
    from public.workout_session_exercises
    order by position
  $$,
  $$values ('d2100000-0000-4000-8000-000000000002'::uuid)$$,
  'The active session snapshots the today-only replacement'
);

select lives_ok(
  $$
    select public.replace_active_workout_session_exercises(
      array['d2100000-0000-4000-8000-000000000001']::uuid[]
    )
  $$,
  'The active session can be changed without mutating its source plan'
);

select results_eq(
  $$select exercise_id from public.workout_session_exercises order by position$$,
  $$values ('d2100000-0000-4000-8000-000000000001'::uuid)$$,
  'The active session now contains the requested exercise'
);

select lives_ok(
  $$
    select public.save_workout_set(
      (select id from public.workout_session_exercises limit 1),
      null,
      80,
      5,
      true
    )
  $$,
  'A completed set can be logged against the active snapshot'
);

select throws_ok(
  $$
    select public.replace_active_workout_session_exercises(
      array['d2100000-0000-4000-8000-000000000002']::uuid[]
    )
  $$,
  '55000',
  'An exercise with logged sets cannot be removed from the active session',
  'Exercises with recorded history cannot be removed from an active session'
);

select throws_ok(
  $$
    select public.replace_daily_workout_exercises(
      current_date,
      'd2200000-0000-4000-8000-000000000001',
      array['d2100000-0000-4000-8000-000000000003']::uuid[]
    )
  $$,
  '42501',
  'One or more exercises are not available to this user',
  'A today-only tool cannot use another user custom exercise'
);

reset role;
set local role service_role;

insert into public.ai_tool_runs (
  id,
  conversation_id,
  user_id,
  provider_call_id,
  tool_name,
  tool_kind,
  arguments,
  status,
  confirmation_summary
) values (
  'd2400000-0000-4000-8000-000000000001',
  (
    select id from public.ai_conversations
    where user_id = 'd2000000-0000-4000-8000-000000000001'
    limit 1
  ),
  'd2000000-0000-4000-8000-000000000001',
  'call-confirm-plan',
  'update_workout_plan',
  'persistent_write',
  '{"workoutPlanId":"d2200000-0000-4000-8000-000000000001","name":"Lower 2","exerciseIds":["d2100000-0000-4000-8000-000000000002"]}',
  'awaiting_confirmation',
  'Permanently update Lower.'
);

select lives_ok(
  $$
    select * from public.claim_ai_coach_confirmation(
      'd2000000-0000-4000-8000-000000000001',
      'd2400000-0000-4000-8000-000000000001'
    )
  $$,
  'The service layer can atomically claim a pending persistent action'
);

select is(
  (
    select status
    from public.ai_tool_runs
    where id = 'd2400000-0000-4000-8000-000000000001'
  ),
  'running'::public.ai_tool_status,
  'Claiming confirmation moves the audited tool run to running'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd2000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$
    select public.save_ai_workout_plan(
      'd2500000-0000-4000-8000-000000000001',
      'Coach Plan',
      array['d2100000-0000-4000-8000-000000000002']::uuid[]
    )
  $$,
  'A confirmed create action can save a deterministic plan ID'
);

select lives_ok(
  $$
    select public.save_ai_workout_plan(
      'd2500000-0000-4000-8000-000000000001',
      'Coach Plan',
      array['d2100000-0000-4000-8000-000000000002']::uuid[]
    )
  $$,
  'Retrying the same confirmed create action is idempotent'
);

select is(
  (
    select count(*)::integer
    from public.workout_plans
    where id = 'd2500000-0000-4000-8000-000000000001'
  ),
  1,
  'An idempotent create retry does not duplicate the reusable plan'
);

select is(
  (
    select count(*)::integer
    from public.workout_plan_exercises
    where workout_plan_id = 'd2500000-0000-4000-8000-000000000001'
  ),
  1,
  'The idempotent plan keeps one validated exercise snapshot'
);

select * from finish();
rollback;
