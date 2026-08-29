begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

set local session_replication_role = replica;

insert into auth.users (id)
values
  ('ea000000-0000-4000-8000-000000000001'),
  ('ea000000-0000-4000-8000-000000000002');

insert into public.profiles (user_id, locale)
values
  ('ea000000-0000-4000-8000-000000000001', 'en'),
  ('ea000000-0000-4000-8000-000000000002', 'pl');

insert into public.activity_definitions (
  id,
  owner_user_id,
  slug,
  name_en,
  name_pl,
  custom_name,
  is_custom
) values
  (
    'ea100000-0000-4000-8000-000000000001',
    null,
    'today-test-global',
    'Cycling',
    'Jazda na rowerze',
    null,
    false
  ),
  (
    'ea100000-0000-4000-8000-000000000002',
    'ea000000-0000-4000-8000-000000000002',
    null,
    null,
    null,
    'Private activity',
    true
  );

set local session_replication_role = origin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ea000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$
    insert into public.activity_logs (
      user_id,
      activity_definition_id,
      activity_name_snapshot,
      activity_date,
      duration_minutes,
      intensity
    ) values (
      'ea000000-0000-4000-8000-000000000001',
      'ea100000-0000-4000-8000-000000000001',
      'Cycling',
      '2026-08-29',
      45,
      'moderate'
    )
  $$,
  'A user can log an available activity for today'
);

select is(
  (
    select activity_name_snapshot
    from public.activity_logs
    where user_id = 'ea000000-0000-4000-8000-000000000001'
  ),
  'Cycling',
  'An activity log keeps its localized name snapshot'
);

select throws_ok(
  $$
    insert into public.activity_logs (
      user_id,
      activity_definition_id,
      activity_name_snapshot,
      activity_date
    ) values (
      'ea000000-0000-4000-8000-000000000001',
      'ea100000-0000-4000-8000-000000000002',
      'Private activity',
      '2026-08-29'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "activity_logs"',
  'A user cannot log another user private activity'
);

select lives_ok(
  $$
    insert into public.nutrition_target_snapshots (
      user_id,
      target_date,
      calories,
      protein_grams,
      carbohydrate_grams,
      fat_grams,
      calculation_version
    ) values (
      'ea000000-0000-4000-8000-000000000001',
      '2026-08-29',
      2750,
      150,
      350,
      80,
      'mifflin-st-jeor-v1'
    )
  $$,
  'A user can persist their deterministic nutrition target snapshot'
);

select lives_ok(
  $$
    insert into public.weight_logs (user_id, weight_kg)
    values ('ea000000-0000-4000-8000-000000000001', 70.2)
  $$,
  'A user can log today's body weight'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ea000000-0000-4000-8000-000000000002', true);

select is_empty(
  $$select id from public.activity_logs$$,
  'Another user cannot read today's activity logs'
);

select is_empty(
  $$select id from public.nutrition_target_snapshots$$,
  'Another user cannot read nutrition target snapshots'
);

select * from finish();
rollback;
