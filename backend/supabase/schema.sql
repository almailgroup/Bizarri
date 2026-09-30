-- ============================================================================
-- Bizarri Chalet — complete schema.
--
-- Paste into the Supabase SQL editor (Dashboard -> SQL Editor -> New query)
-- and Run. Generated from backend/supabase/migrations by bundle.sh; edit the
-- migrations, not this file.
--
-- Afterwards, still by hand:
--   1. Authentication -> Users -> Add user (the admin's email + password)
--   2. insert into public.admins (user_id, email)
--      select id, email from auth.users where email = '<that email>';
-- ============================================================================

-- ===== migrations/20260906090000_core_schema.sql ===================

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

-- ===== migrations/20260906090100_booking_logic.sql =================

-- ============================================================================
-- Pricing and booking logic.
--
-- These functions are the authority on what a stay costs and whether it can be
-- requested. The client has a mirror of the pricing rules so it can show a live
-- total, but nothing it sends is believed: request_booking() recomputes.
-- ============================================================================

-- Sun-Wed are weekday nights (dow 0-3); Thu-Sat are weekend nights (dow 4-6).
create or replace function public.default_day_rate(p_day date, p_rates public.rates)
returns numeric
language sql
immutable
as $$
  select case when extract(dow from p_day) >= 4
              then p_rates.daily_weekend
              else p_rates.daily_weekday end;
$$;

-- The package a range matches exactly, by length and start/end weekday.
create or replace function public.match_package(p_start date, p_end date)
returns text
language sql
immutable
as $$
  select case
    when (p_end - p_start + 1) = 7 and extract(dow from p_start) = 0 and extract(dow from p_end) = 6
      then 'fullWeek'
    when (p_end - p_start + 1) = 3 and extract(dow from p_start) = 4 and extract(dow from p_end) = 6
      then 'weekend'
    when (p_end - p_start + 1) = 4 and extract(dow from p_start) = 0 and extract(dow from p_end) = 3
      then 'weekday'
    else null
  end;
$$;

/**
 * Price a stay.
 *
 * A custom daily price wins outright: if the admin has priced any day in the
 * range, the whole range is summed per day, so an override is never masked by
 * a flat package rate. Otherwise an exact package match uses the flat rate and
 * anything else sums the per-day defaults.
 */
-- Dropped first, not just replaced: a later migration widens the return type,
-- and "create or replace" cannot change one. Without this, re-applying the
-- migrations in order over an up-to-date database fails here.
drop function if exists public.quote_stay(smallint, date, date);
create function public.quote_stay(
  p_chalet_id smallint,
  p_start     date,
  p_end       date
)
returns table (total numeric, package_key text, days integer, has_custom boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_rates      public.rates;
  v_has_custom boolean;
  v_package    text;
  v_sum        numeric;
begin
  if p_end < p_start then
    raise exception 'end date precedes start date' using errcode = '22007';
  end if;

  select * into v_rates from public.rates where id limit 1;
  if not found then
    raise exception 'rates are not configured' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.day_prices dp
    where dp.chalet_id = p_chalet_id and dp.day between p_start and p_end
  ) into v_has_custom;

  select coalesce(sum(coalesce(dp.price, public.default_day_rate(d::date, v_rates))), 0)
    into v_sum
  from generate_series(p_start, p_end, interval '1 day') d
  left join public.day_prices dp
    on dp.chalet_id = p_chalet_id and dp.day = d::date;

  v_package := case when v_has_custom then null else public.match_package(p_start, p_end) end;

  return query select
    case v_package
      when 'fullWeek' then v_rates.full_week
      when 'weekend'  then v_rates.weekend
      when 'weekday'  then v_rates.weekday
      else v_sum
    end,
    v_package,
    (p_end - p_start + 1)::integer,
    v_has_custom;
end;
$$;

/** Every day in the range is in the future, unblocked, and not already taken. */
create or replace function public.is_range_available(
  p_chalet_id smallint,
  p_start     date,
  p_end       date
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p_start >= current_date
    and p_end >= p_start
    and not exists (
      select 1 from public.blocked_dates b
      where b.chalet_id = p_chalet_id and b.day between p_start and p_end
    )
    and not exists (
      select 1 from public.bookings bk
      where bk.chalet_id = p_chalet_id
        and bk.status = 'accepted'
        and daterange(bk.start_date, bk.end_date, '[]') && daterange(p_start, p_end, '[]')
    );
$$;

/**
 * One call that powers the guest calendar: for each day, is it selectable and
 * what does it cost. Saves the client stitching three tables together and
 * keeps "what is blocked" defined in exactly one place.
 */
create or replace function public.availability_calendar(
  p_chalet_id smallint,
  p_from      date,
  p_to        date
)
returns table (day date, blocked boolean, price numeric, custom boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare v_rates public.rates;
begin
  if p_to < p_from then
    raise exception 'range end precedes start' using errcode = '22007';
  end if;
  -- Bound the window so a crafted call cannot ask for a century of rows.
  if p_to - p_from > 400 then
    raise exception 'range too large (max 400 days)' using errcode = '22023';
  end if;

  select * into v_rates from public.rates where id limit 1;

  return query
  select
    d::date,
    (
      d::date < current_date
      or exists (select 1 from public.blocked_dates b
                 where b.chalet_id = p_chalet_id and b.day = d::date)
      or exists (select 1 from public.bookings bk
                 where bk.chalet_id = p_chalet_id and bk.status = 'accepted'
                   and d::date between bk.start_date and bk.end_date)
    ),
    coalesce(dp.price, public.default_day_rate(d::date, v_rates)),
    dp.price is not null
  from generate_series(p_from, p_to, interval '1 day') d
  left join public.day_prices dp
    on dp.chalet_id = p_chalet_id and dp.day = d::date;
end;
$$;

-- Short, human-quotable reference. Ambiguous glyphs (I/O/0/1) are excluded.
create or replace function public.generate_booking_ref()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  for _ in 1..50 loop
    candidate := 'BZR-' || (
      select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '')
      from generate_series(1, 6)
    );
    exit when not exists (select 1 from public.bookings b where b.ref = candidate);
  end loop;
  return candidate;
end;
$$;

/**
 * The only way a guest creates a booking.
 *
 * SECURITY DEFINER because anon has no INSERT on bookings: the guest cannot
 * choose their own price, status or reference, and cannot book a blocked or
 * already-taken range.
 */
create or replace function public.request_booking(
  p_chalet_id   smallint,
  p_start       date,
  p_end         date,
  p_guest_name  text,
  p_guest_phone text,
  p_guest_email text,
  p_guests      smallint,
  p_notes       text default null
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_min      smallint;
  v_quote    record;
  v_booking  public.bookings;
  v_recent   integer;
begin
  select min_stay_days into v_min from public.rates where id limit 1;
  v_min := coalesce(v_min, 3);

  if p_end - p_start + 1 < v_min then
    raise exception 'Minimum stay is % days', v_min using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.chalets c where c.id = p_chalet_id and c.active) then
    raise exception 'Unknown chalet' using errcode = 'P0002';
  end if;

  if not public.is_range_available(p_chalet_id, p_start, p_end) then
    raise exception 'Those dates are no longer available' using errcode = 'P0001';
  end if;

  -- Light abuse guard: one email cannot flood the queue.
  select count(*) into v_recent
  from public.bookings b
  where lower(b.guest_email) = lower(btrim(p_guest_email))
    and b.created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'Too many requests. Please contact us directly.' using errcode = 'P0001';
  end if;

  select * into v_quote from public.quote_stay(p_chalet_id, p_start, p_end);

  insert into public.bookings (
    ref, chalet_id, start_date, end_date, total, package_key,
    guest_name, guest_phone, guest_email, guests, notes, status
  ) values (
    public.generate_booking_ref(), p_chalet_id, p_start, p_end,
    v_quote.total, v_quote.package_key,
    btrim(p_guest_name), btrim(p_guest_phone), lower(btrim(p_guest_email)),
    p_guests, nullif(btrim(coalesce(p_notes, '')), ''), 'pending'
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

/** Guest self-service: look up your own request with the reference + email. */
create or replace function public.lookup_booking(p_ref text, p_email text)
returns table (
  ref text, status public.booking_status, chalet_id smallint,
  start_date date, end_date date, days integer, total numeric, currency text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.ref, b.status, b.chalet_id, b.start_date, b.end_date, b.days, b.total, b.currency
  from public.bookings b
  where upper(btrim(p_ref)) = b.ref
    and lower(btrim(p_email)) = lower(b.guest_email);
$$;

/**
 * Admin decision. Raises a clear message when accepting would collide with an
 * existing accepted stay, rather than surfacing a raw constraint violation.
 */
create or replace function public.set_booking_status(
  p_id     uuid,
  p_status public.booking_status,
  p_note   text default null
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings;
  v_clash   text;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_id;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if p_status = 'accepted' then
    select b.ref into v_clash
    from public.bookings b
    where b.id <> p_id
      and b.chalet_id = v_booking.chalet_id
      and b.status = 'accepted'
      and daterange(b.start_date, b.end_date, '[]')
          && daterange(v_booking.start_date, v_booking.end_date, '[]')
    limit 1;
    if v_clash is not null then
      raise exception 'Those dates are already held by booking %', v_clash using errcode = 'P0001';
    end if;
  end if;

  update public.bookings
     set status = p_status,
         admin_note = coalesce(p_note, admin_note),
         decided_at = now(),
         decided_by = auth.uid()
   where id = p_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- ===== migrations/20260906090200_rls.sql ===========================

-- ============================================================================
-- Row Level Security.
--
-- Default posture: deny. Anonymous visitors may read the handful of things the
-- public site renders, and may call request_booking(). Everything else — and
-- all writes — requires an admin.
--
-- Note bookings has NO public select or insert policy at all. Guests reach it
-- only through request_booking() / lookup_booking(), which are SECURITY
-- DEFINER and bypass RLS deliberately and narrowly.
-- ============================================================================

alter table public.admins        enable row level security;
alter table public.chalets       enable row level security;
alter table public.rates         enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.day_prices    enable row level security;
alter table public.bookings      enable row level security;
alter table public.news          enable row level security;
alter table public.settings      enable row level security;
alter table public.audit_log     enable row level security;

-- Deliberately NOT "force row level security": request_booking() and
-- lookup_booking() are SECURITY DEFINER and run as the table owner. Forcing
-- RLS on the owner would block the one path guests are supposed to use.

-- ------------------------------------------------------------------- admins
drop policy if exists admins_self_read on public.admins;
create policy admins_self_read on public.admins
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Membership is granted out-of-band (SQL editor / service role), never
-- through the API: no insert, update or delete policy exists.

-- ------------------------------------------------------------------ chalets
drop policy if exists chalets_public_read on public.chalets;
create policy chalets_public_read on public.chalets
  for select to anon, authenticated
  using (active or public.is_admin());

drop policy if exists chalets_admin_write on public.chalets;
create policy chalets_admin_write on public.chalets
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- -------------------------------------------------------------------- rates
drop policy if exists rates_public_read on public.rates;
create policy rates_public_read on public.rates
  for select to anon, authenticated using (true);

drop policy if exists rates_admin_write on public.rates;
create policy rates_admin_write on public.rates
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------ blocked_dates
drop policy if exists blocked_public_read on public.blocked_dates;
create policy blocked_public_read on public.blocked_dates
  for select to anon, authenticated using (true);

drop policy if exists blocked_admin_write on public.blocked_dates;
create policy blocked_admin_write on public.blocked_dates
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------- day_prices
drop policy if exists prices_public_read on public.day_prices;
create policy prices_public_read on public.day_prices
  for select to anon, authenticated using (true);

drop policy if exists prices_admin_write on public.day_prices;
create policy prices_admin_write on public.day_prices
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------- bookings
-- Admins only. Guests never touch this table directly.
drop policy if exists bookings_admin_read on public.bookings;
create policy bookings_admin_read on public.bookings
  for select to authenticated using (public.is_admin());

drop policy if exists bookings_admin_write on public.bookings;
create policy bookings_admin_write on public.bookings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------- news
drop policy if exists news_public_read on public.news;
create policy news_public_read on public.news
  for select to anon, authenticated
  using (published or public.is_admin());

drop policy if exists news_admin_write on public.news;
create policy news_admin_write on public.news
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------- settings
drop policy if exists settings_public_read on public.settings;
create policy settings_public_read on public.settings
  for select to anon, authenticated using (true);

drop policy if exists settings_admin_write on public.settings;
create policy settings_admin_write on public.settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- audit_log
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log
  for select to authenticated using (public.is_admin());
-- Written only by triggers running as definer; no insert policy.

-- ============================================================================
-- Grants. RLS filters rows; grants decide who may attempt the verb at all.
-- ============================================================================

revoke all on all tables in schema public from anon, authenticated;

grant select on public.chalets, public.rates, public.blocked_dates,
                public.day_prices, public.news, public.settings
  to anon, authenticated;

grant select, insert, update, delete on
  public.chalets, public.rates, public.blocked_dates, public.day_prices,
  public.bookings, public.news, public.settings
  to authenticated;

grant select on public.admins, public.audit_log to authenticated;

-- Functions: lock down, then hand back only what each role needs.
revoke all on function public.request_booking(smallint, date, date, text, text, text, smallint, text) from public;
revoke all on function public.set_booking_status(uuid, public.booking_status, text) from public;

grant execute on function public.availability_calendar(smallint, date, date) to anon, authenticated;
grant execute on function public.quote_stay(smallint, date, date)            to anon, authenticated;
grant execute on function public.is_range_available(smallint, date, date)    to anon, authenticated;
grant execute on function public.lookup_booking(text, text)                  to anon, authenticated;
grant execute on function public.request_booking(smallint, date, date, text, text, text, smallint, text)
  to anon, authenticated;
grant execute on function public.set_booking_status(uuid, public.booking_status, text) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ============================================================================
-- Audit trail for admin decisions.
-- ============================================================================

create or replace function public.log_booking_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'booking.created', 'bookings', new.ref,
            jsonb_build_object('chalet', new.chalet_id, 'start', new.start_date,
                               'end', new.end_date, 'total', new.total));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'booking.status', 'bookings', new.ref,
            jsonb_build_object('from', old.status, 'to', new.status));
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'booking.deleted', 'bookings', old.ref,
            jsonb_build_object('start', old.start_date, 'end', old.end_date));
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists audit_bookings on public.bookings;
create trigger audit_bookings
  after insert or update or delete on public.bookings
  for each row execute function public.log_booking_change();

-- ===== migrations/20260906090300_seed.sql ==========================

-- ============================================================================
-- Baseline data. Idempotent: safe to re-run.
-- ============================================================================

insert into public.chalets (id, slug, name_en, name_ar, sort_order) values
  -- Latin digits, like every other number on the Arabic site: see
  -- 20260930120000_latin_digits_in_arabic_names.sql.
  (1, 'bizarri-1', 'Bizarri Chalet 1', 'شاليه بيزاري 1', 1),
  (2, 'bizarri-2', 'Bizarri Chalet 2', 'شاليه بيزاري 2', 2)
on conflict (id) do nothing;

insert into public.rates (id) values (true)
on conflict (id) do nothing;

insert into public.settings (key, value) values
  ('contact', jsonb_build_object(
     'phone', '+96594040955',
     'whatsapp', '96594040955',
     'email', 'sales@bizarri.com',
     'instagram', 'https://www.instagram.com/bizarri.chalet',
     'maps', 'https://maps.app.goo.gl/5wjw1skfpqdnDhFa6')),
  ('notify_emails', jsonb_build_array('admin@almailgroup.com'))
on conflict (key) do nothing;

-- ===== migrations/20260907120000_booking_guards.sql ================

-- ============================================================================
-- Friendlier validation in request_booking().
--
-- The column CHECKs already refuse a bad guest count and a reversed range, but
-- they surface as raw Postgres text ("new row for relation \"bookings\"
-- violates check constraint ...") and the client renders the error message
-- straight to the guest. Validate first and say something useful.
--
-- Added as a follow-up migration rather than an edit so it applies cleanly
-- whether or not the earlier ones have already been pushed.
-- ============================================================================

create or replace function public.request_booking(
  p_chalet_id   smallint,
  p_start       date,
  p_end         date,
  p_guest_name  text,
  p_guest_phone text,
  p_guest_email text,
  p_guests      smallint,
  p_notes       text default null
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_min      smallint;
  v_quote    record;
  v_booking  public.bookings;
  v_recent   integer;
begin
  -- Order matters: check the range is coherent before measuring its length,
  -- otherwise a reversed range reports "minimum stay" and confuses the guest.
  if p_start is null or p_end is null then
    raise exception 'Please choose your dates' using errcode = 'P0001';
  end if;
  if p_end < p_start then
    raise exception 'The check-out date must be on or after the check-in date'
      using errcode = 'P0001';
  end if;

  select min_stay_days into v_min from public.rates where id limit 1;
  v_min := coalesce(v_min, 3);
  if p_end - p_start + 1 < v_min then
    raise exception 'Minimum stay is % days', v_min using errcode = 'P0001';
  end if;

  if p_guests is null or p_guests < 1 or p_guests > 20 then
    raise exception 'Please enter between 1 and 20 guests' using errcode = 'P0001';
  end if;

  if length(btrim(coalesce(p_guest_name, ''))) < 2 then
    raise exception 'Please enter your full name' using errcode = 'P0001';
  end if;
  if length(regexp_replace(coalesce(p_guest_phone, ''), '\D', '', 'g')) < 8 then
    raise exception 'Please enter a valid phone number' using errcode = 'P0001';
  end if;
  -- Validate the TRIMMED value: the row is stored trimmed, and pasted
  -- addresses routinely carry surrounding whitespace. Checking the raw input
  -- would reject them for a reason the guest cannot see.
  if btrim(coalesce(p_guest_email, '')) !~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    raise exception 'Please enter a valid email address' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.chalets c where c.id = p_chalet_id and c.active) then
    raise exception 'Unknown chalet' using errcode = 'P0002';
  end if;

  if not public.is_range_available(p_chalet_id, p_start, p_end) then
    raise exception 'Those dates are no longer available' using errcode = 'P0001';
  end if;

  select count(*) into v_recent
  from public.bookings b
  where lower(b.guest_email) = lower(btrim(p_guest_email))
    and b.created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'Too many requests. Please contact us directly.' using errcode = 'P0001';
  end if;

  select * into v_quote from public.quote_stay(p_chalet_id, p_start, p_end);

  insert into public.bookings (
    ref, chalet_id, start_date, end_date, total, package_key,
    guest_name, guest_phone, guest_email, guests, notes, status
  ) values (
    public.generate_booking_ref(), p_chalet_id, p_start, p_end,
    v_quote.total, v_quote.package_key,
    btrim(p_guest_name), btrim(p_guest_phone), lower(btrim(p_guest_email)),
    p_guests, nullif(btrim(coalesce(p_notes, '')), ''), 'pending'
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.request_booking(smallint, date, date, text, text, text, smallint, text) from public;
grant execute on function public.request_booking(smallint, date, date, text, text, text, smallint, text)
  to anon, authenticated;

-- ===== migrations/20260908100000_audit_edits.sql ===================

-- ============================================================================
-- Broaden the audit trail to cover what the expanded admin panel can now do:
-- editing a booking's guest details/price (not just its status), and changes
-- to settings and chalets. Previously only booking.created/status/deleted
-- were logged, so a direct field edit left no trace at all.
-- ============================================================================

create or replace function public.log_booking_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_changed jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'booking.created', 'bookings', new.ref,
            jsonb_build_object('chalet', new.chalet_id, 'start', new.start_date,
                               'end', new.end_date, 'total', new.total));
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'booking.deleted', 'bookings', old.ref,
            jsonb_build_object('start', old.start_date, 'end', old.end_date));
    return old;
  end if;

  -- tg_op = 'UPDATE'
  if new.status is distinct from old.status then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'booking.status', 'bookings', new.ref,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  -- Field-level edits from the admin panel's "edit details" form. Each
  -- changed column is recorded as [old, new]; unchanged columns are omitted
  -- so the log entry stays readable instead of dumping the whole row.
  if old.guest_name is distinct from new.guest_name then
    v_changed := v_changed || jsonb_build_object(
      'guest_name', jsonb_build_array(old.guest_name, new.guest_name));
  end if;
  if old.guest_phone is distinct from new.guest_phone then
    v_changed := v_changed || jsonb_build_object(
      'guest_phone', jsonb_build_array(old.guest_phone, new.guest_phone));
  end if;
  if old.guest_email is distinct from new.guest_email then
    v_changed := v_changed || jsonb_build_object(
      'guest_email', jsonb_build_array(old.guest_email, new.guest_email));
  end if;
  if old.guests is distinct from new.guests then
    v_changed := v_changed || jsonb_build_object(
      'guests', jsonb_build_array(old.guests, new.guests));
  end if;
  if old.notes is distinct from new.notes then
    v_changed := v_changed || jsonb_build_object(
      'notes', jsonb_build_array(old.notes, new.notes));
  end if;
  if old.admin_note is distinct from new.admin_note then
    v_changed := v_changed || jsonb_build_object(
      'admin_note', jsonb_build_array(old.admin_note, new.admin_note));
  end if;
  if old.total is distinct from new.total then
    v_changed := v_changed || jsonb_build_object(
      'total', jsonb_build_array(old.total, new.total));
  end if;

  if v_changed <> '{}'::jsonb then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'booking.edited', 'bookings', new.ref, v_changed);
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------- settings

create or replace function public.log_settings_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.value is distinct from new.value then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'settings.updated', 'settings', new.key,
            jsonb_build_object('before', old.value, 'after', new.value));
  end if;
  return new;
end;
$$;

drop trigger if exists audit_settings on public.settings;
create trigger audit_settings
  after update on public.settings
  for each row execute function public.log_settings_change();

-- --------------------------------------------------------------- chalets

create or replace function public.log_chalet_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_changed jsonb := '{}'::jsonb;
begin
  if old.active is distinct from new.active then
    v_changed := v_changed || jsonb_build_object(
      'active', jsonb_build_array(old.active, new.active));
  end if;
  if old.name_en is distinct from new.name_en then
    v_changed := v_changed || jsonb_build_object(
      'name_en', jsonb_build_array(old.name_en, new.name_en));
  end if;
  if old.name_ar is distinct from new.name_ar then
    v_changed := v_changed || jsonb_build_object(
      'name_ar', jsonb_build_array(old.name_ar, new.name_ar));
  end if;
  if old.sort_order is distinct from new.sort_order then
    v_changed := v_changed || jsonb_build_object(
      'sort_order', jsonb_build_array(old.sort_order, new.sort_order));
  end if;

  if v_changed <> '{}'::jsonb then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'chalet.updated', 'chalets', new.id::text, v_changed);
  end if;
  return new;
end;
$$;

drop trigger if exists audit_chalets on public.chalets;
create trigger audit_chalets
  after update on public.chalets
  for each row execute function public.log_chalet_change();

-- ===== migrations/20260921090000_occasions_and_checkout.sql ========

-- ============================================================================
-- Special occasion pricing, and the two things a guest must now provide to
-- check out: a Civil ID image and an explicit acceptance of the terms.
--
-- Special occasions (Eid and the like) are premium windows — typically a
-- Thu-Sat — that carry a flat price instead of the normal weekend rate.
-- They are their own table rather than a rates column because each one has
-- its own dates, and the admin needs to add next year's Eid without a
-- migration.
-- ============================================================================

-- ------------------------------------------------------------- occasions

create table if not exists public.special_occasions (
  id         uuid primary key default gen_random_uuid(),
  name_en    text not null check (length(btrim(name_en)) > 0),
  name_ar    text not null default '',
  start_date date not null,
  end_date   date not null,
  price      numeric(10,3) not null default 900 check (price >= 0),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  constraint occasions_dates_ordered check (end_date >= start_date)
);

comment on table public.special_occasions is
  'Premium date windows (Eid etc). price is the flat total for the window, '
  'not a per-day rate.';

-- Two active occasions may not cover the same day: a day can only have one
-- premium price, and quote_stay would otherwise have to pick arbitrarily.
alter table public.special_occasions drop constraint if exists occasions_no_overlap;
alter table public.special_occasions add constraint occasions_no_overlap
  exclude using gist (daterange(start_date, end_date, '[]') with &&) where (active);

create index if not exists occasions_range_idx
  on public.special_occasions (start_date, end_date) where active;

drop trigger if exists touch_special_occasions on public.special_occasions;
create trigger touch_special_occasions before update on public.special_occasions
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------- checkout

alter table public.bookings
  add column if not exists civil_id_path    text,
  add column if not exists terms_accepted_at timestamptz;

comment on column public.bookings.civil_id_path is
  'Object path in the private civil-ids storage bucket. Admins read it through '
  'a signed URL; it is never public.';

-- 'special' joins the package vocabulary now that an occasion can price a stay.
alter table public.bookings drop constraint if exists bookings_package_key_check;
alter table public.bookings add constraint bookings_package_key_check
  check (package_key in ('fullWeek', 'weekend', 'weekday', 'special'));

-- ------------------------------------------------------------- pricing

/**
 * Price a stay.
 *
 * Precedence, most specific first:
 *   1. custom day prices  — if the admin priced any day in the range, the whole
 *                           range is summed per day so an override is never
 *                           masked by a flat rate.
 *   2. special occasion   — the occasion's flat price, plus the per-day default
 *                           for any days the stay extends beyond the window.
 *   3. exact package      — fullWeek / weekend / weekday.
 *   4. per-day defaults.
 *
 * Returns the occasion name when branch 2 applied, so the UI can say why the
 * price is what it is.
 */
drop function if exists public.quote_stay(smallint, date, date);
create function public.quote_stay(
  p_chalet_id smallint,
  p_start     date,
  p_end       date
)
returns table (total numeric, package_key text, days integer, has_custom boolean, occasion text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_rates      public.rates;
  v_has_custom boolean;
  v_package    text;
  v_sum        numeric;
  v_occ        public.special_occasions%rowtype;
  v_outside    numeric;
begin
  if p_end < p_start then
    raise exception 'end date precedes start date' using errcode = '22007';
  end if;

  select * into v_rates from public.rates where id limit 1;
  if not found then
    raise exception 'rates are not configured' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.day_prices dp
    where dp.chalet_id = p_chalet_id and dp.day between p_start and p_end
  ) into v_has_custom;

  select coalesce(sum(coalesce(dp.price, public.default_day_rate(d::date, v_rates))), 0)
    into v_sum
  from generate_series(p_start, p_end, interval '1 day') d
  left join public.day_prices dp
    on dp.chalet_id = p_chalet_id and dp.day = d::date;

  if v_has_custom then
    return query select v_sum, null::text, (p_end - p_start + 1)::integer, true, null::text;
    return;
  end if;

  -- The overlap constraint makes at most one active occasion possible here;
  -- the ordering only decides which wins if that constraint is ever relaxed.
  select * into v_occ
  from public.special_occasions o
  where o.active
    and daterange(o.start_date, o.end_date, '[]') && daterange(p_start, p_end, '[]')
  order by o.price desc, o.start_date
  limit 1;

  if found then
    select coalesce(sum(public.default_day_rate(d::date, v_rates)), 0)
      into v_outside
    from generate_series(p_start, p_end, interval '1 day') d
    where d::date < v_occ.start_date or d::date > v_occ.end_date;

    return query select
      v_occ.price + v_outside, 'special'::text,
      (p_end - p_start + 1)::integer, false, v_occ.name_en;
    return;
  end if;

  v_package := public.match_package(p_start, p_end);

  return query select
    case v_package
      when 'fullWeek' then v_rates.full_week
      when 'weekend'  then v_rates.weekend
      when 'weekday'  then v_rates.weekday
      else v_sum
    end,
    v_package,
    (p_end - p_start + 1)::integer,
    false,
    null::text;
end;
$$;

-- ------------------------------------------------------- request_booking

/**
 * The only way a guest creates a booking.
 *
 * Now also the gate for the two checkout requirements: a Civil ID image must
 * already be uploaded (the client puts it in the private bucket and passes the
 * path) and the terms must be explicitly accepted. Both are enforced here
 * rather than only in the form, because the form is not the security boundary.
 */
-- Drop the old 8-argument signature so it cannot linger as an overload that
-- bypasses the new checkout requirements; "or replace" on the new one keeps
-- re-applying the migrations idempotent.
drop function if exists public.request_booking(smallint, date, date, text, text, text, smallint, text);
create or replace function public.request_booking(
  p_chalet_id      smallint,
  p_start          date,
  p_end            date,
  p_guest_name     text,
  p_guest_phone    text,
  p_guest_email    text,
  p_guests         smallint,
  p_notes          text default null,
  p_civil_id_path  text default null,
  p_terms_accepted boolean default false
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_min      smallint;
  v_quote    record;
  v_booking  public.bookings;
  v_recent   integer;
  v_civil    text := nullif(btrim(coalesce(p_civil_id_path, '')), '');
begin
  -- Order matters: check the range is coherent before measuring its length,
  -- otherwise a reversed range reports "minimum stay" and confuses the guest.
  if p_start is null or p_end is null then
    raise exception 'Please choose your dates' using errcode = 'P0001';
  end if;
  if p_end < p_start then
    raise exception 'The check-out date must be on or after the check-in date'
      using errcode = 'P0001';
  end if;

  select min_stay_days into v_min from public.rates where id limit 1;
  v_min := coalesce(v_min, 3);
  if p_end - p_start + 1 < v_min then
    raise exception 'Minimum stay is % days', v_min using errcode = 'P0001';
  end if;

  if p_guests is null or p_guests < 1 or p_guests > 20 then
    raise exception 'Please enter between 1 and 20 guests' using errcode = 'P0001';
  end if;

  if length(btrim(coalesce(p_guest_name, ''))) < 2 then
    raise exception 'Please enter your full name' using errcode = 'P0001';
  end if;
  if length(regexp_replace(coalesce(p_guest_phone, ''), '\D', '', 'g')) < 8 then
    raise exception 'Please enter a valid phone number' using errcode = 'P0001';
  end if;
  -- Validate the TRIMMED value: the row is stored trimmed, and pasted
  -- addresses routinely carry surrounding whitespace.
  if btrim(coalesce(p_guest_email, '')) !~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    raise exception 'Please enter a valid email address' using errcode = 'P0001';
  end if;

  if not coalesce(p_terms_accepted, false) then
    raise exception 'Please accept the terms and regulations to continue.'
      using errcode = 'P0001';
  end if;

  if v_civil is null then
    raise exception 'A Civil ID image is required to complete the booking.'
      using errcode = 'P0001';
  end if;

  -- The bucket's own policies decide what may be stored; this only keeps a
  -- caller from writing an arbitrary string into the column.
  if length(v_civil) > 300 or v_civil !~ '^[A-Za-z0-9._/-]+$' then
    raise exception 'That Civil ID upload is not valid. Please attach it again.'
      using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.chalets c where c.id = p_chalet_id and c.active) then
    raise exception 'Unknown chalet' using errcode = 'P0002';
  end if;

  if not public.is_range_available(p_chalet_id, p_start, p_end) then
    raise exception 'Those dates are no longer available' using errcode = 'P0001';
  end if;

  -- Light abuse guard: one email cannot flood the queue.
  select count(*) into v_recent
  from public.bookings b
  where lower(b.guest_email) = lower(btrim(p_guest_email))
    and b.created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'Too many requests. Please contact us directly.' using errcode = 'P0001';
  end if;

  select * into v_quote from public.quote_stay(p_chalet_id, p_start, p_end);

  insert into public.bookings (
    ref, chalet_id, start_date, end_date, total, package_key,
    guest_name, guest_phone, guest_email, guests, notes, status,
    civil_id_path, terms_accepted_at
  ) values (
    public.generate_booking_ref(), p_chalet_id, p_start, p_end,
    v_quote.total, v_quote.package_key,
    btrim(p_guest_name), btrim(p_guest_phone), lower(btrim(p_guest_email)),
    p_guests, nullif(btrim(coalesce(p_notes, '')), ''), 'pending',
    v_civil, now()
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

-- ------------------------------------------------------------------- RLS

alter table public.special_occasions enable row level security;

drop policy if exists occasions_public_read on public.special_occasions;
create policy occasions_public_read on public.special_occasions
  for select to anon, authenticated using (true);

drop policy if exists occasions_admin_write on public.special_occasions;
create policy occasions_admin_write on public.special_occasions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.special_occasions to anon, authenticated;
grant select, insert, update, delete on public.special_occasions to authenticated;

-- Re-grant: dropping a function drops its grants with it.
revoke all on function public.quote_stay(smallint, date, date) from public;
revoke all on function public.request_booking(
  smallint, date, date, text, text, text, smallint, text, text, boolean) from public;

grant execute on function public.quote_stay(smallint, date, date) to anon, authenticated;
grant execute on function public.request_booking(
  smallint, date, date, text, text, text, smallint, text, text, boolean)
  to anon, authenticated;

-- --------------------------------------------------------------- storage

-- Guarded: the local test harness emulates auth but not storage, so this is a
-- no-op there and applies on Supabase.
do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('civil-ids', 'civil-ids', false, 5242880,
          array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- A guest uploads their own ID before the booking exists, so anon needs
  -- INSERT. It deliberately gets nothing else: no select, update or delete,
  -- so an uploaded ID cannot be read back, overwritten or enumerated.
  drop policy if exists "civil ids: guests may upload" on storage.objects;
  create policy "civil ids: guests may upload" on storage.objects
    for insert to anon, authenticated
    with check (bucket_id = 'civil-ids');

  drop policy if exists "civil ids: admins may read" on storage.objects;
  create policy "civil ids: admins may read" on storage.objects
    for select to authenticated
    using (bucket_id = 'civil-ids' and public.is_admin());

  drop policy if exists "civil ids: admins may delete" on storage.objects;
  create policy "civil ids: admins may delete" on storage.objects
    for delete to authenticated
    using (bucket_id = 'civil-ids' and public.is_admin());
end $$;

-- ===== migrations/20260928090000_email_verification_and_phone_lookup.sql =

-- ============================================================================
-- Proving the guest owns the email address, emailing them their reference, and
-- letting them find a booking again with just their phone number.
--
-- Three connected changes:
--
--   1. A one-time code, mailed to the address the guest typed, which they must
--      enter before request_booking() will accept it. A mistyped address used
--      to fail silently: the booking went through, the confirmation bounced,
--      and nobody found out until the guest called.
--
--   2. lookup_booking_by_phone(), so a returning guest who has lost the
--      reference can still find their stay.
--
--   3. A settings switch for (1), because it puts email delivery on the
--      critical path of every booking. If Resend is misconfigured, flipping
--      require_email_verification to false keeps the site taking bookings.
-- ============================================================================

-- --------------------------------------------------------- email verification

create table if not exists public.email_verifications (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  salt       text not null,
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   smallint not null default 0,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.email_verifications is
  'One-time email codes. Only the salted SHA-256 of the code is stored; the '
  'plaintext exists for the length of one function call, long enough to be '
  'handed to the mailer.';

create index if not exists email_verifications_email_idx
  on public.email_verifications (lower(email), created_at desc);

-- No policies at all. Every path in and out is a SECURITY DEFINER function
-- below, so a guest can neither read a hash nor write one they already know.
alter table public.email_verifications enable row level security;

/**
 * Mint a code and return it to the caller to deliver.
 *
 * Returning the plaintext is the whole point, and the reason this is granted
 * to service_role only: the Edge Function that sends the mail is the sole
 * caller. If anon could call it, a guest could mint a code for any address,
 * read it straight out of the response, and "verify" an address they do not
 * own — which is exactly what this is meant to prevent.
 */
create or replace function public.start_email_verification(p_email text)
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_code   text;
  v_salt   text;
  v_recent integer;
begin
  if v_email !~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    raise exception 'Please enter a valid email address' using errcode = 'P0001';
  end if;

  select count(*) into v_recent
  from public.email_verifications v
  where lower(v.email) = v_email
    and v.created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'Too many codes requested. Please try again later.'
      using errcode = 'P0001';
  end if;

  -- gen_random_bytes, not random(): this is an authentication code, and
  -- random() is seeded predictably enough to guess a sequence of them.
  v_code := lpad((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint
                  % 1000000)::text, 6, '0');
  v_salt := encode(gen_random_bytes(16), 'hex');

  insert into public.email_verifications (email, salt, code_hash, expires_at)
  values (v_email, v_salt,
          encode(digest(v_salt || v_code, 'sha256'), 'hex'),
          now() + interval '10 minutes');

  return v_code;
end;
$$;

/**
 * Check a code the guest typed.
 *
 * A wrong code RETURNS FALSE rather than raising, and that is load-bearing.
 * Raising would roll the statement back — including the attempts increment
 * made two lines earlier — so the counter would never advance and the cap
 * below would never fire, leaving a six-digit code open to being guessed.
 * The caller words the message; only this function knows the count is real.
 */
create or replace function public.verify_email_code(p_email text, p_code text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_code  text := btrim(coalesce(p_code, ''));
  v_row   public.email_verifications%rowtype;
begin
  -- Only the newest outstanding code counts. Asking for a second code should
  -- retire the first, or a guest who requests three and reads the oldest mail
  -- gets a confusing failure.
  select * into v_row
  from public.email_verifications v
  where lower(v.email) = v_email
    and v.verified_at is null
  order by v.created_at desc
  limit 1
  for update;

  if not found or v_row.expires_at <= now() then
    raise exception 'That code has expired. Please request a new one.'
      using errcode = 'P0001';
  end if;

  if v_row.attempts >= 5 then
    raise exception 'Too many attempts. Please request a new code.'
      using errcode = 'P0001';
  end if;

  update public.email_verifications
     set attempts = attempts + 1
   where id = v_row.id;

  if encode(digest(v_row.salt || v_code, 'sha256'), 'hex') <> v_row.code_hash then
    return false;
  end if;

  update public.email_verifications
     set verified_at = now()
   where id = v_row.id;

  return true;
end;
$$;

/**
 * Was this address proved recently? The window is long enough to finish the
 * form and short enough that a verification cannot be banked for later.
 */
create or replace function public.is_email_verified(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.email_verifications v
    where lower(v.email) = lower(btrim(coalesce(p_email, '')))
      and v.verified_at > now() - interval '1 hour'
  );
$$;

-- ------------------------------------------------------------- phone lookup

create table if not exists public.lookup_attempts (
  id         bigserial primary key,
  phone_tail text not null,
  at         timestamptz not null default now()
);

comment on table public.lookup_attempts is
  'Throttle for lookup_booking_by_phone. Holds the last 8 digits only, never '
  'a whole number.';

create index if not exists lookup_attempts_recent_idx
  on public.lookup_attempts (phone_tail, at desc);

alter table public.lookup_attempts enable row level security;

/**
 * Find a booking from the phone number alone.
 *
 * DELIBERATE EXPOSURE, chosen by the owner: unlike lookup_booking(), this
 * asks for nothing the guest has to have been told. Anyone who knows a
 * number can see whether it has a stay booked, when, and for how much. The
 * throttle below slows repeated hits on one number; it does not make the
 * data private, and nothing here can. Do not widen the returned columns
 * without revisiting that trade.
 *
 * Matching is on the last 8 digits so +965 9404 0955, 96594040955 and
 * 94040955 are the same number, which is how guests actually type it.
 */
create or replace function public.lookup_booking_by_phone(p_phone text)
returns table (
  ref text, status public.booking_status, chalet_id smallint,
  start_date date, end_date date, days integer, total numeric, currency text
)
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_tail   text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 8);
  v_recent integer;
begin
  if length(v_tail) < 8 then
    raise exception 'Please enter a valid phone number' using errcode = 'P0001';
  end if;

  delete from public.lookup_attempts where at < now() - interval '1 day';

  select count(*) into v_recent
  from public.lookup_attempts a
  where a.phone_tail = v_tail and a.at > now() - interval '1 hour';
  if v_recent >= 20 then
    raise exception 'Too many lookups. Please try again later.' using errcode = 'P0001';
  end if;

  insert into public.lookup_attempts (phone_tail) values (v_tail);

  return query
    select b.ref, b.status, b.chalet_id, b.start_date, b.end_date,
           b.days, b.total, b.currency
    from public.bookings b
    where right(regexp_replace(b.guest_phone, '\D', '', 'g'), 8) = v_tail
    order by b.created_at desc
    limit 5;
end;
$$;

-- ------------------------------------------------------------ booking lang

-- The guest's copy of the confirmation is written in whichever language they
-- booked in; without this the notifier has no way to know which that was and
-- every Arabic guest gets an English email.
alter table public.bookings
  add column if not exists lang text not null default 'en';
alter table public.bookings drop constraint if exists bookings_lang_check;
alter table public.bookings add constraint bookings_lang_check check (lang in ('en', 'ar'));

-- --------------------------------------------------- request_booking, gated

-- The whole function is restated rather than patched, because Postgres has no
-- way to edit one. It is the previous body with the verification block added
-- after the email format check; nothing else about it changed.
drop function if exists public.request_booking(
  smallint, date, date, text, text, text, smallint, text, text, boolean);
drop function if exists public.request_booking(
  smallint, date, date, text, text, text, smallint, text, text, boolean, text);
create or replace function public.request_booking(
  p_chalet_id      smallint,
  p_start          date,
  p_end            date,
  p_guest_name     text,
  p_guest_phone    text,
  p_guest_email    text,
  p_guests         smallint,
  p_notes          text default null,
  p_civil_id_path  text default null,
  p_terms_accepted boolean default false,
  p_lang           text default 'en'
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_min      smallint;
  v_quote    record;
  v_booking  public.bookings;
  v_recent   integer;
  v_civil    text := nullif(btrim(coalesce(p_civil_id_path, '')), '');
begin
  -- Order matters: check the range is coherent before measuring its length,
  -- otherwise a reversed range reports "minimum stay" and confuses the guest.
  if p_start is null or p_end is null then
    raise exception 'Please choose your dates' using errcode = 'P0001';
  end if;
  if p_end < p_start then
    raise exception 'The check-out date must be on or after the check-in date'
      using errcode = 'P0001';
  end if;

  select min_stay_days into v_min from public.rates where id limit 1;
  v_min := coalesce(v_min, 3);
  if p_end - p_start + 1 < v_min then
    raise exception 'Minimum stay is % days', v_min using errcode = 'P0001';
  end if;

  if p_guests is null or p_guests < 1 or p_guests > 20 then
    raise exception 'Please enter between 1 and 20 guests' using errcode = 'P0001';
  end if;

  if length(btrim(coalesce(p_guest_name, ''))) < 2 then
    raise exception 'Please enter your full name' using errcode = 'P0001';
  end if;
  if length(regexp_replace(coalesce(p_guest_phone, ''), '\D', '', 'g')) < 8 then
    raise exception 'Please enter a valid phone number' using errcode = 'P0001';
  end if;
  -- Validate the TRIMMED value: the row is stored trimmed, and pasted
  -- addresses routinely carry surrounding whitespace.
  if btrim(coalesce(p_guest_email, '')) !~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    raise exception 'Please enter a valid email address' using errcode = 'P0001';
  end if;

  -- The form asks for the code, but the form is not the security boundary.
  -- Gated on a setting because it puts mail delivery on the critical path of
  -- every booking: if Resend breaks, this is the switch that keeps the site
  -- open. Missing key means on, so a fresh database is strict by default.
  if coalesce(
       (select value = 'true'::jsonb from public.settings
         where key = 'require_email_verification'),
       true)
     and not public.is_email_verified(p_guest_email) then
    raise exception 'Please confirm your email address with the code we sent you.'
      using errcode = 'P0001';
  end if;

  if not coalesce(p_terms_accepted, false) then
    raise exception 'Please accept the terms and regulations to continue.'
      using errcode = 'P0001';
  end if;

  if v_civil is null then
    raise exception 'A Civil ID image is required to complete the booking.'
      using errcode = 'P0001';
  end if;

  -- The bucket's own policies decide what may be stored; this only keeps a
  -- caller from writing an arbitrary string into the column.
  if length(v_civil) > 300 or v_civil !~ '^[A-Za-z0-9._/-]+$' then
    raise exception 'That Civil ID upload is not valid. Please attach it again.'
      using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.chalets c where c.id = p_chalet_id and c.active) then
    raise exception 'Unknown chalet' using errcode = 'P0002';
  end if;

  if not public.is_range_available(p_chalet_id, p_start, p_end) then
    raise exception 'Those dates are no longer available' using errcode = 'P0001';
  end if;

  -- Light abuse guard: one email cannot flood the queue.
  select count(*) into v_recent
  from public.bookings b
  where lower(b.guest_email) = lower(btrim(p_guest_email))
    and b.created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'Too many requests. Please contact us directly.' using errcode = 'P0001';
  end if;

  select * into v_quote from public.quote_stay(p_chalet_id, p_start, p_end);

  insert into public.bookings (
    ref, chalet_id, start_date, end_date, total, package_key,
    guest_name, guest_phone, guest_email, guests, notes, status,
    civil_id_path, terms_accepted_at, lang
  ) values (
    public.generate_booking_ref(), p_chalet_id, p_start, p_end,
    v_quote.total, v_quote.package_key,
    btrim(p_guest_name), btrim(p_guest_phone), lower(btrim(p_guest_email)),
    p_guests, nullif(btrim(coalesce(p_notes, '')), ''), 'pending',
    v_civil, now(),
    case when lower(coalesce(p_lang, 'en')) = 'ar' then 'ar' else 'en' end
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

-- ------------------------------------------------------------------- settings

insert into public.settings (key, value) values
  ('require_email_verification', 'true'::jsonb)
on conflict (key) do nothing;

-- --------------------------------------------------------------------- grants

revoke all on function public.start_email_verification(text) from public;
revoke all on function public.verify_email_code(text, text)   from public;
revoke all on function public.is_email_verified(text)         from public;
revoke all on function public.lookup_booking_by_phone(text)   from public;
revoke all on function public.request_booking(
  smallint, date, date, text, text, text, smallint, text, text, boolean, text) from public;

grant execute on function public.verify_email_code(text, text)   to anon, authenticated;
grant execute on function public.lookup_booking_by_phone(text)   to anon, authenticated;
grant execute on function public.request_booking(
  smallint, date, date, text, text, text, smallint, text, text, boolean, text)
  to anon, authenticated;

-- start_email_verification hands back the plaintext code, so it goes to the
-- mailer and to nobody else. is_email_verified is not granted either: the
-- gate in request_booking is the only thing that needs to ask, and a guest
-- being able to probe which addresses have verified is an avoidable leak.
-- The role exists in Supabase but not in the local test harness, where the
-- suites call these as the owner instead.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.start_email_verification(text) to service_role;
    grant execute on function public.is_email_verified(text)        to service_role;
  end if;
end $$;

-- ===== migrations/20260929090000_min_stay_one_day.sql ==============

-- ============================================================================
-- A single night is a booking.
--
-- The minimum was three days, which refused the shortest stay the chalet is
-- happy to take. One day matches no package, so quote_stay falls through to
-- the per-day rates and prices it correctly with no further change.
--
-- The value lives in public.rates and the admin panel edits it, so this moves
-- the default and the current row rather than hard-coding anything.
-- ============================================================================

alter table public.rates alter column min_stay_days set default 1;

-- Only the old default is moved. An admin who has deliberately set some other
-- minimum keeps it, and re-running this migration does not undo their choice.
update public.rates set min_stay_days = 1 where min_stay_days = 3;

-- ===== migrations/20260930090000_lookup_three_ways.sql =============

-- ============================================================================
-- Three ways to find a booking: the reference, the email, or the phone.
--
-- A guest who has lost one of the three still has the other two. Each is a
-- single field — asking for two makes the "I have lost it" case worse, which
-- is the only case this page exists for.
--
-- The throttle is shared rather than per-function, so a new way in cannot
-- ship without one. It is generalised from the phone-only table the previous
-- migration added; throttle rows are disposable, so that one is dropped.
-- ============================================================================

drop table if exists public.lookup_attempts;

create table if not exists public.lookup_throttle (
  id      bigserial primary key,
  kind    text not null,
  subject text not null,
  at      timestamptz not null default now()
);

comment on table public.lookup_throttle is
  'Rate limiting for the booking lookups. subject is the thing being looked '
  'up, never more of it than the match needs: the last 8 digits of a phone, '
  'not the whole number.';

create index if not exists lookup_throttle_recent_idx
  on public.lookup_throttle (kind, subject, at desc);

alter table public.lookup_throttle enable row level security;

/**
 * Record one attempt and refuse when there have been too many.
 *
 * Not granted to anon: the lookups below are SECURITY DEFINER, so they call
 * this as the owner. A guest able to call it directly could fill the table.
 */
create or replace function public.note_lookup(
  p_kind    text,
  p_subject text,
  p_cap     integer default 20
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_recent integer;
begin
  delete from public.lookup_throttle where at < now() - interval '1 day';

  select count(*) into v_recent
  from public.lookup_throttle t
  where t.kind = p_kind and t.subject = p_subject and t.at > now() - interval '1 hour';

  if v_recent >= p_cap then
    raise exception 'Too many lookups. Please try again later.' using errcode = 'P0001';
  end if;

  insert into public.lookup_throttle (kind, subject) values (p_kind, p_subject);
end;
$$;

-- ---------------------------------------------------------------- by reference

/**
 * The reference is the one thing a guest was given that nobody else knows,
 * so it stands on its own — the same way a parcel tracking number does.
 */
create or replace function public.lookup_booking_by_ref(p_ref text)
returns table (
  ref text, status public.booking_status, chalet_id smallint,
  start_date date, end_date date, days integer, total numeric, currency text
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_ref text := upper(btrim(coalesce(p_ref, '')));
begin
  if v_ref = '' then
    raise exception 'Please enter your booking reference' using errcode = 'P0001';
  end if;

  -- Tighter than the others: a reference is guessable in a way an address is
  -- not, so repeated tries at one are worth slowing down harder.
  perform public.note_lookup('ref', v_ref, 10);

  return query
    select b.ref, b.status, b.chalet_id, b.start_date, b.end_date,
           b.days, b.total, b.currency
    from public.bookings b
    where b.ref = v_ref;
end;
$$;

-- -------------------------------------------------------------------- by email

/**
 * DELIBERATE EXPOSURE, the same trade as the phone lookup: anyone who knows
 * an address can see what it has booked. Chosen so a guest who has lost the
 * reference is not stuck. Do not widen the returned columns without
 * revisiting that.
 */
create or replace function public.lookup_booking_by_email(p_email text)
returns table (
  ref text, status public.booking_status, chalet_id smallint,
  start_date date, end_date date, days integer, total numeric, currency text
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_email !~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    raise exception 'Please enter a valid email address' using errcode = 'P0001';
  end if;

  perform public.note_lookup('email', v_email, 20);

  return query
    select b.ref, b.status, b.chalet_id, b.start_date, b.end_date,
           b.days, b.total, b.currency
    from public.bookings b
    where lower(b.guest_email) = v_email
    order by b.created_at desc
    limit 5;
end;
$$;

-- -------------------------------------------------------------------- by phone

-- Restated against the shared throttle; the matching rule is unchanged.
create or replace function public.lookup_booking_by_phone(p_phone text)
returns table (
  ref text, status public.booking_status, chalet_id smallint,
  start_date date, end_date date, days integer, total numeric, currency text
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_tail text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 8);
begin
  if length(v_tail) < 8 then
    raise exception 'Please enter a valid phone number' using errcode = 'P0001';
  end if;

  perform public.note_lookup('phone', v_tail, 20);

  return query
    select b.ref, b.status, b.chalet_id, b.start_date, b.end_date,
           b.days, b.total, b.currency
    from public.bookings b
    where right(regexp_replace(b.guest_phone, '\D', '', 'g'), 8) = v_tail
    order by b.created_at desc
    limit 5;
end;
$$;

-- --------------------------------------------------------------------- grants

revoke all on function public.note_lookup(text, text, integer)   from public;
revoke all on function public.lookup_booking_by_ref(text)        from public;
revoke all on function public.lookup_booking_by_email(text)      from public;
revoke all on function public.lookup_booking_by_phone(text)      from public;

grant execute on function public.lookup_booking_by_ref(text)     to anon, authenticated;
grant execute on function public.lookup_booking_by_email(text)   to anon, authenticated;
grant execute on function public.lookup_booking_by_phone(text)   to anon, authenticated;

-- ===== migrations/20260930120000_latin_digits_in_arabic_names.sql ==

-- ============================================================================
-- One digit set on the Arabic site.
--
-- The chalets were seeded "شاليه بيزاري ١" and "شاليه بيزاري ٢", in
-- Arabic-Indic digits. Nothing else on the site is written that way: a price
-- is "350 د.ك", a booking reference is BZR-4K2M9X, the phone number is
-- +965 94040955, and the day cells of the booking calendar are a plain 1, 2,
-- 3. A reference and a phone number cannot be anything but Latin, so Latin is
-- the only digit set the whole site can agree on, and the front end now
-- formats every date that way too.
--
-- Only rows still holding the seeded name are touched. An owner who has
-- renamed a chalet from the admin panel keeps their name; for them this is a
-- no-op, which is also what makes it safe to re-run.
-- ============================================================================

update public.chalets set name_ar = 'شاليه بيزاري 1'
 where id = 1 and name_ar = 'شاليه بيزاري ١';

update public.chalets set name_ar = 'شاليه بيزاري 2'
 where id = 2 and name_ar = 'شاليه بيزاري ٢';

