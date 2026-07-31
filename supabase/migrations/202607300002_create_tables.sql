-- Fridge Manager / 02
-- Create or complete the application tables without deleting existing rows.

begin;

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12, 3) not null,
  unit text not null default '个',
  storage text not null default 'fridge',
  category text not null default 'other',
  shelf_life integer not null default 7,
  purchase_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ingredients
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists name text,
  add column if not exists amount numeric(12, 3),
  add column if not exists unit text default '个',
  add column if not exists storage text default 'fridge',
  add column if not exists category text default 'other',
  add column if not exists shelf_life integer default 7,
  add column if not exists purchase_date date default current_date,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.ingredients
  alter column id set default gen_random_uuid(),
  alter column user_id set not null,
  alter column name set not null,
  alter column amount set not null,
  alter column unit set default '个',
  alter column unit set not null,
  alter column storage set default 'fridge',
  alter column storage set not null,
  alter column category set default 'other',
  alter column category set not null,
  alter column shelf_life set default 7,
  alter column shelf_life set not null,
  alter column purchase_date set default current_date,
  alter column purchase_date set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

-- `room` was used by an early frontend version for the pantry area.
update public.ingredients
set storage = 'pantry'
where storage = 'room';

do $ingredients_constraints$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ingredients'::regclass
      and contype = 'p'
  ) then
    if exists (
      select 1
      from public.ingredients
      group by id
      having count(*) > 1
    ) then
      raise exception
        'public.ingredients contains duplicate id values. Resolve them before adding the required primary key.';
    end if;

    alter table public.ingredients
      add constraint ingredients_pkey primary key (id);
  end if;

  -- The frontend uses `upsert(..., { onConflict: 'id' })`. A composite
  -- primary key containing id is not enough; id must be unique by itself.
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
    if exists (
      select 1
      from public.ingredients
      group by id
      having count(*) > 1
    ) then
      raise exception
        'public.ingredients contains duplicate id values. Resolve them before adding the required single-column unique constraint.';
    end if;

    if exists (
      select 1
      from pg_constraint
      where conrelid = 'public.ingredients'::regclass
        and conname = 'ingredients_id_key'
    ) then
      raise exception
        'Constraint ingredients_id_key already exists but does not uniquely constrain only public.ingredients.id';
    end if;

    alter table public.ingredients
      add constraint ingredients_id_key unique (id);
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
    if exists (
      select 1
      from pg_constraint
      where conrelid = 'public.ingredients'::regclass
        and conname = 'ingredients_user_id_fkey'
    ) then
      raise exception
        'Constraint ingredients_user_id_fkey already exists but is not the required user_id -> auth.users(id) ON DELETE CASCADE foreign key';
    end if;

    alter table public.ingredients
      add constraint ingredients_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ingredients'::regclass
      and conname = 'ingredients_name_check'
  ) then
    alter table public.ingredients
      add constraint ingredients_name_check
      check (char_length(btrim(name)) between 1 and 120);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ingredients'::regclass
      and conname = 'ingredients_amount_check'
  ) then
    alter table public.ingredients
      add constraint ingredients_amount_check
      check (amount > 0 and amount <= 1000000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ingredients'::regclass
      and conname = 'ingredients_unit_check'
  ) then
    alter table public.ingredients
      add constraint ingredients_unit_check
      check (char_length(btrim(unit)) between 1 and 20);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ingredients'::regclass
      and conname = 'ingredients_storage_check'
  ) then
    alter table public.ingredients
      add constraint ingredients_storage_check
      check (storage in ('fridge', 'freezer', 'pantry', 'condiment'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ingredients'::regclass
      and conname = 'ingredients_category_check'
  ) then
    alter table public.ingredients
      add constraint ingredients_category_check
      check (char_length(btrim(category)) between 1 and 50);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ingredients'::regclass
      and conname = 'ingredients_shelf_life_check'
  ) then
    alter table public.ingredients
      add constraint ingredients_shelf_life_check
      check (shelf_life between 0 and 36500);
  end if;
end
$ingredients_constraints$;

create index if not exists ingredients_user_id_idx
  on public.ingredients using btree (user_id);

create index if not exists ingredients_user_storage_idx
  on public.ingredients using btree (user_id, storage);

create index if not exists ingredients_user_purchase_date_idx
  on public.ingredients using btree (user_id, purchase_date);

create table if not exists public.preferences (
  id uuid primary key references auth.users(id) on delete cascade,
  tastes text[] not null default '{}'::text[],
  quick_meals boolean not null default false,
  allergens text[] not null default '{}'::text[],
  diet_type text[] not null default '{}'::text[],
  restrictions text[] not null default '{}'::text[],
  period_restrictions text[] not null default '{}'::text[],
  consider_nutrition boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.preferences
  add column if not exists id uuid,
  add column if not exists tastes text[] default '{}'::text[],
  add column if not exists quick_meals boolean default false,
  add column if not exists allergens text[] default '{}'::text[],
  add column if not exists diet_type text[] default '{}'::text[],
  add column if not exists restrictions text[] default '{}'::text[],
  add column if not exists period_restrictions text[] default '{}'::text[],
  add column if not exists consider_nutrition boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.preferences
  alter column id set not null,
  alter column tastes set default '{}'::text[],
  alter column tastes set not null,
  alter column quick_meals set default false,
  alter column quick_meals set not null,
  alter column allergens set default '{}'::text[],
  alter column allergens set not null,
  alter column diet_type set default '{}'::text[],
  alter column diet_type set not null,
  alter column restrictions set default '{}'::text[],
  alter column restrictions set not null,
  alter column period_restrictions set default '{}'::text[],
  alter column period_restrictions set not null,
  alter column consider_nutrition set default false,
  alter column consider_nutrition set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $preferences_constraints$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.preferences'::regclass
      and contype = 'p'
  ) then
    if exists (
      select 1
      from public.preferences
      group by id
      having count(*) > 1
    ) then
      raise exception
        'public.preferences contains duplicate id values. Resolve them before adding the required primary key.';
    end if;

    alter table public.preferences
      add constraint preferences_pkey primary key (id);
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
    if exists (
      select 1
      from public.preferences
      group by id
      having count(*) > 1
    ) then
      raise exception
        'public.preferences contains duplicate id values. Resolve them before adding the required single-column unique constraint.';
    end if;

    if exists (
      select 1
      from pg_constraint
      where conrelid = 'public.preferences'::regclass
        and conname = 'preferences_id_key'
    ) then
      raise exception
        'Constraint preferences_id_key already exists but does not uniquely constrain only public.preferences.id';
    end if;

    alter table public.preferences
      add constraint preferences_id_key unique (id);
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
    if exists (
      select 1
      from pg_constraint
      where conrelid = 'public.preferences'::regclass
        and conname = 'preferences_id_fkey'
    ) then
      raise exception
        'Constraint preferences_id_fkey already exists but is not the required id -> auth.users(id) ON DELETE CASCADE foreign key';
    end if;

    alter table public.preferences
      add constraint preferences_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end
$preferences_constraints$;

commit;
