-- Fridge Manager / 03
-- Maintain updated_at and create a default preferences row for every Auth user.

begin;

create or replace function public.set_fridge_manager_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$function$;

revoke all on function public.set_fridge_manager_updated_at() from public;
revoke all on function public.set_fridge_manager_updated_at() from anon;
revoke all on function public.set_fridge_manager_updated_at() from authenticated;

drop trigger if exists set_ingredients_updated_at on public.ingredients;
create trigger set_ingredients_updated_at
before update on public.ingredients
for each row
execute function public.set_fridge_manager_updated_at();

drop trigger if exists set_preferences_updated_at on public.preferences;
create trigger set_preferences_updated_at
before update on public.preferences
for each row
execute function public.set_fridge_manager_updated_at();

create or replace function public.handle_new_fridge_manager_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.preferences (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$function$;

revoke all on function public.handle_new_fridge_manager_user() from public;
revoke all on function public.handle_new_fridge_manager_user() from anon;
revoke all on function public.handle_new_fridge_manager_user() from authenticated;

drop trigger if exists on_auth_user_created_fridge_manager on auth.users;
create trigger on_auth_user_created_fridge_manager
after insert on auth.users
for each row
execute function public.handle_new_fridge_manager_user();

-- Backfill preferences for Auth users that already existed before this trigger.
insert into public.preferences (id)
select users.id
from auth.users as users
on conflict (id) do nothing;

commit;

