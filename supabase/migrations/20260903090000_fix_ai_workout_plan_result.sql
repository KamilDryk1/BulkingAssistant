create or replace function public.save_ai_workout_plan(
  idempotency_plan_id uuid,
  workout_plan_name text,
  ordered_exercise_ids uuid[]
)
returns public.workout_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  saved_plan public.workout_plans;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if idempotency_plan_id is null then
    raise exception 'Idempotency plan ID is required' using errcode = '22023';
  end if;

  insert into public.workout_plans (id, user_id, name)
  values (idempotency_plan_id, current_user_id, trim(workout_plan_name))
  on conflict (id) do nothing;

  if not exists (
    select 1
    from public.workout_plans plan
    where plan.id = idempotency_plan_id
      and plan.user_id = current_user_id
  ) then
    raise exception 'Workout plan ID is not available to this user' using errcode = '42501';
  end if;

  select plan.*
  into saved_plan
  from public.save_workout_plan(
    idempotency_plan_id,
    workout_plan_name,
    ordered_exercise_ids
  ) plan;

  return saved_plan;
end;
$$;
