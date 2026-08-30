begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

set local session_replication_role = replica;

insert into auth.users (id)
values
  ('eb000000-0000-4000-8000-000000000001'),
  ('eb000000-0000-4000-8000-000000000002');

insert into public.profiles (user_id, locale)
values
  ('eb000000-0000-4000-8000-000000000001', 'en'),
  ('eb000000-0000-4000-8000-000000000002', 'pl');

set local session_replication_role = origin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'eb000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$
    insert into public.activity_definitions (
      id,
      owner_user_id,
      custom_name,
      is_custom
    ) values (
      'eb100000-0000-4000-8000-000000000001',
      'eb000000-0000-4000-8000-000000000001',
      'Climbing',
      true
    )
  $$,
  'A user can create a private custom activity'
);

select results_eq(
  $$select custom_name from public.activity_definitions where is_custom order by custom_name$$,
  $$values ('Climbing'::text)$$,
  'A user sees their own custom activity'
);

select lives_ok(
  $$
    insert into public.weight_logs (user_id, recorded_at, weight_kg)
    values
      ('eb000000-0000-4000-8000-000000000001', '2026-08-29 08:00:00+00', 70),
      ('eb000000-0000-4000-8000-000000000001', '2026-08-29 18:00:00+00', 70.5)
  $$,
  'The schema supports more than one weight entry on the same date'
);

select is(
  (
    select weight_kg
    from public.weight_logs
    where user_id = 'eb000000-0000-4000-8000-000000000001'
    order by recorded_at desc
    limit 1
  ),
  70.5::numeric,
  'The latest same-day weight entry can be selected as primary'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'eb000000-0000-4000-8000-000000000002', true);

select is_empty(
  $$select id from public.activity_definitions where is_custom$$,
  'Another user cannot see a private custom activity'
);

select is_empty(
  $$select id from public.weight_logs$$,
  'Another user cannot read weight history'
);

select * from finish();
rollback;
