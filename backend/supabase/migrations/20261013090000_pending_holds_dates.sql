-- ============================================================================
-- A pending request holds its dates.
--
-- Until now a request held nothing until the admin accepted it: several
-- guests could ask for the same week and the admin picked one -- a waiting
-- list. The owner wants it the other way round: once a guest has asked for
-- some days, nobody else can, and the calendar shows them as awaiting
-- approval (grey) rather than free. Rejecting or cancelling the request
-- frees them again; accepting turns them reserved (black).
--
-- Three places enforce it, from the calendar to the row:
--
--   availability_calendar()  reports pending days as blocked, and says which
--                            ones are pending, so the page can tell grey from
--                            black. It reveals nothing about who asked.
--   is_range_available()     refuses a range that overlaps a pending request,
--                            so request_booking() says "no longer available".
--   guard_guest_overlap      a trigger on the row itself, taking a lock per
--                            chalet, so two guests pressing Submit in the same
--                            second cannot both get through the check above.
--
-- The admin is not bound by it: a booking entered from the dashboard
-- (source = 'admin') may still overlap a pending request, which is how an
-- owner records a stay agreed by phone over a request they mean to decline.
-- ============================================================================

/** Every day in the range is in the future, unblocked, and not held by a request or a stay. */
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
        and bk.status in ('accepted', 'pending')
        and daterange(bk.start_date, bk.end_date, '[]') && daterange(p_start, p_end, '[]')
    );
$$;

-- The result gains a column, so the function is replaced rather than edited.
drop function if exists public.availability_calendar(smallint, date, date);

/**
 * One call that powers the guest calendar: for each day, is it selectable,
 * is it only awaiting approval, and what does it cost. Past days -- in
 * Kuwait -- are blocked.
 *
 * blocked  the day cannot be chosen: past, closed by the admin, held by an
 *          accepted stay, or held by a pending request.
 * pending  of those, held by a request awaiting the admin (and by nothing
 *          firmer): drawn grey rather than black.
 */
create function public.availability_calendar(
  p_chalet_id smallint,
  p_from      date,
  p_to        date
)
returns table (day date, blocked boolean, price numeric, custom boolean, pending boolean)
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
  with days as (
    select
      d::date as day,
      d::date < public.local_today() as past,
      exists (select 1 from public.blocked_dates b
              where b.chalet_id = p_chalet_id and b.day = d::date) as closed,
      exists (select 1 from public.bookings bk
              where bk.chalet_id = p_chalet_id and bk.status = 'accepted'
                and d::date between bk.start_date and bk.end_date) as reserved,
      exists (select 1 from public.bookings bk
              where bk.chalet_id = p_chalet_id and bk.status = 'pending'
                and d::date between bk.start_date and bk.end_date) as requested
    from generate_series(p_from, p_to, interval '1 day') d
  )
  select
    x.day,
    x.past or x.closed or x.reserved or x.requested,
    coalesce(dp.price, public.default_day_rate(x.day, v_rates)),
    dp.price is not null,
    x.requested and not (x.past or x.closed or x.reserved)
  from days x
  left join public.day_prices dp
    on dp.chalet_id = p_chalet_id and dp.day = x.day
  order by x.day;
end;
$$;

revoke all on function public.availability_calendar(smallint, date, date) from public;
grant execute on function public.availability_calendar(smallint, date, date) to anon, authenticated;

/**
 * The last word on a guest's request: no overlap with another request or a
 * stay, checked under a lock so concurrent Submits are taken one at a time.
 *
 * The lock is per chalet and lasts until the inserting transaction ends; the
 * check runs after it is taken, and a trigger function sees rows committed
 * while it waited, so the second of two simultaneous requests sees the first.
 */
create or replace function public.guard_guest_overlap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- A guest's request is always pending. Accepted rows have the exclusion
  -- constraint of their own, and an admin -- through the dashboard or by hand
  -- -- is trusted to overlap a request on purpose.
  if new.source <> 'guest' or new.status <> 'pending' or public.is_admin() then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('bizarri.bookings'), new.chalet_id);

  if exists (
    select 1 from public.bookings bk
    where bk.chalet_id = new.chalet_id
      and bk.id <> new.id
      and bk.status in ('accepted', 'pending')
      and daterange(bk.start_date, bk.end_date, '[]') && daterange(new.start_date, new.end_date, '[]')
  ) then
    raise exception 'Those dates are no longer available' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_guest_overlap() from public, anon, authenticated;

drop trigger if exists guard_guest_overlap on public.bookings;
create trigger guard_guest_overlap
  before insert on public.bookings
  for each row execute function public.guard_guest_overlap();
