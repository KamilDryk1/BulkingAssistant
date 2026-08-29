create function public.save_workout_plan(
  workout_plan_id_value uuid,
  workout_plan_name text,
  ordered_exercise_ids uuid[]
)
returns public.workout_plans
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_name text := trim(workout_plan_name);
  normalized_exercise_ids uuid[] := coalesce(ordered_exercise_ids, array[]::uuid[]);
  distinct_exercise_count bigint;
  available_exercise_count bigint;
  saved_plan public.workout_plans;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if normalized_name = '' then
    raise exception 'Workout plan name is required' using errcode = '22023';
  end if;

  select count(distinct candidate.exercise_id)
  into distinct_exercise_count
  from unnest(normalized_exercise_ids) as candidate(exercise_id);

  if distinct_exercise_count <> cardinality(normalized_exercise_ids) then
    raise exception 'A workout plan cannot contain duplicate exercises' using errcode = '22023';
  end if;

  select count(*)
  into available_exercise_count
  from public.exercises exercise
  where exercise.id = any(normalized_exercise_ids)
    and (exercise.owner_user_id is null or exercise.owner_user_id = current_user_id);

  if available_exercise_count <> cardinality(normalized_exercise_ids) then
    raise exception 'One or more exercises are not available to this user' using errcode = '42501';
  end if;

  if workout_plan_id_value is null then
    insert into public.workout_plans (user_id, name)
    values (current_user_id, normalized_name)
    returning * into saved_plan;
  else
    update public.workout_plans
    set name = normalized_name
    where id = workout_plan_id_value
      and user_id = current_user_id
    returning * into saved_plan;

    if not found then
      raise exception 'Workout plan not found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.workout_plan_exercises
  where workout_plan_id = saved_plan.id;

  insert into public.workout_plan_exercises (
    workout_plan_id,
    exercise_id,
    position
  )
  select
    saved_plan.id,
    ordered.exercise_id,
    (ordered.ordinality - 1)::integer
  from unnest(normalized_exercise_ids) with ordinality as ordered(exercise_id, ordinality);

  return saved_plan;
end;
$$;

create function public.delete_custom_exercise(exercise_id_value uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.exercises exercise
    where exercise.id = exercise_id_value
      and exercise.is_custom
      and exercise.owner_user_id = current_user_id
  ) then
    raise exception 'Custom exercise not found' using errcode = 'P0002';
  end if;

  delete from public.workout_plan_exercises plan_exercise
  using public.workout_plans plan
  where plan_exercise.exercise_id = exercise_id_value
    and plan_exercise.workout_plan_id = plan.id
    and plan.user_id = current_user_id;

  delete from public.exercises
  where id = exercise_id_value
    and is_custom
    and owner_user_id = current_user_id;
end;
$$;

create function public.replace_weekly_schedule_day(
  schedule_weekday smallint,
  schedule_items jsonb
)
returns setof public.weekly_schedule_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_items jsonb := coalesce(schedule_items, '[]'::jsonb);
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if schedule_weekday not between 1 and 7 then
    raise exception 'Weekday must be between 1 and 7' using errcode = '22023';
  end if;

  if jsonb_typeof(normalized_items) <> 'array' then
    raise exception 'Schedule items must be a JSON array' using errcode = '22023';
  end if;

  if jsonb_array_length(normalized_items) > 1
    and exists (
      select 1
      from jsonb_array_elements(normalized_items) as item
      where item ->> 'item_type' = 'rest'
    )
  then
    raise exception 'Rest must be the only item for a day' using errcode = '22023';
  end if;

  delete from public.weekly_schedule_items
  where user_id = current_user_id
    and weekday = schedule_weekday;

  insert into public.weekly_schedule_items (
    user_id,
    weekday,
    item_type,
    workout_plan_id,
    activity_definition_id,
    position
  )
  select
    current_user_id,
    schedule_weekday,
    (item.value ->> 'item_type')::public.schedule_item_type,
    case
      when item.value ->> 'item_type' = 'workout'
        then nullif(item.value ->> 'reference_id', '')::uuid
      else null
    end,
    case
      when item.value ->> 'item_type' = 'activity'
        then nullif(item.value ->> 'reference_id', '')::uuid
      else null
    end,
    (item.ordinality - 1)::integer
  from jsonb_array_elements(normalized_items) with ordinality as item(value, ordinality);

  return query
  select schedule_item.*
  from public.weekly_schedule_items schedule_item
  where schedule_item.user_id = current_user_id
    and schedule_item.weekday = schedule_weekday
  order by schedule_item.position;
end;
$$;

create function public.replace_daily_schedule_override(
  override_date date,
  schedule_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_items jsonb := coalesce(schedule_items, '[]'::jsonb);
  override_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if jsonb_typeof(normalized_items) <> 'array' then
    raise exception 'Schedule items must be a JSON array' using errcode = '22023';
  end if;

  if jsonb_array_length(normalized_items) > 1
    and exists (
      select 1
      from jsonb_array_elements(normalized_items) as item
      where item ->> 'item_type' = 'rest'
    )
  then
    raise exception 'Rest must be the only item for a date' using errcode = '22023';
  end if;

  insert into public.daily_schedule_overrides (user_id, scheduled_date)
  values (current_user_id, override_date)
  on conflict (user_id, scheduled_date) do update
  set updated_at = now()
  returning id into override_id;

  delete from public.daily_schedule_override_items
  where daily_override_id = override_id;

  insert into public.daily_schedule_override_items (
    daily_override_id,
    item_type,
    workout_plan_id,
    activity_definition_id,
    position
  )
  select
    override_id,
    (item.value ->> 'item_type')::public.schedule_item_type,
    case
      when item.value ->> 'item_type' = 'workout'
        then nullif(item.value ->> 'reference_id', '')::uuid
      else null
    end,
    case
      when item.value ->> 'item_type' = 'activity'
        then nullif(item.value ->> 'reference_id', '')::uuid
      else null
    end,
    (item.ordinality - 1)::integer
  from jsonb_array_elements(normalized_items) with ordinality as item(value, ordinality);

  return override_id;
end;
$$;

create function public.delete_daily_schedule_override(override_date date)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.daily_schedule_overrides
  where user_id = (select auth.uid())
    and scheduled_date = override_date;
$$;

revoke all on function public.save_workout_plan(uuid, text, uuid[]) from public, anon;
grant execute on function public.save_workout_plan(uuid, text, uuid[]) to authenticated;

revoke all on function public.delete_custom_exercise(uuid) from public, anon;
grant execute on function public.delete_custom_exercise(uuid) to authenticated;

revoke all on function public.replace_weekly_schedule_day(smallint, jsonb) from public, anon;
grant execute on function public.replace_weekly_schedule_day(smallint, jsonb) to authenticated;

revoke all on function public.replace_daily_schedule_override(date, jsonb) from public, anon;
grant execute on function public.replace_daily_schedule_override(date, jsonb) to authenticated;

revoke all on function public.delete_daily_schedule_override(date) from public, anon;
grant execute on function public.delete_daily_schedule_override(date) to authenticated;
