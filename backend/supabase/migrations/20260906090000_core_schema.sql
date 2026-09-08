-- ============================================================================
-- Bizarri Chalet — core operational schema
--
-- Everything the chalet is run from: inventory, availability, pricing,
-- booking requests, published news and site settings.
--
-- Two rules shape the design:
--   1. The browser is never trusted with money or availability. Guests do not
--      INSERT bookings; they call request_booking(), which re-derives the
--      price and re-checks availability server-side.
--   2. Accepted bookings physically cannot overlap, enforced by an exclusion
--      constraint rather than by application code.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists btree_gist; -- smallint in a gist exclusion constraint

-- ---------------------------------------------------------------- admin identity

create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

comment on table public.admins is
  'Allow-list of admin users. Membership is what every admin RLS policy tests.';

-- SECURITY DEFINER so the policy can read admins without recursing into its
-- own RLS. search_path is pinned: a mutable search_path on a definer function
-- is a privilege-escalation vector.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------- chalets

create table if not exists public.chalets (
  id         smallint primary key,
  slug       text not null unique,
  name_en    text not null,
  name_ar    text not null,
  active     boolean not null default true,
  sort_order smallint not null default 0
);

-- ------------------------------------------------------------------------ rates

-- Single row, enforced by a boolean primary key that may only be true.
create table if not exists public.rates (
  id             boolean primary key default true check (id),
  full_week      numeric(10,3) not null default 600 check (full_week >= 0),
  weekend        numeric(10,3) not null default 350 check (weekend >= 0),
  weekday        numeric(10,3) not null default 300 check (weekday >= 0),
  daily_weekday  numeric(10,3) not null default 75  check (daily_weekday >= 0),
  daily_weekend  numeric(10,3) not null default 120 check (daily_weekend >= 0),
  currency       text not null default 'KWD',
  min_stay_days  smallint not null default 3 check (min_stay_days >= 1),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references auth.users (id)
);

comment on column public.rates.full_week is 'Flat rate for an exact Sun-Sat stay.';
comment on column public.rates.daily_weekday is
  'Per-day fallback (Sun-Wed) for stays that match no package.';

-- -------------------------------------------------------------- availability

create table if not exists public.blocked_dates (
  id         uuid primary key default gen_random_uuid(),
  chalet_id  smallint not null references public.chalets (id) on delete cascade,
  day        date not null,
  reason     text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  unique (chalet_id, day)
);

create index if not exists blocked_dates_day_idx on public.blocked_dates (chalet_id, day);

create table if not exists public.day_prices (
  id         uuid primary key default gen_random_uuid(),
  chalet_id  smallint not null references public.chalets (id) on delete cascade,
  day        date not null,
  price      numeric(10,3) not null check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  unique (chalet_id, day)
);

create index if not exists day_prices_day_idx on public.day_prices (chalet_id, day);

-- --------------------------------------------------------------------- bookings

do $$ begin
  create type public.booking_status as enum ('pending', 'accepted', 'rejected', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null unique,
  chalet_id   smallint not null references public.chalets (id),
  start_date  date not null,
  end_date    date not null,
  days        integer generated always as (end_date - start_date + 1) stored,
  total       numeric(10,3) not null check (total >= 0),
  currency    text not null default 'KWD',
  package_key text check (package_key in ('fullWeek', 'weekend', 'weekday')),
  guest_name  text not null check (length(btrim(guest_name)) >= 2),
  guest_phone text not null,
  guest_email text not null check (guest_email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'),
  guests      smallint not null check (guests between 1 and 20),
  notes       text,
  status      public.booking_status not null default 'pending',
  admin_note  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  uuid references auth.users (id),
  constraint bookings_dates_ordered check (end_date >= start_date)
);

-- The whole point of the system: two accepted stays can never share a night.
-- Pending and rejected requests are free to overlap — several guests may ask
-- for the same week, and the admin picks one.
alter table public.bookings drop constraint if exists bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (
    chalet_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status = 'accepted');

create index if not exists bookings_status_idx  on public.bookings (status, start_date);
create index if not exists bookings_created_idx on public.bookings (created_at desc);
create index if not exists bookings_email_idx   on public.bookings (lower(guest_email));

-- ------------------------------------------------------------------------- news

create table if not exists public.news (
  id           uuid primary key default gen_random_uuid(),
  title_en     text not null default '',
  title_ar     text not null default '',
  body_en      text not null default '',
  body_ar      text not null default '',
  published    boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint news_has_a_title check (length(btrim(title_en)) > 0 or length(btrim(title_ar)) > 0)
);

create index if not exists news_published_idx on public.news (published, published_at desc);

-- --------------------------------------------------------------------- settings

create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

comment on table public.settings is
  'Public site configuration (contact details, social links). Never secrets.';

-- -------------------------------------------------------------------- audit log

create table if not exists public.audit_log (
  id         bigserial primary key,
  actor      uuid,
  actor_email text,
  action     text not null,
  entity     text not null,
  entity_id  text,
  detail     jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- --------------------------------------------------------------- updated_at

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['rates', 'day_prices', 'bookings', 'news', 'settings'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
         for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;
