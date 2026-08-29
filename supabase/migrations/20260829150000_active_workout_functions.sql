create unique index workout_sessions_one_active_per_user_idx
on public.workout_sessions (user_id)
where completed_at is null;

create function public.start_workout_session(workout_plan_id_value uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  active_session public.workout_sessions;
  plan_name text;
  plan_locale public.app_locale;
  session_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 0)
  );

  select session.*
  into active_session
  from public.workout_sessions session
  where session.user_id = current_user_id
    and session.completed_at is null
  limit 1;

  if found then
    if active_session.workout_plan_id = workout_plan_id_value then
      return active_session.id;
    end if;

    raise exception 'An active workout already exists' using errcode = '55000';
  end if;

  select plan.name, profile.locale
  into plan_name, plan_locale
  from public.workout_plans plan
  join public.profiles profile on profile.user_id = plan.user_id
  where plan.id = workout_plan_id_value
    and plan.user_id = current_user_id;

  if not found then
    raise exception 'Workout plan not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.workout_plan_exercises plan_exercise
    where plan_exercise.workout_plan_id = workout_plan_id_value
  ) then
    raise exception 'A workout plan must contain at least one exercise' using errcode = '22023';
  end if;

  insert into public.workout_sessions (
    user_id,
    workout_plan_id,
    workout_name_snapshot,
    session_date
  ) values (
    current_user_id,
    workout_plan_id_value,
    plan_name,
    current_date
  )
  returning id into session_id;

  insert into public.workout_session_exercises (
    workout_session_id,
    exercise_id,
    exercise_name_snapshot,
    muscle_group_snapshot,
    equipment_snapshot,
    position
  )
  select
    session_id,
    exercise.id,
    case
      when exercise.is_custom then exercise.custom_name
      when plan_locale = 'pl' then coalesce(exercise.name_pl, exercise.name_en)
      else coalesce(exercise.name_en, exercise.name_pl)
    end,
    exercise.muscle_group,
    exercise.equipment,
    plan_exercise.position
  from public.workout_plan_exercises plan_exercise
  join public.exercises exercise on exercise.id = plan_exercise.exercise_id
  where plan_exercise.workout_plan_id = workout_plan_id_value
  order by plan_exercise.position;

  return session_id;
end;
$$;

create function public.save_workout_set(
  session_exercise_id_value uuid,
  workout_set_id_value uuid,
  weight_kg_value numeric,
  reps_value integer,
  completed_value boolean
)
returns public.workout_sets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  next_set_number integer;
  saved_set public.workout_sets;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if weight_kg_value is null or weight_kg_value < 0 then
    raise exception 'Weight must be zero or greater' using errcode = '22023';
  end if;

  if reps_value is null or reps_value <= 0 then
    raise exception 'Repetitions must be greater than zero' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.workout_session_exercises session_exercise
    join public.workout_sessions session
      on session.id = session_exercise.workout_session_id
    where session_exercise.id = session_exercise_id_value
      and session.user_id = current_user_id
      and session.completed_at is null
  ) then
    raise exception 'Active session exercise not found' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(session_exercise_id_value::text, 0)
  );

  if workout_set_id_value is null then
    select coalesce(max(workout_set.set_number), 0) + 1
    into next_set_number
    from public.workout_sets workout_set
    where workout_set.session_exercise_id = session_exercise_id_value;

    insert into public.workout_sets (
      session_exercise_id,
      set_number,
      weight_kg,
      reps,
      completed_at
    ) values (
      session_exercise_id_value,
      next_set_number,
      weight_kg_value,
      reps_value,
      case when completed_value then now() else null end
    )
    returning * into saved_set;
  else
    update public.workout_sets workout_set
    set
      weight_kg = weight_kg_value,
      reps = reps_value,
      completed_at = case
        when completed_value then coalesce(workout_set.completed_at, now())
        else null
      end
    where workout_set.id = workout_set_id_value
      and workout_set.session_exercise_id = session_exercise_id_value
    returning * into saved_set;

    if not found then
      raise exception 'Workout set not found' using errcode = 'P0002';
    end if;
  end if;

  return saved_set;
end;
$$;

create function public.delete_workout_set(workout_set_id_value uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_session_exercise_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select workout_set.session_exercise_id
  into target_session_exercise_id
  from public.workout_sets workout_set
  join public.workout_session_exercises session_exercise
    on session_exercise.id = workout_set.session_exercise_id
  join public.workout_sessions session
    on session.id = session_exercise.workout_session_id
  where workout_set.id = workout_set_id_value
    and session.user_id = current_user_id
    and session.completed_at is null;

  if not found then
    raise exception 'Workout set not found in an active session' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_session_exercise_id::text, 0)
  );

  delete from public.workout_sets
  where id = workout_set_id_value;

  update public.workout_sets
  set set_number = set_number + 10000
  where session_exercise_id = target_session_exercise_id;

  with ordered_sets as (
    select
      workout_set.id,
      row_number() over (order by workout_set.set_number)::integer as next_set_number
    from public.workout_sets workout_set
    where workout_set.session_exercise_id = target_session_exercise_id
  )
  update public.workout_sets workout_set
  set set_number = ordered_set.next_set_number
  from ordered_sets ordered_set
  where workout_set.id = ordered_set.id;
end;
$$;

create function public.finish_workout_session(workout_session_id_value uuid)
returns public.workout_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  finished_session public.workout_sessions;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.workout_sessions session
  set completed_at = coalesce(session.completed_at, now())
  where session.id = workout_session_id_value
    and session.user_id = current_user_id
  returning * into finished_session;

  if not found then
    raise exception 'Workout session not found' using errcode = 'P0002';
  end if;

  return finished_session;
end;
$$;

create function public.get_previous_exercise_performance(
  exercise_ids uuid[],
  before_started_at_value timestamptz
)
returns table (
  exercise_id uuid,
  previous_session_date date,
  set_number integer,
  weight_kg numeric,
  reps integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ranked_exercises as (
    select
      session_exercise.exercise_id,
      session_exercise.id as session_exercise_id,
      session.session_date,
      row_number() over (
        partition by session_exercise.exercise_id
        order by session.started_at desc
      ) as session_rank
    from public.workout_session_exercises session_exercise
    join public.workout_sessions session
      on session.id = session_exercise.workout_session_id
    where session.user_id = (select auth.uid())
      and session.completed_at is not null
      and session.started_at < before_started_at_value
      and session_exercise.exercise_id = any(coalesce(exercise_ids, array[]::uuid[]))
      and exists (
        select 1
        from public.workout_sets completed_set
        where completed_set.session_exercise_id = session_exercise.id
          and completed_set.completed_at is not null
      )
  )
  select
    ranked.exercise_id,
    ranked.session_date,
    workout_set.set_number,
    workout_set.weight_kg,
    workout_set.reps
  from ranked_exercises ranked
  join public.workout_sets workout_set
    on workout_set.session_exercise_id = ranked.session_exercise_id
  where ranked.session_rank = 1
    and workout_set.completed_at is not null
  order by ranked.exercise_id, workout_set.set_number;
$$;

revoke all on function public.start_workout_session(uuid) from public, anon;
grant execute on function public.start_workout_session(uuid) to authenticated;

revoke all on function public.save_workout_set(uuid, uuid, numeric, integer, boolean)
from public, anon;
grant execute on function public.save_workout_set(uuid, uuid, numeric, integer, boolean)
to authenticated;

revoke all on function public.delete_workout_set(uuid) from public, anon;
grant execute on function public.delete_workout_set(uuid) to authenticated;

revoke all on function public.finish_workout_session(uuid) from public, anon;
grant execute on function public.finish_workout_session(uuid) to authenticated;

revoke all on function public.get_previous_exercise_performance(uuid[], timestamptz)
from public, anon;
grant execute on function public.get_previous_exercise_performance(uuid[], timestamptz)
to authenticated;
