-- RomTech schema v1. Provisioned as one transaction through the Management API.
-- Dedicated prefix; unrelated tables, Auth users and Storage policies are untouched.
begin;
do $$
begin
  if to_regclass('public.romtech_schema') is null and (
    to_regclass('public.romtech_products') is not null or
    to_regclass('public.romtech_orders') is not null or
    to_regclass('public.romtech_reviews') is not null or
    to_regclass('public.romtech_settings') is not null or
    to_regclass('public.romtech_content') is not null
  ) then raise exception 'RomTech table names already exist without a schema marker'; end if;
end $$;
create table if not exists public.romtech_schema (
  id integer primary key check (id = 1), version integer not null
);
insert into public.romtech_schema values (1, 1) on conflict do nothing;
do $$ begin
  if (select version from public.romtech_schema where id = 1) <> 1 then
    raise exception 'Unsupported RomTech schema version';
  end if;
end $$;

create table if not exists public.romtech_products (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object' and not data ? 'cost'),
  cost numeric,
  revision uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now()
);
create table if not exists public.romtech_orders (
  id text primary key, data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision uuid not null default gen_random_uuid(), updated_at timestamptz not null default now()
);
create table if not exists public.romtech_reviews (
  id text primary key, data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision uuid not null default gen_random_uuid(), updated_at timestamptz not null default now()
);
create table if not exists public.romtech_settings (
  id text primary key check (id = 'site'), data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision uuid not null default gen_random_uuid(), updated_at timestamptz not null default now()
);
create table if not exists public.romtech_content (
  id text primary key, data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision uuid not null default gen_random_uuid(), updated_at timestamptz not null default now()
);
alter table public.romtech_schema enable row level security;
alter table public.romtech_products enable row level security;
alter table public.romtech_orders enable row level security;
alter table public.romtech_reviews enable row level security;
alter table public.romtech_settings enable row level security;
alter table public.romtech_content enable row level security;

revoke all on public.romtech_schema, public.romtech_products, public.romtech_orders,
  public.romtech_reviews, public.romtech_settings, public.romtech_content from public, anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant select (id, data, revision, updated_at) on public.romtech_products to anon, authenticated;
grant select on public.romtech_reviews, public.romtech_settings, public.romtech_content to anon, authenticated;
grant all on public.romtech_schema, public.romtech_products, public.romtech_orders,
  public.romtech_reviews, public.romtech_settings, public.romtech_content to service_role;

drop policy if exists romtech_catalog_read on public.romtech_products;
create policy romtech_catalog_read on public.romtech_products for select to anon, authenticated
  using (data->>'status' = 'published');
drop policy if exists romtech_reviews_read on public.romtech_reviews;
create policy romtech_reviews_read on public.romtech_reviews for select to anon, authenticated
  using (data->>'status' = 'approved');
drop policy if exists romtech_settings_read on public.romtech_settings;
create policy romtech_settings_read on public.romtech_settings for select to anon, authenticated using (true);
drop policy if exists romtech_content_read on public.romtech_content;
create policy romtech_content_read on public.romtech_content for select to anon, authenticated using (true);
-- Orders and their derived customer records have no public policies or grants.
-- All writes go through the authenticated, rate-limited RomTech backend.

create or replace function public.romtech_apply_patch(
  p_entity text, p_changes jsonb, p_deletes jsonb, p_import boolean default false
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  tbl text; item jsonb; old_revision uuid; affected integer;
begin
  if p_entity not in ('products','orders','reviews','settings','content') then
    raise exception 'Invalid entity';
  end if;
  tbl := 'romtech_' || p_entity;
  for item in select value from jsonb_array_elements(p_changes) order by value->>'id' loop
    if p_import then
      if p_entity = 'products' then
        insert into public.romtech_products(id, data, cost)
          values (item->>'id', item->'data', (item->>'cost')::numeric) on conflict do nothing;
      else
        execute format('insert into public.%I(id,data) values ($1,$2) on conflict do nothing', tbl)
          using item->>'id', item->'data';
      end if;
    elsif item->>'revision' is null then
      if p_entity = 'products' then
        insert into public.romtech_products(id,data,cost) values (item->>'id',item->'data',(item->>'cost')::numeric);
      else
        execute format('insert into public.%I(id,data) values ($1,$2)', tbl) using item->>'id',item->'data';
      end if;
    else
      if p_entity = 'products' then
        update public.romtech_products set data=item->'data',cost=(item->>'cost')::numeric,
          revision=gen_random_uuid(),updated_at=now()
          where id=item->>'id' and revision=(item->>'revision')::uuid;
      else
        execute format('update public.%I set data=$1,revision=gen_random_uuid(),updated_at=now() where id=$2 and revision=$3', tbl)
          using item->'data',item->>'id',(item->>'revision')::uuid;
      end if;
      get diagnostics affected = row_count;
      if affected <> 1 then raise exception 'ROMTECH_CONFLICT' using errcode='40001'; end if;
    end if;
  end loop;
  if p_import and jsonb_array_length(p_deletes)>0 then raise exception 'Import cannot delete'; end if;
  for item in select value from jsonb_array_elements(p_deletes) order by value->>'id' loop
    execute format('delete from public.%I where id=$1 and revision=$2', tbl)
      using item->>'id',(item->>'revision')::uuid;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'ROMTECH_CONFLICT' using errcode='40001'; end if;
  end loop;
end $$;
revoke all on function public.romtech_apply_patch(text,jsonb,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.romtech_apply_patch(text,jsonb,jsonb,boolean) to service_role;
notify pgrst, 'reload schema';
commit;
