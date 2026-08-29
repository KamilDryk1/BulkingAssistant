begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

set local session_replication_role = replica;

insert into auth.users (id)
values
  ('da000000-0000-4000-8000-000000000001'),
  ('da000000-0000-4000-8000-000000000002');

insert into public.profiles (user_id, locale)
values
  ('da000000-0000-4000-8000-000000000001', 'pl'),
  ('da000000-0000-4000-8000-000000000002', 'en');

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
    'da100000-0000-4000-8000-000000000001',
    'active-test-bench',
    'Bench press',
    'Wyciskanie sztangi',
    'chest',
    'barbell',
    false
  ),
  (
    'da100000-0000-4000-8000-000000000002',
    'active-test-row',
    'Cable row',
    'Wiosłowanie na wyciągu',
    'back',
    'cable',
    false
  );

insert into public.workout_plans (id, user_id, name)
values
  (
    'da200000-0000-4000-8000-000000000001',
    'da000000-0000-4000-8000-000000000001',
    'Góra ciała'
  ),
  (
    'da200000-0000-4000-8000-000000000002',
    'da000000-0000-4000-8000-000000000002',
    'Upper body'
  );

insert into public.workout_plan_exercises (workout_plan_id, exercise_id, position)
values
  (
    'da200000-0000-4000-8000-000000000001',
    'da100000-0000-4000-8000-000000000001',
    0
  ),
  (
    'da200000-0000-4000-8000-000000000001',
    'da100000-0000-4000-8000-000000000002',
    1
  ),
  (
    'da200000-0000-4000-8000-000000000002',
    'da100000-0000-4000-8000-000000000001',
    0
  );

set local session_replication_role = origin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'da000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$select public.start_workout_session('da200000-0000-4000-8000-000000000001', current_date)$$,
  'A user can start their workout plan'
);

select is(
  (
    select workout_name_snapshot
    from public.workout_sessions
    where user_id = 'da000000-0000-4000-8000-000000000001'
      and completed_at is null
  ),
  'Góra ciała',
  'Starting a workout snapshots its name'
);

select results_eq(
  $$
    select exercise_name_snapshot, position
    from public.workout_session_exercises
    order by position
  $$,
  $$
    values
      ('Wyciskanie sztangi'::text, 0),
      ('Wiosłowanie na wyciągu'::text, 1)
  $$,
  'Starting a workout snapshots localized exercises in plan order'
);

select is(
  (
    select count(*)::integer
    from (
      select public.start_workout_session(
        'da200000-0000-4000-8000-000000000001',
        current_date
      )
      union all
      select id
      from public.workout_sessions
      where user_id = 'da000000-0000-4000-8000-000000000001'
    ) active_and_returned
  ),
  2,
  'Starting the same plan again returns the only active session'
);

select lives_ok(
  $$
    select public.save_workout_set(
      (
        select id
        from public.workout_session_exercises
        where exercise_id = 'da100000-0000-4000-8000-000000000001'
      ),
      null,
      60,
      8,
      true
    )
  $$,
  'A user can add and complete a set'
);

select lives_ok(
  $$
    select public.save_workout_set(
      (
        select id
        from public.workout_session_exercises
        where exercise_id = 'da100000-0000-4000-8000-000000000001'
      ),
      null,
      62.5,
      6,
      true
    )
  $$,
  'A user can append another set'
);

select is(
  (
    select completed_at is null
    from public.save_workout_set(
      (
        select session_exercise.id
        from public.workout_session_exercises session_exercise
        where session_exercise.exercise_id = 'da100000-0000-4000-8000-000000000001'
      ),
      (
        select workout_set.id
        from public.workout_sets workout_set
        join public.workout_session_exercises session_exercise
          on session_exercise.id = workout_set.session_exercise_id
        where session_exercise.exercise_id = 'da100000-0000-4000-8000-000000000001'
          and workout_set.set_number = 2
      ),
      62.5,
      6,
      false
    )
  ),
  true,
  'A completed set can be marked incomplete during an active session'
);

select is(
  (
    select completed_at is not null
    from public.save_workout_set(
      (
        select session_exercise.id
        from public.workout_session_exercises session_exercise
        where session_exercise.exercise_id = 'da100000-0000-4000-8000-000000000001'
      ),
      (
        select workout_set.id
        from public.workout_sets workout_set
        join public.workout_session_exercises session_exercise
          on session_exercise.id = workout_set.session_exercise_id
        where session_exercise.exercise_id = 'da100000-0000-4000-8000-000000000001'
          and workout_set.set_number = 2
      ),
      62.5,
      6,
      true
    )
  ),
  true,
  'An incomplete set can be completed again'
);

select lives_ok(
  $$
    select public.delete_workout_set(
      (
        select workout_set.id
        from public.workout_sets workout_set
        join public.workout_session_exercises session_exercise
          on session_exercise.id = workout_set.session_exercise_id
        where session_exercise.exercise_id = 'da100000-0000-4000-8000-000000000001'
          and workout_set.set_number = 1
      )
    )
  $$,
  'A user can delete a set from an active session'
);

select results_eq(
  $$
    select workout_set.set_number, workout_set.weight_kg, workout_set.reps
    from public.workout_sets workout_set
    join public.workout_session_exercises session_exercise
      on session_exercise.id = workout_set.session_exercise_id
    where session_exercise.exercise_id = 'da100000-0000-4000-8000-000000000001'
  $$,
  $$values (1, 62.5::numeric, 6)$$,
  'Deleting a set closes the numbering gap'
);

select lives_ok(
  $$
    select public.finish_workout_session(
      (
        select id
        from public.workout_sessions
        where user_id = 'da000000-0000-4000-8000-000000000001'
      )
    )
  $$,
  'A user can finish an active workout'
);

select throws_ok(
  $$
    select public.save_workout_set(
      (
        select id
        from public.workout_session_exercises
        where exercise_id = 'da100000-0000-4000-8000-000000000001'
      ),
      null,
      70,
      5,
      true
    )
  $$,
  'P0002',
  'Active session exercise not found',
  'Sets cannot be added after a workout is finished'
);

select lives_ok(
  $$select public.start_workout_session('da200000-0000-4000-8000-000000000001', current_date)$$,
  'A new workout can be started after finishing the previous one'
);

select results_eq(
  $$
    select set_number, weight_kg, reps
    from public.get_previous_exercise_performance(
      array['da100000-0000-4000-8000-000000000001'::uuid],
      now() + interval '1 second'
    )
  $$,
  $$values (1, 62.5::numeric, 6)$$,
  'Last Time returns completed sets from the latest previous session'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'da000000-0000-4000-8000-000000000002', true);

select is_empty(
  $$
    select id
    from public.workout_sessions
    where user_id = 'da000000-0000-4000-8000-000000000001'
  $$,
  'Another user cannot read workout history or the active session'
);

select lives_ok(
  $$select public.start_workout_session('da200000-0000-4000-8000-000000000002', current_date)$$,
  'Each user can have their own active workout'
);

select throws_ok(
  $$
    select public.finish_workout_session(
      (
        select id
        from public.workout_sessions
        where user_id = 'da000000-0000-4000-8000-000000000001'
      )
    )
  $$,
  'P0002',
  'Workout session not found',
  'A user cannot finish another user workout'
);

select * from finish();
rollback;
