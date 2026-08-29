drop function public.start_workout_session(uuid);

create function public.start_workout_session(
  workout_plan_id_value uuid,
  session_date_value date
)
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

  if session_date_value is null then
    raise exception 'Session date is required' using errcode = '22023';
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
    session_date_value
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

revoke all on function public.start_workout_session(uuid, date) from public, anon;
grant execute on function public.start_workout_session(uuid, date) to authenticated;
