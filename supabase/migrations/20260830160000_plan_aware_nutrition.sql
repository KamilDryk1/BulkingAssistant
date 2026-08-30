alter table public.activity_definitions
  add column met_light numeric(4, 1) not null default 3.0,
  add column met_moderate numeric(4, 1) not null default 5.0,
  add column met_hard numeric(4, 1) not null default 7.0;

alter table public.activity_definitions
  add constraint activity_definitions_met_values_check check (
    met_light between 1 and 30
    and met_moderate between met_light and 30
    and met_hard between met_moderate and 30
  );

update public.activity_definitions as activity
set
  met_light = values_table.met_light,
  met_moderate = values_table.met_moderate,
  met_hard = values_table.met_hard
from (
  values
    ('boxing', 5.5, 7.8, 12.3),
    ('muay-thai', 5.5, 7.8, 10.3),
    ('kickboxing', 5.5, 7.8, 10.3),
    ('mma', 5.5, 8.0, 10.5),
    ('bjj', 4.0, 6.0, 8.0),
    ('running', 6.0, 9.8, 12.8),
    ('cycling', 4.3, 7.0, 10.0),
    ('swimming', 4.8, 6.0, 9.8),
    ('walking', 2.5, 3.5, 4.8),
    ('hiking', 4.0, 5.3, 7.3),
    ('football', 4.0, 7.0, 10.0),
    ('basketball', 4.5, 7.5, 9.3),
    ('tennis', 4.5, 7.3, 10.0),
    ('rowing', 4.8, 7.0, 12.0)
) as values_table(slug, met_light, met_moderate, met_hard)
where activity.slug = values_table.slug;

alter table public.weekly_schedule_items
  add column planned_duration_minutes integer,
  add column planned_intensity public.activity_intensity;

update public.weekly_schedule_items
set
  planned_duration_minutes = 60,
  planned_intensity = 'moderate'
where item_type in ('workout', 'activity');

alter table public.weekly_schedule_items
  add constraint weekly_schedule_items_training_load_check check (
    (
      item_type = 'rest'
      and planned_duration_minutes is null
      and planned_intensity is null
    )
    or (
      item_type in ('workout', 'activity')
      and planned_duration_minutes between 1 and 1440
      and planned_intensity is not null
    )
  );

alter table public.daily_schedule_override_items
  add column planned_duration_minutes integer,
  add column planned_intensity public.activity_intensity;

update public.daily_schedule_override_items
set
  planned_duration_minutes = 60,
  planned_intensity = 'moderate'
where item_type in ('workout', 'activity');

alter table public.daily_schedule_override_items
  add constraint daily_schedule_override_items_training_load_check check (
    (
      item_type = 'rest'
      and planned_duration_minutes is null
      and planned_intensity is null
    )
    or (
      item_type in ('workout', 'activity')
      and planned_duration_minutes between 1 and 1440
      and planned_intensity is not null
    )
  );

alter table public.nutrition_target_snapshots
  add column resting_calories integer,
  add column baseline_calories integer,
  add column planned_training_calories integer,
  add column goal_adjustment_calories integer;

alter table public.nutrition_target_snapshots
  add constraint nutrition_target_snapshots_breakdown_check check (
    (resting_calories is null or resting_calories > 0)
    and (baseline_calories is null or baseline_calories > 0)
    and (planned_training_calories is null or planned_training_calories >= 0)
  );

create or replace function public.replace_weekly_schedule_day(
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
    planned_duration_minutes,
    planned_intensity,
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
    case
      when item.value ->> 'item_type' in ('workout', 'activity')
        then coalesce(nullif(item.value ->> 'duration_minutes', '')::integer, 60)
      else null
    end,
    case
      when item.value ->> 'item_type' in ('workout', 'activity')
        then coalesce(
          nullif(item.value ->> 'intensity', '')::public.activity_intensity,
          'moderate'::public.activity_intensity
        )
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

create or replace function public.replace_daily_schedule_override(
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
    planned_duration_minutes,
    planned_intensity,
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
    case
      when item.value ->> 'item_type' in ('workout', 'activity')
        then coalesce(nullif(item.value ->> 'duration_minutes', '')::integer, 60)
      else null
    end,
    case
      when item.value ->> 'item_type' in ('workout', 'activity')
        then coalesce(
          nullif(item.value ->> 'intensity', '')::public.activity_intensity,
          'moderate'::public.activity_intensity
        )
      else null
    end,
    (item.ordinality - 1)::integer
  from jsonb_array_elements(normalized_items) with ordinality as item(value, ordinality);

  return override_id;
end;
$$;
