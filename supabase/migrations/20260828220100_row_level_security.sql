create policy profiles_select_own on public.profiles
for select to authenticated
using ((select auth.uid()) = user_id);

create policy profiles_insert_own on public.profiles
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy profiles_update_own on public.profiles
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy profiles_delete_own on public.profiles
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy exercises_select_available on public.exercises
for select to authenticated
using (owner_user_id is null or owner_user_id = (select auth.uid()));

create policy exercises_insert_custom_own on public.exercises
for insert to authenticated
with check (is_custom = true and owner_user_id = (select auth.uid()));

create policy exercises_update_custom_own on public.exercises
for update to authenticated
using (is_custom = true and owner_user_id = (select auth.uid()))
with check (is_custom = true and owner_user_id = (select auth.uid()));

create policy exercises_delete_custom_own on public.exercises
for delete to authenticated
using (is_custom = true and owner_user_id = (select auth.uid()));

create policy activity_definitions_select_available on public.activity_definitions
for select to authenticated
using (owner_user_id is null or owner_user_id = (select auth.uid()));

create policy activity_definitions_insert_custom_own on public.activity_definitions
for insert to authenticated
with check (is_custom = true and owner_user_id = (select auth.uid()));

create policy activity_definitions_update_custom_own on public.activity_definitions
for update to authenticated
using (is_custom = true and owner_user_id = (select auth.uid()))
with check (is_custom = true and owner_user_id = (select auth.uid()));

create policy activity_definitions_delete_custom_own on public.activity_definitions
for delete to authenticated
using (is_custom = true and owner_user_id = (select auth.uid()));

create policy workout_plans_select_own on public.workout_plans
for select to authenticated
using ((select auth.uid()) = user_id);

create policy workout_plans_insert_own on public.workout_plans
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy workout_plans_update_own on public.workout_plans
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy workout_plans_delete_own on public.workout_plans
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy workout_plan_exercises_select_own on public.workout_plan_exercises
for select to authenticated
using (
  exists (
    select 1
    from public.workout_plans plan
    where plan.id = workout_plan_id
      and plan.user_id = (select auth.uid())
  )
);

create policy workout_plan_exercises_insert_own on public.workout_plan_exercises
for insert to authenticated
with check (
  exists (
    select 1
    from public.workout_plans plan
    where plan.id = workout_plan_id
      and plan.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.exercises exercise
    where exercise.id = exercise_id
      and (exercise.owner_user_id is null or exercise.owner_user_id = (select auth.uid()))
  )
);

create policy workout_plan_exercises_update_own on public.workout_plan_exercises
for update to authenticated
using (
  exists (
    select 1
    from public.workout_plans plan
    where plan.id = workout_plan_id
      and plan.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.workout_plans plan
    where plan.id = workout_plan_id
      and plan.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.exercises exercise
    where exercise.id = exercise_id
      and (exercise.owner_user_id is null or exercise.owner_user_id = (select auth.uid()))
  )
);

create policy workout_plan_exercises_delete_own on public.workout_plan_exercises
for delete to authenticated
using (
  exists (
    select 1
    from public.workout_plans plan
    where plan.id = workout_plan_id
      and plan.user_id = (select auth.uid())
  )
);

create policy weekly_schedule_items_select_own on public.weekly_schedule_items
for select to authenticated
using ((select auth.uid()) = user_id);

create policy weekly_schedule_items_insert_own on public.weekly_schedule_items
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    workout_plan_id is null
    or exists (
      select 1
      from public.workout_plans plan
      where plan.id = workout_plan_id
        and plan.user_id = (select auth.uid())
    )
  )
  and (
    activity_definition_id is null
    or exists (
      select 1
      from public.activity_definitions activity
      where activity.id = activity_definition_id
        and (activity.owner_user_id is null or activity.owner_user_id = (select auth.uid()))
    )
  )
);

create policy weekly_schedule_items_update_own on public.weekly_schedule_items
for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    workout_plan_id is null
    or exists (
      select 1
      from public.workout_plans plan
      where plan.id = workout_plan_id
        and plan.user_id = (select auth.uid())
    )
  )
  and (
    activity_definition_id is null
    or exists (
      select 1
      from public.activity_definitions activity
      where activity.id = activity_definition_id
        and (activity.owner_user_id is null or activity.owner_user_id = (select auth.uid()))
    )
  )
);

create policy weekly_schedule_items_delete_own on public.weekly_schedule_items
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy daily_schedule_overrides_select_own on public.daily_schedule_overrides
for select to authenticated
using ((select auth.uid()) = user_id);

create policy daily_schedule_overrides_insert_own on public.daily_schedule_overrides
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy daily_schedule_overrides_update_own on public.daily_schedule_overrides
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy daily_schedule_overrides_delete_own on public.daily_schedule_overrides
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy daily_schedule_override_items_select_own
on public.daily_schedule_override_items
for select to authenticated
using (
  exists (
    select 1
    from public.daily_schedule_overrides daily_override
    where daily_override.id = daily_override_id
      and daily_override.user_id = (select auth.uid())
  )
);

create policy daily_schedule_override_items_insert_own
on public.daily_schedule_override_items
for insert to authenticated
with check (
  exists (
    select 1
    from public.daily_schedule_overrides daily_override
    where daily_override.id = daily_override_id
      and daily_override.user_id = (select auth.uid())
  )
  and (
    workout_plan_id is null
    or exists (
      select 1
      from public.workout_plans plan
      where plan.id = workout_plan_id
        and plan.user_id = (select auth.uid())
    )
  )
  and (
    activity_definition_id is null
    or exists (
      select 1
      from public.activity_definitions activity
      where activity.id = activity_definition_id
        and (activity.owner_user_id is null or activity.owner_user_id = (select auth.uid()))
    )
  )
);

create policy daily_schedule_override_items_update_own
on public.daily_schedule_override_items
for update to authenticated
using (
  exists (
    select 1
    from public.daily_schedule_overrides daily_override
    where daily_override.id = daily_override_id
      and daily_override.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.daily_schedule_overrides daily_override
    where daily_override.id = daily_override_id
      and daily_override.user_id = (select auth.uid())
  )
  and (
    workout_plan_id is null
    or exists (
      select 1
      from public.workout_plans plan
      where plan.id = workout_plan_id
        and plan.user_id = (select auth.uid())
    )
  )
  and (
    activity_definition_id is null
    or exists (
      select 1
      from public.activity_definitions activity
      where activity.id = activity_definition_id
        and (activity.owner_user_id is null or activity.owner_user_id = (select auth.uid()))
    )
  )
);

create policy daily_schedule_override_items_delete_own
on public.daily_schedule_override_items
for delete to authenticated
using (
  exists (
    select 1
    from public.daily_schedule_overrides daily_override
    where daily_override.id = daily_override_id
      and daily_override.user_id = (select auth.uid())
  )
);

create policy workout_sessions_select_own on public.workout_sessions
for select to authenticated
using ((select auth.uid()) = user_id);

create policy workout_sessions_insert_own on public.workout_sessions
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    workout_plan_id is null
    or exists (
      select 1
      from public.workout_plans plan
      where plan.id = workout_plan_id
        and plan.user_id = (select auth.uid())
    )
  )
);

create policy workout_sessions_update_own on public.workout_sessions
for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    workout_plan_id is null
    or exists (
      select 1
      from public.workout_plans plan
      where plan.id = workout_plan_id
        and plan.user_id = (select auth.uid())
    )
  )
);

create policy workout_sessions_delete_own on public.workout_sessions
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy workout_session_exercises_select_own
on public.workout_session_exercises
for select to authenticated
using (
  exists (
    select 1
    from public.workout_sessions session
    where session.id = workout_session_id
      and session.user_id = (select auth.uid())
  )
);

create policy workout_session_exercises_insert_own
on public.workout_session_exercises
for insert to authenticated
with check (
  exists (
    select 1
    from public.workout_sessions session
    where session.id = workout_session_id
      and session.user_id = (select auth.uid())
  )
  and (
    exercise_id is null
    or exists (
      select 1
      from public.exercises exercise
      where exercise.id = exercise_id
        and (exercise.owner_user_id is null or exercise.owner_user_id = (select auth.uid()))
    )
  )
);

create policy workout_session_exercises_update_own
on public.workout_session_exercises
for update to authenticated
using (
  exists (
    select 1
    from public.workout_sessions session
    where session.id = workout_session_id
      and session.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.workout_sessions session
    where session.id = workout_session_id
      and session.user_id = (select auth.uid())
  )
  and (
    exercise_id is null
    or exists (
      select 1
      from public.exercises exercise
      where exercise.id = exercise_id
        and (exercise.owner_user_id is null or exercise.owner_user_id = (select auth.uid()))
    )
  )
);

create policy workout_session_exercises_delete_own
on public.workout_session_exercises
for delete to authenticated
using (
  exists (
    select 1
    from public.workout_sessions session
    where session.id = workout_session_id
      and session.user_id = (select auth.uid())
  )
);

create policy workout_sets_select_own on public.workout_sets
for select to authenticated
using (
  exists (
    select 1
    from public.workout_session_exercises session_exercise
    join public.workout_sessions session
      on session.id = session_exercise.workout_session_id
    where session_exercise.id = session_exercise_id
      and session.user_id = (select auth.uid())
  )
);

create policy workout_sets_insert_own on public.workout_sets
for insert to authenticated
with check (
  exists (
    select 1
    from public.workout_session_exercises session_exercise
    join public.workout_sessions session
      on session.id = session_exercise.workout_session_id
    where session_exercise.id = session_exercise_id
      and session.user_id = (select auth.uid())
  )
);

create policy workout_sets_update_own on public.workout_sets
for update to authenticated
using (
  exists (
    select 1
    from public.workout_session_exercises session_exercise
    join public.workout_sessions session
      on session.id = session_exercise.workout_session_id
    where session_exercise.id = session_exercise_id
      and session.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.workout_session_exercises session_exercise
    join public.workout_sessions session
      on session.id = session_exercise.workout_session_id
    where session_exercise.id = session_exercise_id
      and session.user_id = (select auth.uid())
  )
);

create policy workout_sets_delete_own on public.workout_sets
for delete to authenticated
using (
  exists (
    select 1
    from public.workout_session_exercises session_exercise
    join public.workout_sessions session
      on session.id = session_exercise.workout_session_id
    where session_exercise.id = session_exercise_id
      and session.user_id = (select auth.uid())
  )
);

create policy activity_logs_select_own on public.activity_logs
for select to authenticated
using ((select auth.uid()) = user_id);

create policy activity_logs_insert_own on public.activity_logs
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    activity_definition_id is null
    or exists (
      select 1
      from public.activity_definitions activity
      where activity.id = activity_definition_id
        and (activity.owner_user_id is null or activity.owner_user_id = (select auth.uid()))
    )
  )
);

create policy activity_logs_update_own on public.activity_logs
for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    activity_definition_id is null
    or exists (
      select 1
      from public.activity_definitions activity
      where activity.id = activity_definition_id
        and (activity.owner_user_id is null or activity.owner_user_id = (select auth.uid()))
    )
  )
);

create policy activity_logs_delete_own on public.activity_logs
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy weight_logs_select_own on public.weight_logs
for select to authenticated
using ((select auth.uid()) = user_id);

create policy weight_logs_insert_own on public.weight_logs
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy weight_logs_update_own on public.weight_logs
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy weight_logs_delete_own on public.weight_logs
for delete to authenticated
using ((select auth.uid()) = user_id);

create policy nutrition_target_snapshots_select_own
on public.nutrition_target_snapshots
for select to authenticated
using ((select auth.uid()) = user_id);

create policy nutrition_target_snapshots_insert_own
on public.nutrition_target_snapshots
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy nutrition_target_snapshots_update_own
on public.nutrition_target_snapshots
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy nutrition_target_snapshots_delete_own
on public.nutrition_target_snapshots
for delete to authenticated
using ((select auth.uid()) = user_id);
