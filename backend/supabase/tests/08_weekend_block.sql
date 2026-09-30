\set ON_ERROR_STOP on
create or replace function pg_temp.ok(label text, cond boolean, detail text default '')
returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %  %', label, detail;
  else raise exception 'FAIL  %  %', label, detail; end if;
end $$;

-- Thu-Sat is one product at rates.weekend; Sun-Wed is sold by the day at
-- rates.daily_weekday. October 2026: 4th is a Sunday, so 8th-10th is a
-- Thu-Sat and 11th-17th a full Sun-Sat week.

-- ===================================== what may be booked at all ============
do $$
begin
  perform pg_temp.ok('A weekday stay is whole by definition',
    public.weekend_is_whole(date '2026-10-04', date '2026-10-07'));
  perform pg_temp.ok('One weekday is too',
    public.weekend_is_whole(date '2026-10-05', date '2026-10-05'));
  perform pg_temp.ok('A whole Thu-Sat is whole',
    public.weekend_is_whole(date '2026-10-08', date '2026-10-10'));
  perform pg_temp.ok('So is a week that contains one',
    public.weekend_is_whole(date '2026-10-11', date '2026-10-17'));

  perform pg_temp.ok('A lone Friday is not',
    not public.weekend_is_whole(date '2026-10-09', date '2026-10-09'));
  perform pg_temp.ok('Nor a lone Thursday',
    not public.weekend_is_whole(date '2026-10-08', date '2026-10-08'));
  perform pg_temp.ok('Nor Thu-Fri, stopping before the Saturday',
    not public.weekend_is_whole(date '2026-10-08', date '2026-10-09'));
  perform pg_temp.ok('Nor Fri-Sat, starting after the Thursday',
    not public.weekend_is_whole(date '2026-10-09', date '2026-10-10'));
  perform pg_temp.ok('Nor a weekday stay that runs into the Thursday',
    not public.weekend_is_whole(date '2026-10-04', date '2026-10-08'));
  -- Sun 11 - Fri 16 reaches the second weekend without finishing it.
  perform pg_temp.ok('Nor a long stay that stops mid-weekend',
    not public.weekend_is_whole(date '2026-10-11', date '2026-10-16'));
  -- Sat 10 is the tail of the weekend that began on Thu 8, outside the range.
  perform pg_temp.ok('Nor one that begins on the Saturday',
    not public.weekend_is_whole(date '2026-10-10', date '2026-10-14'));
end $$;

-- ===================================== what it costs ========================
do $$
declare q record;
begin
  select * into q from public.quote_stay(1::smallint, date '2026-10-07', date '2026-10-10');
  perform pg_temp.ok('Wed-Sat = 75 + one weekend, not four daily rates',
    q.total = 425, format('got %s', q.total));

  select * into q from public.quote_stay(1::smallint, date '2026-10-05', date '2026-10-10');
  perform pg_temp.ok('Mon-Sat = 3x75 + 350',
    q.total = 575, format('got %s', q.total));

  -- Two weekends in one range: Thu 8-Sat 10 and Thu 15-Sat 17.
  select * into q from public.quote_stay(1::smallint, date '2026-10-08', date '2026-10-17');
  perform pg_temp.ok('Two weekends are two weekend rates, not six nights',
    q.total = 350 + 4 * 75 + 350, format('got %s', q.total));

  -- The package is more specific than the sum, and cheaper.
  select * into q from public.quote_stay(1::smallint, date '2026-10-11', date '2026-10-17');
  perform pg_temp.ok('Sun-Sat is still the full week, not 300 + 350',
    q.total = 600 and q.package_key = 'fullWeek', format('got %s/%s', q.total, q.package_key));

  -- A range the rule forbids still has to quote honestly: the calendar prices
  -- what a guest is dragging over before it knows whether they will stop.
  select * into q from public.quote_stay(1::smallint, date '2026-10-08', date '2026-10-09');
  perform pg_temp.ok('A half weekend quotes as daily rates, not as a weekend',
    q.total = 240, format('got %s', q.total));
end $$;

-- A custom price inside a weekend breaks the block back to daily rates, the
-- same way it suppresses a package: an override is never masked by a flat rate.
insert into public.day_prices (chalet_id, day, price) values (1, '2026-10-09', 500);
do $$
declare q record;
begin
  select * into q from public.quote_stay(1::smallint, date '2026-10-08', date '2026-10-10');
  perform pg_temp.ok('A priced Friday is charged, not swallowed by the block',
    q.total = 120 + 500 + 120 and q.has_custom, format('got %s', q.total));

  -- The weekend a week later is untouched by it.
  select * into q from public.quote_stay(1::smallint, date '2026-10-15', date '2026-10-17');
  perform pg_temp.ok('…and the next weekend still costs one weekend rate',
    q.total = 350, format('got %s', q.total));
end $$;
delete from public.day_prices where chalet_id = 1 and day = '2026-10-09';

-- ===================================== and what the RPC does ================
do $$
declare b public.bookings;
begin
  begin
    b := public.request_booking(1::smallint, date '2026-11-06', date '2026-11-06',
          'Half Weekend', '+96590000001', 'half@example.com', 2::smallint,
          null, 'ids/half.jpg', true);
    perform pg_temp.ok('The RPC refuses a lone Friday', false, 'it was accepted');
  exception when others then
    perform pg_temp.ok('The RPC refuses a lone Friday',
      sqlerrm like '%Thursday to Saturday%', sqlerrm);
  end;

  -- Thu 5 - Sat 7 November 2026, the whole thing.
  b := public.request_booking(1::smallint, date '2026-11-05', date '2026-11-07',
        'Whole Weekend', '+96590000002', 'whole@example.com', 2::smallint,
        null, 'ids/whole.jpg', true);
  perform pg_temp.ok('…and takes the whole weekend',
    b.total = 350 and b.package_key = 'weekend', format('got %s/%s', b.total, b.package_key));

  -- One weekday, which is the other half of the policy.
  b := public.request_booking(1::smallint, date '2026-11-09', date '2026-11-09',
        'One Night', '+96590000003', 'one@example.com', 2::smallint,
        null, 'ids/one.jpg', true);
  perform pg_temp.ok('A single weekday is still a booking, at the daily rate',
    b.total = 75, format('got %s', b.total));
end $$;
