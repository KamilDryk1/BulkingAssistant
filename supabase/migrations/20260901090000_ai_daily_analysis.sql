alter table public.profiles
  add column calorie_adjustment_calories integer not null default 0,
  add column goal_changed_at timestamptz;

alter table public.profiles
  add constraint profiles_calorie_adjustment_check check (
    calorie_adjustment_calories between -1000 and 1000
  );

update public.profiles
set goal_changed_at = coalesce(onboarding_completed_at, updated_at, created_at)
where goal is not null;

create function public.track_profile_goal_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.goal is distinct from old.goal then
    new.goal_changed_at = now();
  end if;

  return new;
end;
$$;

create trigger profiles_track_goal_change
before update on public.profiles
for each row execute function public.track_profile_goal_change();

alter table public.nutrition_target_snapshots
  add column base_calories integer,
  add column calorie_adjustment_calories integer not null default 0;

update public.nutrition_target_snapshots
set base_calories = calories;

alter table public.nutrition_target_snapshots
  alter column base_calories set not null,
  add constraint nutrition_target_snapshots_base_calories_check check (base_calories > 0),
  add constraint nutrition_target_snapshots_calorie_adjustment_check check (
    calorie_adjustment_calories between -1000 and 1000
    and calories = base_calories + calorie_adjustment_calories
  );

create type public.ai_analysis_status as enum (
  'pending',
  'failed',
  'no_action',
  'suggestion'
);

create type public.ai_analysis_category as enum (
  'none',
  'nutrition',
  'training',
  'recovery',
  'adherence',
  'activity'
);

create type public.ai_analysis_priority as enum ('low', 'medium', 'high');
create type public.ai_analysis_confidence as enum ('low', 'medium', 'high');
create type public.ai_analysis_outcome_reason as enum (
  'model',
  'insufficient_data',
  'disabled',
  'mock'
);

create table public.ai_daily_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  analysis_date date not null,
  analysis_time_zone text not null,
  status public.ai_analysis_status not null default 'pending',
  outcome_reason public.ai_analysis_outcome_reason,
  category public.ai_analysis_category,
  priority public.ai_analysis_priority,
  title text,
  message text,
  evidence jsonb not null default '[]'::jsonb,
  proposed_action jsonb,
  confidence public.ai_analysis_confidence,
  context_version text,
  model text,
  provider_response_id text,
  processing_token uuid not null default gen_random_uuid(),
  attempt_count integer not null default 1,
  processing_started_at timestamptz not null default now(),
  completed_at timestamptz,
  retry_after timestamptz,
  error_code text,
  first_shown_at timestamptz,
  accepted_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, analysis_date),
  constraint ai_daily_analyses_time_zone_check check (
    length(analysis_time_zone) between 1 and 100
  ),
  constraint ai_daily_analyses_attempt_count_check check (attempt_count > 0),
  constraint ai_daily_analyses_evidence_check check (
    jsonb_typeof(evidence) = 'array'
    and jsonb_array_length(evidence) <= 4
  ),
  constraint ai_daily_analyses_proposed_action_check check (
    proposed_action is null
    or (
      jsonb_typeof(proposed_action) = 'object'
      and proposed_action ? 'type'
      and proposed_action ? 'value'
      and proposed_action ? 'unit'
      and proposed_action ->> 'type' in (
        'none',
        'adjust_calories',
        'review_training',
        'review_schedule'
      )
    )
  ),
  constraint ai_daily_analyses_result_state_check check (
    (
      status in ('pending', 'failed')
      and outcome_reason is null
      and category is null
      and priority is null
      and title is null
      and message is null
      and evidence = '[]'::jsonb
      and proposed_action is null
      and confidence is null
      and completed_at is null
    )
    or (
      status = 'no_action'
      and outcome_reason is not null
      and category = 'none'
      and priority is not null
      and title is null
      and message is null
      and evidence = '[]'::jsonb
      and proposed_action is not null
      and proposed_action ->> 'type' = 'none'
      and proposed_action -> 'value' = 'null'::jsonb
      and proposed_action -> 'unit' = 'null'::jsonb
      and confidence is not null
      and completed_at is not null
    )
    or (
      status = 'suggestion'
      and outcome_reason in ('model', 'mock')
      and category is not null
      and category <> 'none'
      and priority is not null
      and length(trim(coalesce(title, ''))) between 1 and 120
      and length(trim(coalesce(message, ''))) between 1 and 600
      and jsonb_array_length(evidence) between 1 and 4
      and proposed_action is not null
      and confidence is not null
      and completed_at is not null
    )
  ),
  constraint ai_daily_analyses_failure_state_check check (
    (status = 'failed' and retry_after is not null and error_code is not null)
    or (status <> 'failed' and retry_after is null and error_code is null)
  ),
  constraint ai_daily_analyses_interaction_state_check check (
    not (accepted_at is not null and dismissed_at is not null)
    and (first_shown_at is null or status = 'suggestion')
    and (accepted_at is null or status = 'suggestion')
    and (dismissed_at is null or status = 'suggestion')
  )
);

create index ai_daily_analyses_user_created_at_idx
  on public.ai_daily_analyses (user_id, created_at desc);
create index ai_daily_analyses_retry_idx
  on public.ai_daily_analyses (status, retry_after)
  where status in ('pending', 'failed');

create trigger ai_daily_analyses_set_updated_at
before update on public.ai_daily_analyses
for each row execute function public.set_updated_at();

alter table public.ai_daily_analyses enable row level security;

create policy ai_daily_analyses_select_own on public.ai_daily_analyses
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.ai_daily_analyses from public, anon, authenticated;
grant select on table public.ai_daily_analyses to authenticated;
grant select, insert, update, delete on table public.ai_daily_analyses to service_role;

create function public.claim_ai_daily_analysis(
  analysis_user_id uuid,
  requested_analysis_date date,
  requested_time_zone text
)
returns table (
  analysis_id uuid,
  processing_token uuid,
  should_process boolean,
  analysis_status public.ai_analysis_status
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed_id uuid;
  claimed_token uuid;
  claimed_status public.ai_analysis_status;
begin
  if requested_analysis_date < current_date - 1
    or requested_analysis_date > current_date + 1 then
    raise exception 'Analysis date must be the current local date'
      using errcode = '22023';
  end if;

  if length(trim(requested_time_zone)) not between 1 and 100 then
    raise exception 'Invalid analysis time zone' using errcode = '22023';
  end if;

  insert into public.ai_daily_analyses (
    user_id,
    analysis_date,
    analysis_time_zone
  ) values (
    analysis_user_id,
    requested_analysis_date,
    trim(requested_time_zone)
  )
  on conflict (user_id, analysis_date) do nothing
  returning id, ai_daily_analyses.processing_token, status
  into claimed_id, claimed_token, claimed_status;

  if claimed_id is not null then
    return query select claimed_id, claimed_token, true, claimed_status;
    return;
  end if;

  update public.ai_daily_analyses as analysis
  set
    status = 'pending',
    processing_token = gen_random_uuid(),
    attempt_count = analysis.attempt_count + 1,
    processing_started_at = now(),
    retry_after = null,
    error_code = null
  where analysis.user_id = analysis_user_id
    and analysis.analysis_date = requested_analysis_date
    and (
      (
        analysis.status = 'failed'
        and analysis.retry_after <= now()
      )
      or (
        analysis.status = 'pending'
        and analysis.processing_started_at <= now() - interval '10 minutes'
      )
    )
  returning analysis.id, analysis.processing_token, analysis.status
  into claimed_id, claimed_token, claimed_status;

  if claimed_id is not null then
    return query select claimed_id, claimed_token, true, claimed_status;
    return;
  end if;

  return query
  select analysis.id, analysis.processing_token, false, analysis.status
  from public.ai_daily_analyses as analysis
  where analysis.user_id = analysis_user_id
    and analysis.analysis_date = requested_analysis_date;
end;
$$;

create function public.complete_ai_daily_analysis(
  analysis_id_value uuid,
  processing_token_value uuid,
  result_status public.ai_analysis_status,
  result_outcome_reason public.ai_analysis_outcome_reason,
  result_category public.ai_analysis_category,
  result_priority public.ai_analysis_priority,
  result_title text,
  result_message text,
  result_evidence jsonb,
  result_proposed_action jsonb,
  result_confidence public.ai_analysis_confidence,
  result_context_version text,
  result_model text,
  result_provider_response_id text
)
returns public.ai_daily_analyses
language plpgsql
security invoker
set search_path = ''
as $$
declare
  completed_analysis public.ai_daily_analyses;
begin
  if result_status not in ('no_action', 'suggestion') then
    raise exception 'Invalid completed analysis status' using errcode = '22023';
  end if;

  update public.ai_daily_analyses as analysis
  set
    status = result_status,
    outcome_reason = result_outcome_reason,
    category = result_category,
    priority = result_priority,
    title = result_title,
    message = result_message,
    evidence = result_evidence,
    proposed_action = result_proposed_action,
    confidence = result_confidence,
    context_version = result_context_version,
    model = result_model,
    provider_response_id = result_provider_response_id,
    completed_at = now(),
    retry_after = null,
    error_code = null
  where analysis.id = analysis_id_value
    and analysis.processing_token = processing_token_value
    and analysis.status = 'pending'
  returning analysis.* into completed_analysis;

  if completed_analysis.id is null then
    raise exception 'Analysis claim is no longer active' using errcode = 'P0002';
  end if;

  return completed_analysis;
end;
$$;

create function public.fail_ai_daily_analysis(
  analysis_id_value uuid,
  processing_token_value uuid,
  failure_code text,
  retry_delay interval default interval '15 minutes'
)
returns public.ai_daily_analyses
language plpgsql
security invoker
set search_path = ''
as $$
declare
  failed_analysis public.ai_daily_analyses;
begin
  if length(trim(failure_code)) not between 1 and 80 then
    raise exception 'Invalid failure code' using errcode = '22023';
  end if;

  update public.ai_daily_analyses as analysis
  set
    status = 'failed',
    retry_after = now() + greatest(retry_delay, interval '1 minute'),
    error_code = trim(failure_code)
  where analysis.id = analysis_id_value
    and analysis.processing_token = processing_token_value
    and analysis.status = 'pending'
  returning analysis.* into failed_analysis;

  if failed_analysis.id is null then
    raise exception 'Analysis claim is no longer active' using errcode = 'P0002';
  end if;

  return failed_analysis;
end;
$$;

create function public.claim_ai_daily_analysis_for_display(analysis_id_value uuid)
returns public.ai_daily_analyses
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_analysis public.ai_daily_analyses;
begin
  update public.ai_daily_analyses as analysis
  set first_shown_at = now()
  where analysis.id = analysis_id_value
    and analysis.user_id = (select auth.uid())
    and analysis.status = 'suggestion'
    and analysis.first_shown_at is null
    and analysis.accepted_at is null
    and analysis.dismissed_at is null
  returning analysis.* into claimed_analysis;

  return claimed_analysis;
end;
$$;

create function public.dismiss_ai_daily_analysis(analysis_id_value uuid)
returns public.ai_daily_analyses
language plpgsql
security definer
set search_path = ''
as $$
declare
  dismissed_analysis public.ai_daily_analyses;
begin
  update public.ai_daily_analyses as analysis
  set
    first_shown_at = coalesce(analysis.first_shown_at, now()),
    dismissed_at = coalesce(analysis.dismissed_at, now())
  where analysis.id = analysis_id_value
    and analysis.user_id = (select auth.uid())
    and analysis.status = 'suggestion'
    and analysis.accepted_at is null
  returning analysis.* into dismissed_analysis;

  if dismissed_analysis.id is null then
    raise exception 'Daily analysis suggestion not found' using errcode = 'P0002';
  end if;

  return dismissed_analysis;
end;
$$;

create function public.accept_ai_daily_analysis(analysis_id_value uuid)
returns public.ai_daily_analyses
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_analysis public.ai_daily_analyses;
  accepted_analysis public.ai_daily_analyses;
  adjustment_delta integer;
  current_adjustment integer;
begin
  select analysis.* into selected_analysis
  from public.ai_daily_analyses as analysis
  where analysis.id = analysis_id_value
    and analysis.user_id = (select auth.uid())
    and analysis.status = 'suggestion'
  for update;

  if selected_analysis.id is null then
    raise exception 'Daily analysis suggestion not found' using errcode = 'P0002';
  end if;

  if selected_analysis.accepted_at is not null then
    return selected_analysis;
  end if;

  if selected_analysis.dismissed_at is not null then
    raise exception 'Dismissed suggestion cannot be accepted' using errcode = '22023';
  end if;

  if selected_analysis.category <> 'nutrition'
    or selected_analysis.proposed_action ->> 'type' <> 'adjust_calories'
    or selected_analysis.proposed_action ->> 'unit' <> 'kcal'
    or coalesce(selected_analysis.proposed_action ->> 'value', '') !~ '^-?[0-9]+$' then
    raise exception 'Suggestion does not contain an applicable calorie adjustment'
      using errcode = '22023';
  end if;

  adjustment_delta := (selected_analysis.proposed_action ->> 'value')::integer;

  if adjustment_delta = 0
    or abs(adjustment_delta) > 300
    or mod(abs(adjustment_delta), 50) <> 0 then
    raise exception 'Calorie adjustment must be a non-zero 50 kcal step up to 300 kcal'
      using errcode = '22023';
  end if;

  select profile.calorie_adjustment_calories into current_adjustment
  from public.profiles as profile
  where profile.user_id = (select auth.uid())
  for update;

  if current_adjustment is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  if current_adjustment + adjustment_delta not between -1000 and 1000 then
    raise exception 'Resulting calorie adjustment is outside the supported range'
      using errcode = '22023';
  end if;

  update public.profiles
  set calorie_adjustment_calories = current_adjustment + adjustment_delta
  where user_id = (select auth.uid());

  update public.ai_daily_analyses as analysis
  set
    first_shown_at = coalesce(analysis.first_shown_at, now()),
    accepted_at = now()
  where analysis.id = selected_analysis.id
  returning analysis.* into accepted_analysis;

  return accepted_analysis;
end;
$$;

revoke all on function public.claim_ai_daily_analysis(uuid, date, text)
from public, anon, authenticated;
grant execute on function public.claim_ai_daily_analysis(uuid, date, text)
to service_role;

revoke all on function public.complete_ai_daily_analysis(
  uuid,
  uuid,
  public.ai_analysis_status,
  public.ai_analysis_outcome_reason,
  public.ai_analysis_category,
  public.ai_analysis_priority,
  text,
  text,
  jsonb,
  jsonb,
  public.ai_analysis_confidence,
  text,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.complete_ai_daily_analysis(
  uuid,
  uuid,
  public.ai_analysis_status,
  public.ai_analysis_outcome_reason,
  public.ai_analysis_category,
  public.ai_analysis_priority,
  text,
  text,
  jsonb,
  jsonb,
  public.ai_analysis_confidence,
  text,
  text,
  text
) to service_role;

revoke all on function public.fail_ai_daily_analysis(uuid, uuid, text, interval)
from public, anon, authenticated;
grant execute on function public.fail_ai_daily_analysis(uuid, uuid, text, interval)
to service_role;

revoke all on function public.claim_ai_daily_analysis_for_display(uuid) from public, anon;
grant execute on function public.claim_ai_daily_analysis_for_display(uuid) to authenticated;

revoke all on function public.dismiss_ai_daily_analysis(uuid) from public, anon;
grant execute on function public.dismiss_ai_daily_analysis(uuid) to authenticated;

revoke all on function public.accept_ai_daily_analysis(uuid) from public, anon;
grant execute on function public.accept_ai_daily_analysis(uuid) to authenticated;
