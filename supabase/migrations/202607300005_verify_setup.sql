-- Fridge Manager / 05
-- Fail loudly if the schema is incomplete or contains invalid ownership data.

do $verification$
declare
  missing_columns text;
  policy_count integer;
  ingredient_check_count integer;
begin
  if to_regclass('public.ingredients') is null then
    raise exception 'Missing table public.ingredients';
  end if;

  if to_regclass('public.preferences') is null then
    raise exception 'Missing table public.preferences';
  end if;

  with expected(table_name, column_name, expected_udt) as (
    values
      ('ingredients', 'id', 'uuid'),
      ('ingredients', 'user_id', 'uuid'),
      ('ingredients', 'name', 'text'),
      ('ingredients', 'amount', 'numeric'),
      ('ingredients', 'unit', 'text'),
      ('ingredients', 'storage', 'text'),
      ('ingredients', 'category', 'text'),
      ('ingredients', 'shelf_life', 'int4'),
      ('ingredients', 'purchase_date', 'date'),
      ('ingredients', 'created_at', 'timestamptz'),
      ('ingredients', 'updated_at', 'timestamptz'),
      ('preferences', 'id', 'uuid'),
      ('preferences', 'tastes', '_text'),
      ('preferences', 'quick_meals', 'bool'),
      ('preferences', 'allergens', '_text'),
      ('preferences', 'diet_type', '_text'),
      ('preferences', 'restrictions', '_text'),
      ('preferences', 'period_restrictions', '_text'),
      ('preferences', 'consider_nutrition', 'bool'),
      ('preferences', 'created_at', 'timestamptz'),
      ('preferences', 'updated_at', 'timestamptz')
  )
  select string_agg(
    format('%I.%I (%s)', e.table_name, e.column_name, e.expected_udt),
    ', '
  )
  into missing_columns
  from expected e
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = e.table_name
   and c.column_name = e.column_name
   and c.udt_name = e.expected_udt
  where c.column_name is null;

  if missing_columns is not null then
    raise exception 'Missing or incorrectly typed columns: %', missing_columns;
  end if;

  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.ingredients'::regclass
  ) then
    raise exception 'RLS is not enabled on public.ingredients';
  end if;

  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.preferences'::regclass
  ) then
    raise exception 'RLS is not enabled on public.preferences';
  end if;

  select count(*)
  into policy_count
  from pg_policies
  where schemaname = 'public'
    and (
      (tablename = 'ingredients' and policyname in (
        'ingredients_select_own',
        'ingredients_insert_own',
        'ingredients_update_own',
        'ingredients_delete_own'
      ))
      or
      (tablename = 'preferences' and policyname in (
        'preferences_select_own',
        'preferences_insert_own',
        'preferences_update_own',
        'preferences_delete_own'
      ))
    );

  if policy_count <> 8 then
    raise exception 'Expected 8 Fridge Manager RLS policies, found %', policy_count;
  end if;

  select count(*)
  into ingredient_check_count
  from pg_constraint
  where conrelid = 'public.ingredients'::regclass
    and conname in (
      'ingredients_name_check',
      'ingredients_amount_check',
      'ingredients_unit_check',
      'ingredients_storage_check',
      'ingredients_category_check',
      'ingredients_shelf_life_check'
    );

  if ingredient_check_count <> 6 then
    raise exception
      'Expected 6 ingredients validation constraints, found %',
      ingredient_check_count;
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and c.conkey = array[a.attnum]::smallint[]
    where c.conrelid = 'public.ingredients'::regclass
      and c.contype in ('p', 'u')
      and a.attname = 'id'
  ) then
    raise exception
      'public.ingredients.id needs a single-column PRIMARY KEY or UNIQUE constraint for frontend upserts';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and c.conkey = array[a.attnum]::smallint[]
    where c.conrelid = 'public.preferences'::regclass
      and c.contype in ('p', 'u')
      and a.attname = 'id'
  ) then
    raise exception
      'public.preferences.id needs a single-column PRIMARY KEY or UNIQUE constraint for ON CONFLICT (id)';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute local_column
      on local_column.attrelid = c.conrelid
     and c.conkey = array[local_column.attnum]::smallint[]
    join pg_attribute referenced_column
      on referenced_column.attrelid = c.confrelid
     and c.confkey = array[referenced_column.attnum]::smallint[]
    where c.conrelid = 'public.ingredients'::regclass
      and c.confrelid = 'auth.users'::regclass
      and c.contype = 'f'
      and c.confdeltype = 'c'
      and local_column.attname = 'user_id'
      and referenced_column.attname = 'id'
  ) then
    raise exception 'ingredients.user_id is missing an ON DELETE CASCADE auth.users foreign key';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute local_column
      on local_column.attrelid = c.conrelid
     and c.conkey = array[local_column.attnum]::smallint[]
    join pg_attribute referenced_column
      on referenced_column.attrelid = c.confrelid
     and c.confkey = array[referenced_column.attnum]::smallint[]
    where c.conrelid = 'public.preferences'::regclass
      and c.confrelid = 'auth.users'::regclass
      and c.contype = 'f'
      and c.confdeltype = 'c'
      and local_column.attname = 'id'
      and referenced_column.attname = 'id'
  ) then
    raise exception 'preferences.id is missing an ON DELETE CASCADE auth.users foreign key';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'ingredients'
      and indexname = 'ingredients_user_id_idx'
  ) then
    raise exception 'Missing ingredients_user_id_idx';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'ingredients'
      and indexname = 'ingredients_user_storage_idx'
  ) then
    raise exception 'Missing ingredients_user_storage_idx';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.ingredients'::regclass
      and tgname = 'set_ingredients_updated_at'
      and not tgisinternal
  ) then
    raise exception 'Missing ingredients updated_at trigger';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.preferences'::regclass
      and tgname = 'set_preferences_updated_at'
      and not tgisinternal
  ) then
    raise exception 'Missing preferences updated_at trigger';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'on_auth_user_created_fridge_manager'
      and not tgisinternal
  ) then
    raise exception 'Missing Auth user preferences trigger';
  end if;

  if has_table_privilege('anon', 'public.ingredients', 'SELECT')
     or has_table_privilege('anon', 'public.ingredients', 'INSERT')
     or has_table_privilege('anon', 'public.ingredients', 'UPDATE')
     or has_table_privilege('anon', 'public.ingredients', 'DELETE')
     or has_table_privilege('anon', 'public.preferences', 'SELECT')
     or has_table_privilege('anon', 'public.preferences', 'INSERT')
     or has_table_privilege('anon', 'public.preferences', 'UPDATE')
     or has_table_privilege('anon', 'public.preferences', 'DELETE') then
    raise exception 'anon still has table privileges on Fridge Manager data';
  end if;

  if not (
    has_table_privilege('authenticated', 'public.ingredients', 'SELECT')
    and has_table_privilege('authenticated', 'public.ingredients', 'INSERT')
    and has_table_privilege('authenticated', 'public.ingredients', 'UPDATE')
    and has_table_privilege('authenticated', 'public.ingredients', 'DELETE')
    and has_table_privilege('authenticated', 'public.preferences', 'SELECT')
    and has_table_privilege('authenticated', 'public.preferences', 'INSERT')
    and has_table_privilege('authenticated', 'public.preferences', 'UPDATE')
    and has_table_privilege('authenticated', 'public.preferences', 'DELETE')
  ) then
    raise exception 'authenticated is missing required table privileges';
  end if;

  if exists (
    select 1
    from public.ingredients i
    left join auth.users u on u.id = i.user_id
    where u.id is null
  ) then
    raise exception 'Found ingredients rows without a matching auth.users owner';
  end if;

  if exists (
    select 1
    from public.preferences p
    left join auth.users u on u.id = p.id
    where u.id is null
  ) then
    raise exception 'Found preferences rows without a matching auth.users owner';
  end if;

  if exists (
    select 1
    from public.ingredients
    where amount <= 0
       or storage not in ('fridge', 'freezer', 'pantry', 'condiment')
       or shelf_life < 0
  ) then
    raise exception 'Found invalid ingredient amount, storage, or shelf_life values';
  end if;

  raise notice 'Fridge Manager Supabase schema verification passed.';
end
$verification$;

select
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('ingredients', 'preferences')
order by table_name, ordinal_position;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('ingredients', 'preferences')
order by tablename, policyname;
