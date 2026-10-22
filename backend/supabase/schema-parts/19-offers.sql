-- ============================================================================
-- Part 19 of 21: offers
--
-- Paste this whole file into the Supabase SQL editor and Run, then move on
-- to the next part. Run them in order; each one is safe to run twice.
-- ============================================================================

-- ============================================================================
-- Offers: dates the admin picks, at one price for the whole stay.
--
-- The Offers page used to list the special occasions, which made the two the
-- same thing under two names. They are not: a special occasion is a premium
-- window like Eid, booked under Special Occasions on the booking page; an
-- offer is a stay the owner wants to sell -- these dates, this price -- and is
-- what the Offers page is for.
--
-- An offer prices exactly its own dates. Booked as they are, the stay costs
-- the offer's price, whatever the rates, a custom day price or an occasion
-- would otherwise make it; the admin chose that number for those dates. A
-- stay that only overlaps an offer is priced as if the offer were not there,
-- so an offer never prices a stay it was not made for.
--
-- An offer can be for one chalet or for both (chalet_id null). Its dates must
-- be bookable: no slice of a Thu-Sat, which request_booking() would refuse.
-- ============================================================================

create table if not exists public.offers (
  id         uuid primary key default gen_random_uuid(),
  title_en   text not null default '',
  title_ar   text not null default '',
  chalet_id  smallint references public.chalets (id) on delete cascade,
  start_date date not null,
  end_date   date not null,
  price      numeric(10,3) not null check (price >= 0),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  constraint offers_dates_ordered check (end_date >= start_date),
  constraint offers_at_most_90_days check (end_date - start_date + 1 <= 90),
  constraint offers_weekend_whole check (public.weekend_is_whole(start_date, end_date))
);

comment on table public.offers is
  'Stays the admin sells at a set price: start_date..end_date (inclusive) for '
  'price, on chalet_id or on either chalet when it is null. Shown on the '
  'Offers page; quote_stay() charges price for exactly those dates.';

create index if not exists offers_dates_idx
  on public.offers (start_date, end_date) where active;

drop trigger if exists touch_offers on public.offers;
create trigger touch_offers before update on public.offers
  for each row execute function public.touch_updated_at();

-- 'offer' joins the package vocabulary: a booking priced by one says so.
alter table public.bookings drop constraint if exists bookings_package_key_check;
alter table public.bookings add constraint bookings_package_key_check
  check (package_key in ('fullWeek', 'weekend', 'weekday', 'special', 'offer'));

-- ------------------------------------------------------------- pricing

/**
 * Price a stay. Restated from 20261001090000 with the offer in front:
 *
 *   0. an offer for exactly these dates, on this chalet or on both -- its
 *      price, as it stands. The cheapest if two match.
 *   1. custom day prices  -- summed per day, so an override is never masked.
 *   2. special occasion   -- its flat price, plus the days outside it.
 *   3. exact package      -- fullWeek / weekend / weekday.
 *   4. per-day defaults, a whole Thu-Sat priced as one weekend.
 *
 * Returns the offer's English title in `occasion` when step 0 applied.
 */
create or replace function public.quote_stay(
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
  v_offer      public.offers%rowtype;
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

  select * into v_offer
  from public.offers f
  where f.active
    and f.start_date = p_start
    and f.end_date = p_end
    and (f.chalet_id is null or f.chalet_id = p_chalet_id)
  order by f.price, f.chalet_id nulls last
  limit 1;

  if found then
    return query select
      v_offer.price, 'offer'::text, (p_end - p_start + 1)::integer, false,
      nullif(btrim(v_offer.title_en), '');
    return;
  end if;

  select exists (
    select 1 from public.day_prices dp
    where dp.chalet_id = p_chalet_id and dp.day between p_start and p_end
  ) into v_has_custom;

  v_sum := public.sum_stay_days(p_chalet_id, p_start, p_end);

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
    v_outside := public.sum_stay_days(
      p_chalet_id, p_start, p_end, v_occ.start_date, v_occ.end_date);

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

revoke all on function public.quote_stay(smallint, date, date) from public;
grant execute on function public.quote_stay(smallint, date, date) to anon, authenticated;

-- ------------------------------------------------------------------- RLS

alter table public.offers enable row level security;

-- Guests see the offers that are on; the admin sees them all.
drop policy if exists offers_public_read on public.offers;
create policy offers_public_read on public.offers
  for select to anon, authenticated using (active or public.is_admin());

drop policy if exists offers_admin_write on public.offers;
create policy offers_admin_write on public.offers
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.offers to anon, authenticated;
grant insert, update, delete on public.offers to authenticated;

-- ------------------------------------------------------------- activity log

create or replace function public.log_offer_change()
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
    values (auth.uid(), 'offer.created', 'offers', new.id::text,
            jsonb_build_object('title', new.title_en, 'chalet', new.chalet_id,
                               'start', new.start_date, 'end', new.end_date,
                               'price', new.price));
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'offer.deleted', 'offers', old.id::text,
            jsonb_build_object('title', old.title_en, 'start', old.start_date,
                               'end', old.end_date, 'price', old.price));
    return old;
  end if;

  if old.title_en is distinct from new.title_en then
    v_changed := v_changed || jsonb_build_object('title_en', jsonb_build_array(old.title_en, new.title_en));
  end if;
  if old.title_ar is distinct from new.title_ar then
    v_changed := v_changed || jsonb_build_object('title_ar', jsonb_build_array(old.title_ar, new.title_ar));
  end if;
  if old.chalet_id is distinct from new.chalet_id then
    v_changed := v_changed || jsonb_build_object('chalet', jsonb_build_array(old.chalet_id, new.chalet_id));
  end if;
  if old.start_date is distinct from new.start_date then
    v_changed := v_changed || jsonb_build_object('start_date', jsonb_build_array(old.start_date, new.start_date));
  end if;
  if old.end_date is distinct from new.end_date then
    v_changed := v_changed || jsonb_build_object('end_date', jsonb_build_array(old.end_date, new.end_date));
  end if;
  if old.price is distinct from new.price then
    v_changed := v_changed || jsonb_build_object('price', jsonb_build_array(old.price, new.price));
  end if;
  if old.active is distinct from new.active then
    v_changed := v_changed || jsonb_build_object('active', jsonb_build_array(old.active, new.active));
  end if;

  if v_changed <> '{}'::jsonb then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'offer.updated', 'offers', new.id::text,
            v_changed || jsonb_build_object('title', new.title_en));
  end if;
  return new;
end;
$$;

drop trigger if exists audit_offers on public.offers;
create trigger audit_offers
  after insert or update or delete on public.offers
  for each row execute function public.log_offer_change();
