-- ============================================================================
-- Part 12 of 15: weekend_is_one_product
--
-- Paste this whole file into the Supabase SQL editor and Run, then move on
-- to the next part. Run them in order; each one is safe to run twice.
-- ============================================================================

-- ============================================================================
-- The weekend is one product, not three nights.
--
-- Sun-Wed is sold by the day at the daily weekday rate, and one day is a
-- booking. Thu-Sat is not: it is a single three-day stay at rates.weekend, so
-- a guest may not take a slice of it. No lone Friday, and no stay that runs
-- Sun-Thu and stops before Saturday -- a stay that reaches a weekend carries
-- all three of its days or it is refused.
--
-- Three parts, and all three are needed:
--   weekend_is_whole()  decides whether a range may be booked at all, and
--                       request_booking() refuses one that is not.
--   sum_stay_days()     the per-day sum, with a complete Thu-Sat charged once
--                       at the weekend rate instead of three daily ones, so
--                       Wed-Sat is 75 + 350 rather than 75 + 3 x 120.
--   quote_stay()        unchanged in shape; it just sums through the above,
--                       in both the plain case and the days a special
--                       occasion does not cover, so one rule serves both.
--
-- rates.daily_weekend keeps its column and its meaning. Nothing a guest can
-- book reaches it now, because a weekend day only ever appears inside a whole
-- block, but it is what a block falls back to when a custom day price breaks
-- one up, and if this rule is ever relaxed it is what a loose weekend night
-- costs again. The admin panel says as much rather than hiding the field.
--
-- Sun-Sat is untouched: match_package() still prices it as a full week, at
-- 600 rather than the 650 it would otherwise sum to. The most specific rule
-- that matches wins, and that one favours the guest.
-- ============================================================================

-- Thu(4) Fri(5) Sat(6). For each weekend day in the range, the Thursday and
-- the Saturday of its own weekend must be inside the range too.
create or replace function public.weekend_is_whole(p_start date, p_end date)
returns boolean
language sql
immutable
as $$
  select not exists (
    select 1
    from generate_series(p_start, p_end, interval '1 day') d
    where extract(dow from d) >= 4
      and (
        d::date - (extract(dow from d)::int - 4) < p_start   -- its Thursday
        or d::date + (6 - extract(dow from d)::int) > p_end  -- its Saturday
      )
  );
$$;

-- --------------------------------------------------------------- the day sum

/**
 * What the days of a stay cost, before any package or occasion rate.
 *
 * A complete Thu-Sat costs rates.weekend once rather than three daily rates.
 * "Complete" is decided per day rather than assumed, because this also prices
 * ranges nobody may book: the admin panel quotes a stay it is editing, and the
 * client mirrors this to show a live total while a guest is still dragging
 * across the calendar. A Thu-Fri whose Saturday is outside the range has to
 * come out as two daily rates, not as a weekend that was never there, or the
 * number on screen is one the server would never charge.
 *
 * A custom price anywhere in a block takes that block back to per-day, for the
 * same reason a custom price anywhere in a range suppresses the packages: an
 * override must never be masked by a flat rate.
 *
 * p_skip_from/p_skip_to exclude a window -- the days a special occasion has
 * already paid for. A block that straddles the edge of that window is not
 * whole among the days being summed, so it falls back to daily rates, which
 * is the same rule rather than an exception to it.
 */
create or replace function public.sum_stay_days(
  p_chalet_id smallint,
  p_start     date,
  p_end       date,
  p_skip_from date default null,
  p_skip_to   date default null
)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with v_rates as (select * from public.rates where id limit 1),
  counted as (
    select
      d::date                                  as day,
      extract(dow from d)::int                 as dow,
      d::date - (extract(dow from d)::int - 4) as blk_from,
      d::date + (6 - extract(dow from d)::int) as blk_to
    from generate_series(p_start, p_end, interval '1 day') d
    where p_skip_from is null
       or d::date < p_skip_from
       or d::date > p_skip_to
  ),
  priced as (
    select
      c.day,
      c.dow,
      dp.price as custom_price,
      (
        c.dow >= 4
        -- every day of the block is one of the days being summed
        and (select count(*) from counted k where k.day between c.blk_from and c.blk_to) = 3
        and not exists (
              select 1 from public.day_prices x
              where x.chalet_id = p_chalet_id and x.day between c.blk_from and c.blk_to
            )
      ) as in_whole_block
    from counted c
    left join public.day_prices dp
      on dp.chalet_id = p_chalet_id and dp.day = c.day
  )
  select coalesce(sum(
    case
      -- The Thursday carries the price of all three days of its weekend.
      when p.in_whole_block and p.dow = 4 then r.weekend
      when p.in_whole_block               then 0
      else coalesce(p.custom_price, public.default_day_rate(p.day, r))
    end
  ), 0)
  from priced p cross join v_rates r;
$$;

-- ---------------------------------------------------------------- quote_stay

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

-- ------------------------------------------------------------ request_booking
--
-- Identical to the previous definition but for the weekend check, which goes
-- directly after the minimum-stay check: both are about the shape of the
-- range, and a guest who has asked for something impossible should be told
-- that before being asked about guests, names and Civil IDs.

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

  -- Thu-Sat is one product. A range that takes part of a weekend is refused
  -- rather than quietly repriced, because there is no honest price for half
  -- of something sold whole.
  if not public.weekend_is_whole(p_start, p_end) then
    raise exception 'A weekend is booked Thursday to Saturday. Please include all three days.'
      using errcode = 'P0001';
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


-- --------------------------------------------------------------------- grants

revoke all on function public.quote_stay(smallint, date, date) from public;
revoke all on function public.sum_stay_days(smallint, date, date, date, date) from public;
revoke all on function public.request_booking(
  smallint, date, date, text, text, text, smallint, text, text, boolean, text) from public;

grant execute on function public.quote_stay(smallint, date, date)    to anon, authenticated;
grant execute on function public.weekend_is_whole(date, date)        to anon, authenticated;
grant execute on function public.sum_stay_days(smallint, date, date, date, date)
  to anon, authenticated;
grant execute on function public.request_booking(
  smallint, date, date, text, text, text, smallint, text, text, boolean, text)
  to anon, authenticated;
