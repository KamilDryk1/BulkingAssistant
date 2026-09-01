begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

set local session_replication_role = replica;

insert into auth.users (id)
values
  ('ec000000-0000-4000-8000-000000000001'),
  ('ec000000-0000-4000-8000-000000000002'),
  ('ec000000-0000-4000-8000-000000000003');

insert into public.profiles (user_id, locale, goal)
values
  ('ec000000-0000-4000-8000-000000000001', 'en', 'gain'),
  ('ec000000-0000-4000-8000-000000000002', 'pl', 'maintain'),
  ('ec000000-0000-4000-8000-000000000003', 'en', 'cut');

set local session_replication_role = origin;
set local role service_role;

select lives_ok(
  $$
    select * from public.claim_ai_daily_analysis(
      'ec000000-0000-4000-8000-000000000001',
      current_date,
      'Europe/Warsaw'
    )
  $$,
  'The service role can claim a daily analysis'
);

select is(
  (
    select count(*)::integer
    from public.ai_daily_analyses
    where user_id = 'ec000000-0000-4000-8000-000000000001'
      and analysis_date = current_date
  ),
  1,
  'A claim creates exactly one row for a user and local date'
);

select is(
  (
    select should_process
    from public.claim_ai_daily_analysis(
      'ec000000-0000-4000-8000-000000000001',
      current_date,
      'Europe/Warsaw'
    )
  ),
  false,
  'A repeated claim does not run the model twice'
);

select lives_ok(
  $$
    select public.complete_ai_daily_analysis(
      analysis_id_value => (
        select id from public.ai_daily_analyses
        where user_id = 'ec000000-0000-4000-8000-000000000001'
          and analysis_date = current_date
      ),
      processing_token_value => (
        select processing_token from public.ai_daily_analyses
        where user_id = 'ec000000-0000-4000-8000-000000000001'
          and analysis_date = current_date
      ),
      result_status => 'suggestion',
      result_outcome_reason => 'mock',
      result_category => 'nutrition',
      result_priority => 'medium',
      result_title => 'Small calorie change',
      result_message => 'The repeated trend supports a conservative adjustment.',
      result_evidence => '["Fourteen-day rolling trend"]'::jsonb,
      result_proposed_action => '{"type":"adjust_calories","value":150,"unit":"kcal"}'::jsonb,
      result_confidence => 'medium',
      result_context_version => 'daily-analysis-context-v1',
      result_model => null,
      result_provider_response_id => null
    )
  $$,
  'The service role can complete a claimed suggestion'
);

select lives_ok(
  $$
    select * from public.claim_ai_daily_analysis(
      'ec000000-0000-4000-8000-000000000003',
      current_date,
      'UTC'
    )
  $$,
  'A separate user analysis can be claimed for retry testing'
);

select lives_ok(
  $$
    select public.fail_ai_daily_analysis(
      analysis_id_value => (
        select id from public.ai_daily_analyses
        where user_id = 'ec000000-0000-4000-8000-000000000003'
          and analysis_date = current_date
      ),
      processing_token_value => (
        select processing_token from public.ai_daily_analyses
        where user_id = 'ec000000-0000-4000-8000-000000000003'
          and analysis_date = current_date
      ),
      failure_code => 'OPENAI_UNAVAILABLE'
    )
  $$,
  'A technical failure records a bounded retry window'
);

select is(
  (
    select should_process
    from public.claim_ai_daily_analysis(
      'ec000000-0000-4000-8000-000000000003',
      current_date,
      'UTC'
    )
  ),
  false,
  'A failed analysis cannot retry before its retry window'
);

update public.ai_daily_analyses
set retry_after = now() - interval '1 minute'
where user_id = 'ec000000-0000-4000-8000-000000000003'
  and analysis_date = current_date;

select is(
  (
    select should_process
    from public.claim_ai_daily_analysis(
      'ec000000-0000-4000-8000-000000000003',
      current_date,
      'UTC'
    )
  ),
  true,
  'A failed analysis becomes claimable after its retry window'
);

select is(
  (
    select attempt_count
    from public.ai_daily_analyses
    where user_id = 'ec000000-0000-4000-8000-000000000003'
      and analysis_date = current_date
  ),
  2,
  'Retrying rotates the processing claim and increments the attempt count'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ec000000-0000-4000-8000-000000000001', true);

select is(
  (select count(*)::integer from public.ai_daily_analyses),
  1,
  'A user can read their own analysis'
);

select ok(
  (
    select (public.claim_ai_daily_analysis_for_display(id)).first_shown_at is not null
    from public.ai_daily_analyses
    where analysis_date = current_date
  ),
  'A suggestion can be claimed for display once'
);

select is(
  (
    select (public.claim_ai_daily_analysis_for_display(id)).id
    from public.ai_daily_analyses
    where analysis_date = current_date
  ),
  null::uuid,
  'A displayed suggestion cannot be automatically presented twice'
);

select lives_ok(
  $$
    select public.accept_ai_daily_analysis(id)
    from public.ai_daily_analyses
    where analysis_date = current_date
  $$,
  'A user can accept their calorie adjustment'
);

select is(
  (
    select calorie_adjustment_calories
    from public.profiles
    where user_id = 'ec000000-0000-4000-8000-000000000001'
  ),
  150,
  'Accepting applies the proposed calorie delta atomically'
);

select lives_ok(
  $$
    select public.accept_ai_daily_analysis(id)
    from public.ai_daily_analyses
    where analysis_date = current_date
  $$,
  'Accepting the same suggestion again is idempotent'
);

select is(
  (
    select calorie_adjustment_calories
    from public.profiles
    where user_id = 'ec000000-0000-4000-8000-000000000001'
  ),
  150,
  'An idempotent retry does not apply the delta twice'
);

reset role;
set local role service_role;

select lives_ok(
  $$
    select * from public.claim_ai_daily_analysis(
      'ec000000-0000-4000-8000-000000000001',
      current_date + 1,
      'Europe/Warsaw'
    )
  $$,
  'The next local date can be claimed independently'
);

select lives_ok(
  $$
    select public.complete_ai_daily_analysis(
      analysis_id_value => (
        select id from public.ai_daily_analyses
        where user_id = 'ec000000-0000-4000-8000-000000000001'
          and analysis_date = current_date + 1
      ),
      processing_token_value => (
        select processing_token from public.ai_daily_analyses
        where user_id = 'ec000000-0000-4000-8000-000000000001'
          and analysis_date = current_date + 1
      ),
      result_status => 'suggestion',
      result_outcome_reason => 'mock',
      result_category => 'training',
      result_priority => 'low',
      result_title => 'Review training consistency',
      result_message => 'Several comparable sessions support a review.',
      result_evidence => '["Repeated comparable sessions"]'::jsonb,
      result_proposed_action => '{"type":"review_training","value":null,"unit":null}'::jsonb,
      result_confidence => 'medium',
      result_context_version => 'daily-analysis-context-v1',
      result_model => null,
      result_provider_response_id => null
    )
  $$,
  'A non-nutrition suggestion can be persisted without mutating a plan'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ec000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$
    select public.dismiss_ai_daily_analysis(id)
    from public.ai_daily_analyses
    where analysis_date = current_date + 1
  $$,
  'A user can dismiss a training review suggestion'
);

select ok(
  (
    select dismissed_at is not null and accepted_at is null
    from public.ai_daily_analyses
    where analysis_date = current_date + 1
  ),
  'Dismissal records the terminal interaction without accepting it'
);

select throws_ok(
  $$
    select * from public.claim_ai_daily_analysis(
      'ec000000-0000-4000-8000-000000000001',
      current_date,
      'Europe/Warsaw'
    )
  $$,
  '42501',
  'permission denied for function claim_ai_daily_analysis',
  'A user cannot call the service-only claim RPC'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ec000000-0000-4000-8000-000000000002', true);

select is_empty(
  $$select id from public.ai_daily_analyses$$,
  'Another user cannot read a private analysis'
);

select throws_ok(
  $$
    insert into public.ai_daily_analyses (
      user_id,
      analysis_date,
      analysis_time_zone
    ) values (
      'ec000000-0000-4000-8000-000000000002',
      current_date,
      'Europe/Warsaw'
    )
  $$,
  '42501',
  'permission denied for table ai_daily_analyses',
  'Clients cannot manufacture analysis records'
);

select is(
  (
    select calorie_adjustment_calories
    from public.profiles
    where user_id = 'ec000000-0000-4000-8000-000000000002'
  ),
  0,
  'Another user profile was not changed'
);

select * from finish();
rollback;
