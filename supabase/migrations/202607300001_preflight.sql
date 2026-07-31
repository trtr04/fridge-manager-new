-- Fridge Manager / 01
-- Read-only compatibility check for existing critical columns.

do $preflight$
declare
  incompatible_columns text;
begin
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
    format(
      'public.%I.%I is %s, expected %s',
      e.table_name,
      e.column_name,
      c.udt_name,
      e.expected_udt
    ),
    E'\n'
  )
  into incompatible_columns
  from expected e
  join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = e.table_name
   and c.column_name = e.column_name
  where c.udt_name <> e.expected_udt;

  if incompatible_columns is not null then
    raise exception
      E'Existing Fridge Manager columns have incompatible types:\n%\nStop here and migrate the existing data before continuing.',
      incompatible_columns;
  end if;
end
$preflight$;

select
  current_database() as database_name,
  current_user as executed_by,
  to_regclass('public.ingredients') as existing_ingredients_table,
  to_regclass('public.preferences') as existing_preferences_table;

