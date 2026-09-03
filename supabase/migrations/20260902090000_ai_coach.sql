create type public.ai_conversation_status as enum ('idle', 'processing', 'failed');
create type public.ai_message_role as enum ('user', 'assistant');
create type public.ai_tool_kind as enum ('read', 'daily_write', 'persistent_write');
create type public.ai_tool_status as enum (
  'running',
  'awaiting_confirmation',
  'succeeded',
  'failed',
  'cancelled'
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  source_analysis_id uuid references public.ai_daily_analyses (id) on delete set null,
  status public.ai_conversation_status not null default 'idle',
  processing_token uuid,
  processing_started_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_conversations_title_check check (
    title is null or length(trim(title)) between 1 and 120
  ),
  constraint ai_conversations_processing_state_check check (
    (status = 'processing' and processing_token is not null and processing_started_at is not null)
    or (status <> 'processing' and processing_token is null and processing_started_at is null)
  ),
  unique (id, user_id)
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null,
  role public.ai_message_role not null,
  content text not null,
  client_request_id uuid,
  provider_response_id text,
  created_at timestamptz not null default now(),
  constraint ai_messages_conversation_owner_fk
    foreign key (conversation_id, user_id)
    references public.ai_conversations (id, user_id)
    on delete cascade,
  constraint ai_messages_content_check check (length(trim(content)) between 1 and 4000),
  constraint ai_messages_client_request_role_check check (
    client_request_id is null or role = 'user'
  )
);

create unique index ai_messages_user_client_request_idx
on public.ai_messages (user_id, client_request_id)
where client_request_id is not null;

create table public.ai_tool_runs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null,
  assistant_message_id uuid references public.ai_messages (id) on delete set null,
  provider_call_id text not null,
  provider_response_id text,
  tool_name text not null,
  tool_kind public.ai_tool_kind not null,
  arguments jsonb not null default '{}'::jsonb,
  result jsonb,
  status public.ai_tool_status not null,
  confirmation_summary text,
  high_level_change text,
  error_code text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_tool_runs_conversation_owner_fk
    foreign key (conversation_id, user_id)
    references public.ai_conversations (id, user_id)
    on delete cascade,
  constraint ai_tool_runs_name_check check (length(tool_name) between 1 and 80),
  constraint ai_tool_runs_confirmation_check check (
    (status = 'awaiting_confirmation' and tool_kind = 'persistent_write'
      and confirmation_summary is not null)
    or status <> 'awaiting_confirmation'
  ),
  unique (conversation_id, provider_call_id)
);

create index ai_conversations_user_updated_idx
  on public.ai_conversations (user_id, updated_at desc);
create index ai_messages_conversation_created_idx
  on public.ai_messages (conversation_id, created_at, id);
create index ai_tool_runs_conversation_created_idx
  on public.ai_tool_runs (conversation_id, created_at, id);
create index ai_tool_runs_user_pending_idx
  on public.ai_tool_runs (user_id, created_at desc)
  where status = 'awaiting_confirmation';

create trigger ai_conversations_set_updated_at
before update on public.ai_conversations
for each row execute function public.set_updated_at();

create trigger ai_tool_runs_set_updated_at
before update on public.ai_tool_runs
for each row execute function public.set_updated_at();

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_tool_runs enable row level security;

create policy ai_conversations_select_own on public.ai_conversations
for select to authenticated
using ((select auth.uid()) = user_id);

create policy ai_messages_select_own on public.ai_messages
for select to authenticated
using ((select auth.uid()) = user_id);

create policy ai_tool_runs_select_own on public.ai_tool_runs
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table
  public.ai_conversations,
  public.ai_messages,
  public.ai_tool_runs
from public, anon, authenticated;

grant select on table
  public.ai_conversations,
  public.ai_messages,
  public.ai_tool_runs
to authenticated;

grant select, insert, update, delete on table
  public.ai_conversations,
  public.ai_messages,
  public.ai_tool_runs
to service_role;

create table public.daily_workout_exercise_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  override_date date not null,
  workout_plan_id uuid not null references public.workout_plans (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, override_date, workout_plan_id)
);

create table public.daily_workout_exercise_override_items (
  id uuid primary key default gen_random_uuid(),
  daily_workout_override_id uuid not null
    references public.daily_workout_exercise_overrides (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (daily_workout_override_id, position),
  unique (daily_workout_override_id, exercise_id)
);

create index daily_workout_exercise_overrides_user_date_idx
  on public.daily_workout_exercise_overrides (user_id, override_date);
create index daily_workout_exercise_override_items_parent_position_idx
  on public.daily_workout_exercise_override_items (daily_workout_override_id, position);

create trigger daily_workout_exercise_overrides_set_updated_at
before update on public.daily_workout_exercise_overrides
for each row execute function public.set_updated_at();

alter table public.daily_workout_exercise_overrides enable row level security;
alter table public.daily_workout_exercise_override_items enable row level security;

create policy daily_workout_exercise_overrides_select_own
on public.daily_workout_exercise_overrides
for select to authenticated
using ((select auth.uid()) = user_id);

create policy daily_workout_exercise_override_items_select_own
on public.daily_workout_exercise_override_items
for select to authenticated
using (
  exists (
    select 1
    from public.daily_workout_exercise_overrides daily_override
    where daily_override.id = daily_workout_exercise_override_items.daily_workout_override_id
      and daily_override.user_id = (select auth.uid())
  )
);

revoke all on table
  public.daily_workout_exercise_overrides,
  public.daily_workout_exercise_override_items
from public, anon, authenticated;

grant select on table
  public.daily_workout_exercise_overrides,
  public.daily_workout_exercise_override_items
to authenticated;

grant select, insert, update, delete on table
  public.daily_workout_exercise_overrides,
  public.daily_workout_exercise_override_items
to service_role;

create function public.replace_daily_workout_exercises(
  override_date_value date,
  workout_plan_id_value uuid,
  ordered_exercise_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_exercise_ids uuid[] := coalesce(ordered_exercise_ids, array[]::uuid[]);
  available_exercise_count bigint;
  distinct_exercise_count bigint;
  daily_override_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if override_date_value is null then
    raise exception 'Override date is required' using errcode = '22023';
  end if;

  if cardinality(normalized_exercise_ids) not between 1 and 30 then
    raise exception 'A daily workout must contain between 1 and 30 exercises'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.workout_plans plan
    where plan.id = workout_plan_id_value
      and plan.user_id = current_user_id
  ) then
    raise exception 'Workout plan not found' using errcode = 'P0002';
  end if;

  select count(distinct candidate.exercise_id)
  into distinct_exercise_count
  from unnest(normalized_exercise_ids) as candidate(exercise_id);

  if distinct_exercise_count <> cardinality(normalized_exercise_ids) then
    raise exception 'A daily workout cannot contain duplicate exercises' using errcode = '22023';
  end if;

  select count(*)
  into available_exercise_count
  from public.exercises exercise
  where exercise.id = any(normalized_exercise_ids)
    and (exercise.owner_user_id is null or exercise.owner_user_id = current_user_id);

  if available_exercise_count <> cardinality(normalized_exercise_ids) then
    raise exception 'One or more exercises are not available to this user' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      current_user_id::text || ':' || override_date_value::text || ':' || workout_plan_id_value::text,
      0
    )
  );

  insert into public.daily_workout_exercise_overrides (
    user_id,
    override_date,
    workout_plan_id
  ) values (
    current_user_id,
    override_date_value,
    workout_plan_id_value
  )
  on conflict (user_id, override_date, workout_plan_id) do update
  set updated_at = now()
  returning id into daily_override_id;

  delete from public.daily_workout_exercise_override_items
  where daily_workout_override_id = daily_override_id;

  insert into public.daily_workout_exercise_override_items (
    daily_workout_override_id,
    exercise_id,
    position
  )
  select
    daily_override_id,
    ordered.exercise_id,
    (ordered.ordinality - 1)::integer
  from unnest(normalized_exercise_ids) with ordinality as ordered(exercise_id, ordinality);

  return daily_override_id;
end;
$$;

create function public.replace_active_workout_session_exercises(ordered_exercise_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_exercise_ids uuid[] := coalesce(ordered_exercise_ids, array[]::uuid[]);
  available_exercise_count bigint;
  distinct_exercise_count bigint;
  active_session_id uuid;
  profile_locale public.app_locale;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if cardinality(normalized_exercise_ids) not between 1 and 30 then
    raise exception 'An active workout must contain between 1 and 30 exercises'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 0)
  );

  select session.id, profile.locale
  into active_session_id, profile_locale
  from public.workout_sessions session
  join public.profiles profile on profile.user_id = session.user_id
  where session.user_id = current_user_id
    and session.completed_at is null
  limit 1
  for update of session;

  if active_session_id is null then
    raise exception 'Active workout session not found' using errcode = 'P0002';
  end if;

  select count(distinct candidate.exercise_id)
  into distinct_exercise_count
  from unnest(normalized_exercise_ids) as candidate(exercise_id);

  if distinct_exercise_count <> cardinality(normalized_exercise_ids) then
    raise exception 'An active workout cannot contain duplicate exercises' using errcode = '22023';
  end if;

  select count(*)
  into available_exercise_count
  from public.exercises exercise
  where exercise.id = any(normalized_exercise_ids)
    and (exercise.owner_user_id is null or exercise.owner_user_id = current_user_id);

  if available_exercise_count <> cardinality(normalized_exercise_ids) then
    raise exception 'One or more exercises are not available to this user' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.workout_session_exercises session_exercise
    where session_exercise.workout_session_id = active_session_id
      and session_exercise.exercise_id is null
  ) then
    raise exception 'An archived exercise snapshot cannot be modified automatically'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.workout_session_exercises session_exercise
    where session_exercise.workout_session_id = active_session_id
      and not (session_exercise.exercise_id = any(normalized_exercise_ids))
      and exists (
        select 1
        from public.workout_sets workout_set
        where workout_set.session_exercise_id = session_exercise.id
      )
  ) then
    raise exception 'An exercise with logged sets cannot be removed from the active session'
      using errcode = '55000';
  end if;

  delete from public.workout_session_exercises session_exercise
  where session_exercise.workout_session_id = active_session_id
    and not (session_exercise.exercise_id = any(normalized_exercise_ids));

  update public.workout_session_exercises
  set position = position + 1000
  where workout_session_id = active_session_id;

  insert into public.workout_session_exercises (
    workout_session_id,
    exercise_id,
    exercise_name_snapshot,
    muscle_group_snapshot,
    equipment_snapshot,
    position
  )
  select
    active_session_id,
    exercise.id,
    case
      when exercise.is_custom then exercise.custom_name
      when profile_locale = 'pl' then coalesce(exercise.name_pl, exercise.name_en)
      else coalesce(exercise.name_en, exercise.name_pl)
    end,
    exercise.muscle_group,
    exercise.equipment,
    2000 + ordered.ordinality::integer
  from unnest(normalized_exercise_ids) with ordinality as ordered(exercise_id, ordinality)
  join public.exercises exercise on exercise.id = ordered.exercise_id
  where not exists (
    select 1
    from public.workout_session_exercises existing
    where existing.workout_session_id = active_session_id
      and existing.exercise_id = ordered.exercise_id
  );

  with desired_positions as (
    select ordered.exercise_id, (ordered.ordinality - 1)::integer as position
    from unnest(normalized_exercise_ids) with ordinality as ordered(exercise_id, ordinality)
  )
  update public.workout_session_exercises session_exercise
  set position = desired.position
  from desired_positions desired
  where session_exercise.workout_session_id = active_session_id
    and session_exercise.exercise_id = desired.exercise_id;

  return active_session_id;
end;
$$;

create function public.save_ai_workout_plan(
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

  select public.save_workout_plan(
    idempotency_plan_id,
    workout_plan_name,
    ordered_exercise_ids
  ) into saved_plan;

  return saved_plan;
end;
$$;

revoke all on function public.replace_daily_workout_exercises(date, uuid, uuid[])
from public, anon;
grant execute on function public.replace_daily_workout_exercises(date, uuid, uuid[])
to authenticated;

revoke all on function public.replace_active_workout_session_exercises(uuid[])
from public, anon;
grant execute on function public.replace_active_workout_session_exercises(uuid[])
to authenticated;

revoke all on function public.save_ai_workout_plan(uuid, text, uuid[])
from public, anon;
grant execute on function public.save_ai_workout_plan(uuid, text, uuid[])
to authenticated;

create or replace function public.start_workout_session(
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
    from public.daily_workout_exercise_overrides daily_override
    join public.daily_workout_exercise_override_items item
      on item.daily_workout_override_id = daily_override.id
    where daily_override.user_id = current_user_id
      and daily_override.override_date = session_date_value
      and daily_override.workout_plan_id = workout_plan_id_value
  ) and not exists (
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
  with selected_exercises as (
    select item.exercise_id, item.position
    from public.daily_workout_exercise_overrides daily_override
    join public.daily_workout_exercise_override_items item
      on item.daily_workout_override_id = daily_override.id
    where daily_override.user_id = current_user_id
      and daily_override.override_date = session_date_value
      and daily_override.workout_plan_id = workout_plan_id_value

    union all

    select plan_exercise.exercise_id, plan_exercise.position
    from public.workout_plan_exercises plan_exercise
    where plan_exercise.workout_plan_id = workout_plan_id_value
      and not exists (
        select 1
        from public.daily_workout_exercise_overrides daily_override
        where daily_override.user_id = current_user_id
          and daily_override.override_date = session_date_value
          and daily_override.workout_plan_id = workout_plan_id_value
      )
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
    selected.position
  from selected_exercises selected
  join public.exercises exercise on exercise.id = selected.exercise_id
  order by selected.position;

  return session_id;
end;
$$;

create function public.begin_ai_coach_turn(
  request_user_id uuid,
  requested_conversation_id uuid,
  user_message_content text,
  user_client_request_id uuid,
  requested_source_analysis_id uuid default null
)
returns table (
  conversation_id uuid,
  user_message_id uuid,
  processing_token uuid,
  should_process boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_conversation public.ai_conversations;
  existing_message public.ai_messages;
  new_message_id uuid;
  new_processing_token uuid := gen_random_uuid();
  normalized_content text := trim(user_message_content);
begin
  if request_user_id is null or user_client_request_id is null then
    raise exception 'User and request IDs are required' using errcode = '22023';
  end if;

  if length(normalized_content) not between 1 and 2000 then
    raise exception 'Coach message must contain between 1 and 2000 characters'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(request_user_id::text || ':' || user_client_request_id::text, 0)
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(request_user_id::text, 20260902)
  );

  select message.*
  into existing_message
  from public.ai_messages message
  where message.user_id = request_user_id
    and message.client_request_id = user_client_request_id;

  if found then
    select conversation.*
    into target_conversation
    from public.ai_conversations conversation
    where conversation.id = existing_message.conversation_id
      and conversation.user_id = request_user_id
    for update;

    if exists (
      select 1
      from public.ai_messages assistant_message
      where assistant_message.conversation_id = existing_message.conversation_id
        and assistant_message.role = 'assistant'
        and assistant_message.created_at >= existing_message.created_at
    ) or exists (
      select 1
      from public.ai_tool_runs tool_run
      where tool_run.conversation_id = existing_message.conversation_id
        and tool_run.user_id = request_user_id
        and tool_run.status = 'running'
        and tool_run.updated_at > now() - interval '2 minutes'
    ) or (
      target_conversation.status = 'processing'
      and target_conversation.processing_started_at > now() - interval '2 minutes'
    ) then
      return query select
        existing_message.conversation_id,
        existing_message.id,
        null::uuid,
        false;
      return;
    end if;

    update public.ai_conversations
    set
      status = 'processing',
      processing_token = new_processing_token,
      processing_started_at = now(),
      last_error_code = null,
      updated_at = now()
    where id = existing_message.conversation_id;

    return query select
      existing_message.conversation_id,
      existing_message.id,
      new_processing_token,
      true;
    return;
  end if;

  if (
    select count(*)
    from public.ai_messages message
    where message.user_id = request_user_id
      and message.role = 'user'
      and message.created_at > now() - interval '1 minute'
  ) >= 8 then
    raise exception 'Coach message rate limit exceeded' using errcode = '54000';
  end if;

  if requested_source_analysis_id is not null and not exists (
    select 1
    from public.ai_daily_analyses analysis
    where analysis.id = requested_source_analysis_id
      and analysis.user_id = request_user_id
      and analysis.status = 'suggestion'
  ) then
    raise exception 'Daily analysis not found' using errcode = 'P0002';
  end if;

  if requested_conversation_id is null then
    insert into public.ai_conversations (
      user_id,
      title,
      source_analysis_id,
      status,
      processing_token,
      processing_started_at
    ) values (
      request_user_id,
      left(normalized_content, 80),
      requested_source_analysis_id,
      'processing',
      new_processing_token,
      now()
    )
    returning * into target_conversation;
  else
    select conversation.*
    into target_conversation
    from public.ai_conversations conversation
    where conversation.id = requested_conversation_id
      and conversation.user_id = request_user_id
    for update;

    if not found then
      raise exception 'Coach conversation not found' using errcode = 'P0002';
    end if;

    if target_conversation.status = 'processing'
      and target_conversation.processing_started_at > now() - interval '2 minutes'
    then
      raise exception 'Coach is already responding' using errcode = '55000';
    end if;

    if exists (
      select 1
      from public.ai_tool_runs tool_run
      where tool_run.conversation_id = target_conversation.id
        and tool_run.user_id = request_user_id
        and tool_run.status = 'running'
        and tool_run.updated_at > now() - interval '2 minutes'
    ) then
      raise exception 'Coach action is still being processed' using errcode = '55000';
    end if;

    update public.ai_conversations
    set
      source_analysis_id = coalesce(source_analysis_id, requested_source_analysis_id),
      status = 'processing',
      processing_token = new_processing_token,
      processing_started_at = now(),
      last_error_code = null,
      updated_at = now()
    where id = target_conversation.id
    returning * into target_conversation;
  end if;

  insert into public.ai_messages (
    conversation_id,
    user_id,
    role,
    content,
    client_request_id
  ) values (
    target_conversation.id,
    request_user_id,
    'user',
    normalized_content,
    user_client_request_id
  )
  returning id into new_message_id;

  return query select
    target_conversation.id,
    new_message_id,
    new_processing_token,
    true;
end;
$$;

create function public.complete_ai_coach_turn(
  request_user_id uuid,
  requested_conversation_id uuid,
  requested_processing_token uuid,
  assistant_message_content text,
  response_id text default null
)
returns public.ai_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_content text := trim(assistant_message_content);
  claimed_conversation public.ai_conversations;
  saved_message public.ai_messages;
begin
  if length(normalized_content) not between 1 and 4000 then
    raise exception 'Assistant message must contain between 1 and 4000 characters'
      using errcode = '22023';
  end if;

  select conversation.*
  into claimed_conversation
  from public.ai_conversations conversation
  where conversation.id = requested_conversation_id
    and conversation.user_id = request_user_id
    and conversation.status = 'processing'
    and conversation.processing_token = requested_processing_token
  for update;

  if claimed_conversation.id is null then
    raise exception 'Coach processing claim is no longer valid' using errcode = '55000';
  end if;

  insert into public.ai_messages (
    conversation_id,
    user_id,
    role,
    content,
    provider_response_id
  ) values (
    requested_conversation_id,
    request_user_id,
    'assistant',
    normalized_content,
    response_id
  )
  returning * into saved_message;

  update public.ai_conversations
  set
    status = 'idle',
    processing_token = null,
    processing_started_at = null,
    last_error_code = null,
    updated_at = now()
  where id = requested_conversation_id;

  return saved_message;
end;
$$;

create function public.fail_ai_coach_turn(
  request_user_id uuid,
  requested_conversation_id uuid,
  requested_processing_token uuid,
  failure_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ai_conversations
  set
    status = 'failed',
    processing_token = null,
    processing_started_at = null,
    last_error_code = left(regexp_replace(upper(failure_code), '[^A-Z0-9_]', '_', 'g'), 80),
    updated_at = now()
  where id = requested_conversation_id
    and user_id = request_user_id
    and status = 'processing'
    and processing_token = requested_processing_token;
end;
$$;

create function public.claim_ai_coach_confirmation(
  request_user_id uuid,
  requested_tool_run_id uuid
)
returns table (
  conversation_id uuid,
  processing_token uuid,
  tool_name text,
  tool_arguments jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_run public.ai_tool_runs;
  target_conversation public.ai_conversations;
  new_processing_token uuid := gen_random_uuid();
begin
  select tool_run.*
  into target_run
  from public.ai_tool_runs tool_run
  where tool_run.id = requested_tool_run_id
    and tool_run.user_id = request_user_id
  for update;

  if not found or target_run.status not in ('awaiting_confirmation', 'running') then
    raise exception 'Pending Coach action not found' using errcode = 'P0002';
  end if;

  if target_run.tool_kind <> 'persistent_write' then
    raise exception 'Coach action does not require confirmation' using errcode = '22023';
  end if;

  if target_run.status = 'running' and target_run.updated_at > now() - interval '2 minutes' then
    raise exception 'Coach action is already being applied' using errcode = '55000';
  end if;

  select conversation.*
  into target_conversation
  from public.ai_conversations conversation
  where conversation.id = target_run.conversation_id
    and conversation.user_id = request_user_id
  for update;

  if target_conversation.status = 'processing'
    and target_conversation.processing_started_at > now() - interval '2 minutes'
  then
    raise exception 'Coach is already responding' using errcode = '55000';
  end if;

  update public.ai_tool_runs
  set status = 'running', confirmed_at = coalesce(confirmed_at, now()), updated_at = now()
  where id = target_run.id;

  update public.ai_conversations
  set
    status = 'processing',
    processing_token = new_processing_token,
    processing_started_at = now(),
    last_error_code = null,
    updated_at = now()
  where id = target_run.conversation_id;

  return query select
    target_run.conversation_id,
    new_processing_token,
    target_run.tool_name,
    target_run.arguments;
end;
$$;

revoke all on function public.begin_ai_coach_turn(uuid, uuid, text, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.begin_ai_coach_turn(uuid, uuid, text, uuid, uuid)
to service_role;

revoke all on function public.complete_ai_coach_turn(uuid, uuid, uuid, text, text)
from public, anon, authenticated;
grant execute on function public.complete_ai_coach_turn(uuid, uuid, uuid, text, text)
to service_role;

revoke all on function public.fail_ai_coach_turn(uuid, uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.fail_ai_coach_turn(uuid, uuid, uuid, text)
to service_role;

revoke all on function public.claim_ai_coach_confirmation(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.claim_ai_coach_confirmation(uuid, uuid)
to service_role;
