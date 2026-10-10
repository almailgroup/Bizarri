-- ============================================================================
-- Part 14 of 16: kuwait_today
--
-- Paste this whole file into the Supabase SQL editor and Run, then move on
-- to the next part. Run them in order; each one is safe to run twice.
-- ============================================================================

-- ============================================================================
-- "Today" is Kuwait's today, not the database server's.
--
-- Supabase runs Postgres in UTC, three hours behind Kuwait, and the two
-- functions that decide what is in the past used current_date. So from
-- midnight to 3 AM in Kuwait every night, the server still thought it was the
-- day before: the calendar offered the day that had just ended, and
-- request_booking accepted a stay starting on it. A guest in Kuwait never saw
-- it -- their own calendar hides yesterday -- but anyone whose browser runs
-- behind Kuwait, or anything calling the API directly, could book a day that
-- was already over.
--
-- local_today() is now the one definition of "today" for bookings. It takes
-- the moment as an argument, defaulting to now(), so it can be tested at a
-- known instant, and the test suite pins it to a fixed date so fixtures
-- written for the autumn of 2026 do not expire as the calendar moves on.
-- ============================================================================

create or replace function public.local_today(p_at timestamptz default now())
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  select (p_at at time zone 'Asia/Kuwait')::date;
$$;

comment on function public.local_today(timestamptz) is
  'The calendar date in Kuwait at p_at (default: now). The booking rules'' "today".';

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
    p_start >= public.local_today()
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
 * what does it cost. Past days -- in Kuwait -- are blocked.
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
      d::date < public.local_today()
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

-- It reads the clock and nothing else, so anyone may ask it -- and a function
-- added later that is not security definer can use it without a grant of its
-- own going missing.
grant execute on function public.local_today(timestamptz) to anon, authenticated;
