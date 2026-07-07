create extension if not exists "pgcrypto";

do $$ begin
  create type public.company_status as enum ('active', 'inactive');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.product_status as enum ('active', 'hidden');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  status public.company_status not null default 'inactive',
  paid_until date,
  contact_name text not null default '' check (char_length(contact_name) <= 80),
  contact_note text not null default '' check (char_length(contact_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  code text not null check (code ~ '^[A-Z0-9]{1,12}$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, code),
  unique (company_id, name)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  product_number integer not null check (product_number > 0),
  product_code text not null,
  name text not null check (char_length(name) between 1 and 120),
  specification text not null default '' check (char_length(specification) <= 160),
  unit_price numeric(12, 2) check (unit_price >= 0),
  description text not null default '' check (char_length(description) <= 1200),
  image_url text not null,
  object_key text not null,
  image_width integer,
  image_height integer,
  status public.product_status not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, product_code),
  unique (category_id, product_number)
);

create table if not exists public.shipment_sheets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null default '出货单' check (char_length(title) <= 120),
  customer_name text not null default '' check (char_length(customer_name) <= 120),
  note text not null default '' check (char_length(note) <= 500),
  total_price numeric(12, 2) not null default 0 check (total_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.shipment_sheet_items (
  id uuid primary key default gen_random_uuid(),
  shipment_sheet_id uuid not null references public.shipment_sheets(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  specification text not null default '' check (char_length(specification) <= 160),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  quantity integer not null default 1 check (quantity > 0),
  line_price numeric(12, 2) not null default 0 check (line_price >= 0),
  sort_order integer not null default 0
);

create index if not exists companies_slug_idx
  on public.companies (slug);

create index if not exists companies_status_paid_until_idx
  on public.companies (status, paid_until);

create index if not exists categories_company_sort_idx
  on public.categories (company_id, sort_order, name);

create index if not exists products_company_category_status_sort_idx
  on public.products (company_id, category_id, status, sort_order, created_at desc);

create index if not exists products_company_code_idx
  on public.products (company_id, product_code);

create index if not exists shipment_sheets_company_created_idx
  on public.shipment_sheets (company_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.companies enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.shipment_sheets enable row level security;
alter table public.shipment_sheet_items enable row level security;

drop policy if exists "companies_service_role_all" on public.companies;
create policy "companies_service_role_all"
  on public.companies
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "categories_service_role_all" on public.categories;
create policy "categories_service_role_all"
  on public.categories
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "products_service_role_all" on public.products;
create policy "products_service_role_all"
  on public.products
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "shipment_sheets_service_role_all" on public.shipment_sheets;
create policy "shipment_sheets_service_role_all"
  on public.shipment_sheets
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "shipment_sheet_items_service_role_all" on public.shipment_sheet_items;
create policy "shipment_sheet_items_service_role_all"
  on public.shipment_sheet_items
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

insert into public.companies (name, slug, status, paid_until, contact_name, contact_note)
values ('华悟样品厂', 'demo-factory', 'active', current_date + interval '365 days', '站点运营', '演示企业，可替换为真实企业。')
on conflict (slug) do nothing;

insert into public.categories (company_id, name, code, sort_order)
select c.id, v.name, v.code, v.sort_order
from public.companies c
cross join (
  values
    ('五金配件', 'HW', 10),
    ('包装材料', 'BZ', 20),
    ('陶瓷样品', 'TC', 30)
) as v(name, code, sort_order)
where c.slug = 'demo-factory'
on conflict (company_id, code) do nothing;
