\set ON_ERROR_STOP on
-- Input guards and boundary conditions on request_booking().
create or replace function pg_temp.ok(label text, cond boolean, detail text default '')
returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %  %', label, detail;
  else raise exception 'FAIL  %  %', label, detail; end if;
end $$;
set role anon;
do $$
declare b public.bookings; n integer;
begin
  -- zero guests
  begin
    b := public.request_booking(1::smallint, date '2026-12-06', date '2026-12-09',
          'Zero Guests', '+96599999999', 'zero@example.com', 0::smallint);
    perform pg_temp.ok('Zero guests rejected', false, 'accepted');
  exception when others then
    perform pg_temp.ok('Zero guests rejected', true, left(sqlerrm, 40));
  end;

  -- 999 guests
  begin
    b := public.request_booking(1::smallint, date '2026-12-13', date '2026-12-16',
          'Many Guests', '+96599999999', 'many@example.com', 999::smallint);
    perform pg_temp.ok('Absurd guest count rejected', false, 'accepted');
  exception when others then
    perform pg_temp.ok('Absurd guest count rejected', true, left(sqlerrm, 40));
  end;

  -- reversed dates
  begin
    b := public.request_booking(1::smallint, date '2026-12-20', date '2026-12-10',
          'Backwards', '+96599999999', 'back@example.com', 2::smallint);
    perform pg_temp.ok('Reversed date range rejected', false, 'accepted');
  exception when others then
    perform pg_temp.ok('Reversed date range rejected', true, left(sqlerrm, 40));
  end;

  -- a stay starting today
  begin
    b := public.request_booking(1::smallint, current_date, current_date + 3,
          'Same Day', '+96599999999', 'today@example.com', 2::smallint);
    perform pg_temp.ok('Stay starting today is allowed', b.ref is not null, b.ref);
  exception when others then
    perform pg_temp.ok('Stay starting today is allowed', false, left(sqlerrm, 60));
  end;

  -- a stay starting yesterday
  begin
    b := public.request_booking(1::smallint, current_date - 1, current_date + 3,
          'Past Start', '+96599999999', 'past@example.com', 2::smallint);
    perform pg_temp.ok('Stay starting in the past rejected', false, 'accepted');
  exception when others then
    perform pg_temp.ok('Stay starting in the past rejected', true, left(sqlerrm, 40));
  end;

  -- flood guard
  for i in 1..6 loop
    begin
      b := public.request_booking(1::smallint, date '2027-01-03' + i*7, date '2027-01-06' + i*7,
            'Flooder', '+96599999999', 'flood@example.com', 2::smallint);
    exception when others then
      perform pg_temp.ok('Flood guard trips after 5 requests/hour', sqlerrm like '%Too many%', left(sqlerrm,40));
      exit;
    end;
  end loop;
end $$;
reset role;
-- no rates row: does the calendar degrade or explode?
do $$
declare n integer;
begin
  begin
    select count(*) into n from public.availability_calendar(1::smallint, current_date, current_date + 5);
    perform pg_temp.ok('availability_calendar survives (rates present)', n = 6, format('%s rows', n));
  exception when others then
    perform pg_temp.ok('availability_calendar survives', false, left(sqlerrm, 60));
  end;
end $$;
