create extension if not exists pgcrypto with schema extensions;

create type public.app_locale as enum ('en', 'pl');
create type public.weight_unit as enum ('kg', 'lb');
create type public.profile_sex as enum ('male', 'female');
create type public.activity_level as enum (
  'sedentary',
  'light',
  'moderate',
  'very_active',
  'extremely_active'
);
create type public.fitness_goal as enum ('cut', 'maintain', 'gain');
create type public.muscle_group as enum (
  'chest',
  'back',
  'legs',
  'shoulders',
  'biceps',
  'triceps',
  'core'
);
create type public.equipment_category as enum (
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'other'
);
create type public.schedule_item_type as enum ('workout', 'activity', 'rest');
create type public.activity_intensity as enum ('light', 'moderate', 'hard');

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  locale public.app_locale not null default 'en',
  preferred_weight_unit public.weight_unit not null default 'kg',
  sex public.profile_sex,
  date_of_birth date,
  height_cm numeric(5, 2),
  activity_level public.activity_level,
  goal public.fitness_goal,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_date_of_birth_check check (
    date_of_birth is null or date_of_birth <= current_date
  ),
  constraint profiles_height_cm_check check (
    height_cm is null or height_cm between 80 and 260
  ),
  constraint profiles_onboarding_state_check check (
    onboarding_completed_at is null
    or (
      sex is not null
      and date_of_birth is not null
      and height_cm is not null
      and activity_level is not null
      and goal is not null
    )
  )
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users (id) on delete cascade,
  slug text unique,
  name_en text,
  name_pl text,
  custom_name text,
  muscle_group public.muscle_group not null,
  equipment public.equipment_category not null,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercises_kind_check check (
    (
      is_custom = false
      and owner_user_id is null
      and slug is not null
      and name_en is not null
      and name_pl is not null
      and custom_name is null
    )
    or (
      is_custom = true
      and owner_user_id is not null
      and slug is null
      and name_en is null
      and name_pl is null
      and length(trim(custom_name)) > 0
    )
  )
);

create table public.activity_definitions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users (id) on delete cascade,
  slug text unique,
  name_en text,
  name_pl text,
  custom_name text,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_definitions_kind_check check (
    (
      is_custom = false
      and owner_user_id is null
      and slug is not null
      and name_en is not null
      and name_pl is not null
      and custom_name is null
    )
    or (
      is_custom = true
      and owner_user_id is not null
      and slug is null
      and name_en is null
      and name_pl is null
      and length(trim(custom_name)) > 0
    )
  )
);

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.workout_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_plan_id uuid not null references public.workout_plans (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_plan_id, position),
  unique (workout_plan_id, exercise_id)
);

create table public.weekly_schedule_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  item_type public.schedule_item_type not null,
  workout_plan_id uuid references public.workout_plans (id) on delete cascade,
  activity_definition_id uuid references public.activity_definitions (id) on delete restrict,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_schedule_items_reference_check check (
    (item_type = 'workout' and workout_plan_id is not null and activity_definition_id is null)
    or (item_type = 'activity' and workout_plan_id is null and activity_definition_id is not null)
    or (item_type = 'rest' and workout_plan_id is null and activity_definition_id is null)
  ),
  unique (user_id, weekday, position)
);

create table public.daily_schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scheduled_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scheduled_date),
  unique (id, user_id)
);

create table public.daily_schedule_override_items (
  id uuid primary key default gen_random_uuid(),
  daily_override_id uuid not null references public.daily_schedule_overrides (id) on delete cascade,
  item_type public.schedule_item_type not null,
  workout_plan_id uuid references public.workout_plans (id) on delete cascade,
  activity_definition_id uuid references public.activity_definitions (id) on delete restrict,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_schedule_override_items_reference_check check (
    (item_type = 'workout' and workout_plan_id is not null and activity_definition_id is null)
    or (item_type = 'activity' and workout_plan_id is null and activity_definition_id is not null)
    or (item_type = 'rest' and workout_plan_id is null and activity_definition_id is null)
  ),
  unique (daily_override_id, position)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_plan_id uuid references public.workout_plans (id) on delete set null,
  workout_name_snapshot text not null check (length(trim(workout_name_snapshot)) > 0),
  session_date date not null default current_date,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_sessions_time_check check (
    completed_at is null or completed_at >= started_at
  ),
  unique (id, user_id)
);

create table public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete set null,
  exercise_name_snapshot text not null check (length(trim(exercise_name_snapshot)) > 0),
  muscle_group_snapshot public.muscle_group not null,
  equipment_snapshot public.equipment_category not null,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_session_id, position)
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.workout_session_exercises (id) on delete cascade,
  set_number integer not null check (set_number > 0),
  weight_kg numeric(7, 3) not null check (weight_kg >= 0),
  reps integer not null check (reps > 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_exercise_id, set_number)
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_definition_id uuid references public.activity_definitions (id) on delete set null,
  activity_name_snapshot text not null check (length(trim(activity_name_snapshot)) > 0),
  activity_date date not null default current_date,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  intensity public.activity_intensity,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  weight_kg numeric(7, 3) not null check (weight_kg between 20 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.nutrition_target_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  target_date date not null,
  calories integer not null check (calories > 0),
  protein_grams integer not null check (protein_grams >= 0),
  carbohydrate_grams integer not null check (carbohydrate_grams >= 0),
  fat_grams integer not null check (fat_grams >= 0),
  calculation_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, target_date)
);

create index exercises_owner_user_id_idx on public.exercises (owner_user_id);
create index activity_definitions_owner_user_id_idx on public.activity_definitions (owner_user_id);
create index workout_plans_user_id_idx on public.workout_plans (user_id);
create index workout_plan_exercises_plan_position_idx
  on public.workout_plan_exercises (workout_plan_id, position);
create index weekly_schedule_items_user_weekday_idx
  on public.weekly_schedule_items (user_id, weekday, position);
create index daily_schedule_overrides_user_date_idx
  on public.daily_schedule_overrides (user_id, scheduled_date);
create index daily_schedule_override_items_override_position_idx
  on public.daily_schedule_override_items (daily_override_id, position);
create index workout_sessions_user_date_idx
  on public.workout_sessions (user_id, session_date desc, started_at desc);
create index workout_session_exercises_session_position_idx
  on public.workout_session_exercises (workout_session_id, position);
create index workout_sets_session_exercise_set_idx
  on public.workout_sets (session_exercise_id, set_number);
create index activity_logs_user_date_idx
  on public.activity_logs (user_id, activity_date desc);
create index weight_logs_user_recorded_at_idx
  on public.weight_logs (user_id, recorded_at desc);
create index nutrition_target_snapshots_user_date_idx
  on public.nutrition_target_snapshots (user_id, target_date desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger exercises_set_updated_at before update on public.exercises
for each row execute function public.set_updated_at();
create trigger activity_definitions_set_updated_at before update on public.activity_definitions
for each row execute function public.set_updated_at();
create trigger workout_plans_set_updated_at before update on public.workout_plans
for each row execute function public.set_updated_at();
create trigger workout_plan_exercises_set_updated_at before update on public.workout_plan_exercises
for each row execute function public.set_updated_at();
create trigger weekly_schedule_items_set_updated_at before update on public.weekly_schedule_items
for each row execute function public.set_updated_at();
create trigger daily_schedule_overrides_set_updated_at before update on public.daily_schedule_overrides
for each row execute function public.set_updated_at();
create trigger daily_schedule_override_items_set_updated_at before update on public.daily_schedule_override_items
for each row execute function public.set_updated_at();
create trigger workout_sessions_set_updated_at before update on public.workout_sessions
for each row execute function public.set_updated_at();
create trigger workout_session_exercises_set_updated_at before update on public.workout_session_exercises
for each row execute function public.set_updated_at();
create trigger workout_sets_set_updated_at before update on public.workout_sets
for each row execute function public.set_updated_at();
create trigger activity_logs_set_updated_at before update on public.activity_logs
for each row execute function public.set_updated_at();
create trigger weight_logs_set_updated_at before update on public.weight_logs
for each row execute function public.set_updated_at();
create trigger nutrition_target_snapshots_set_updated_at before update on public.nutrition_target_snapshots
for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_locale public.app_locale;
begin
  requested_locale := case
    when new.raw_user_meta_data ->> 'locale' = 'pl' then 'pl'::public.app_locale
    else 'en'::public.app_locale
  end;

  insert into public.profiles (user_id, locale)
  values (new.id, requested_locale)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (user_id, locale)
select
  id,
  case
    when raw_user_meta_data ->> 'locale' = 'pl' then 'pl'::public.app_locale
    else 'en'::public.app_locale
  end
from auth.users
on conflict (user_id) do nothing;

create function public.complete_onboarding(
  preferred_locale public.app_locale,
  preferred_unit public.weight_unit,
  profile_sex_value public.profile_sex,
  birth_date date,
  body_height_cm numeric,
  profile_activity_level public.activity_level,
  profile_goal public.fitness_goal,
  initial_weight_kg numeric
)
returns public.profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  completed_profile public.profiles;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.profiles (
    user_id,
    locale,
    preferred_weight_unit,
    sex,
    date_of_birth,
    height_cm,
    activity_level,
    goal,
    onboarding_completed_at
  ) values (
    current_user_id,
    preferred_locale,
    preferred_unit,
    profile_sex_value,
    birth_date,
    body_height_cm,
    profile_activity_level,
    profile_goal,
    now()
  )
  on conflict (user_id) do update set
    locale = excluded.locale,
    preferred_weight_unit = excluded.preferred_weight_unit,
    sex = excluded.sex,
    date_of_birth = excluded.date_of_birth,
    height_cm = excluded.height_cm,
    activity_level = excluded.activity_level,
    goal = excluded.goal,
    onboarding_completed_at = excluded.onboarding_completed_at
  returning * into completed_profile;

  insert into public.weight_logs (user_id, weight_kg)
  values (current_user_id, initial_weight_kg);

  return completed_profile;
end;
$$;

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.activity_definitions enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_plan_exercises enable row level security;
alter table public.weekly_schedule_items enable row level security;
alter table public.daily_schedule_overrides enable row level security;
alter table public.daily_schedule_override_items enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.activity_logs enable row level security;
alter table public.weight_logs enable row level security;
alter table public.nutrition_target_snapshots enable row level security;

revoke all on table
  public.profiles,
  public.exercises,
  public.activity_definitions,
  public.workout_plans,
  public.workout_plan_exercises,
  public.weekly_schedule_items,
  public.daily_schedule_overrides,
  public.daily_schedule_override_items,
  public.workout_sessions,
  public.workout_session_exercises,
  public.workout_sets,
  public.activity_logs,
  public.weight_logs,
  public.nutrition_target_snapshots
from anon;

grant select, insert, update, delete on table
  public.profiles,
  public.exercises,
  public.activity_definitions,
  public.workout_plans,
  public.workout_plan_exercises,
  public.weekly_schedule_items,
  public.daily_schedule_overrides,
  public.daily_schedule_override_items,
  public.workout_sessions,
  public.workout_session_exercises,
  public.workout_sets,
  public.activity_logs,
  public.weight_logs,
  public.nutrition_target_snapshots
to authenticated;

revoke all on function public.complete_onboarding(
  public.app_locale,
  public.weight_unit,
  public.profile_sex,
  date,
  numeric,
  public.activity_level,
  public.fitness_goal,
  numeric
) from public, anon;
grant execute on function public.complete_onboarding(
  public.app_locale,
  public.weight_unit,
  public.profile_sex,
  date,
  numeric,
  public.activity_level,
  public.fitness_goal,
  numeric
) to authenticated;
