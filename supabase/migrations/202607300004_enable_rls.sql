-- Fridge Manager / 04
-- Expose only the authenticated user's own rows through the Data API.

begin;

revoke all on table public.ingredients from anon;
revoke all on table public.preferences from anon;

grant select, insert, update, delete
  on table public.ingredients
  to authenticated;

grant select, insert, update, delete
  on table public.preferences
  to authenticated;

grant select, insert, update, delete
  on table public.ingredients
  to service_role;

grant select, insert, update, delete
  on table public.preferences
  to service_role;

alter table public.ingredients enable row level security;
alter table public.preferences enable row level security;

drop policy if exists ingredients_select_own on public.ingredients;
create policy ingredients_select_own
on public.ingredients
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists ingredients_insert_own on public.ingredients;
create policy ingredients_insert_own
on public.ingredients
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists ingredients_update_own on public.ingredients;
create policy ingredients_update_own
on public.ingredients
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists ingredients_delete_own on public.ingredients;
create policy ingredients_delete_own
on public.ingredients
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists preferences_select_own on public.preferences;
create policy preferences_select_own
on public.preferences
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists preferences_insert_own on public.preferences;
create policy preferences_insert_own
on public.preferences
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists preferences_update_own on public.preferences;
create policy preferences_update_own
on public.preferences
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists preferences_delete_own on public.preferences;
create policy preferences_delete_own
on public.preferences
for delete
to authenticated
using ((select auth.uid()) = id);

commit;

