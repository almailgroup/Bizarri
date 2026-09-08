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
create or replace function public.quote_stay(
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
