\set ON_ERROR_STOP on
create or replace function pg_temp.ok(label text, cond boolean, detail text default '')
returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %  %', label, detail;
  else raise exception 'FAIL  %  %', label, detail; end if;
end $$;

-- fixtures ------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@almailgroup.com'),
  ('22222222-2222-2222-2222-222222222222', 'random@example.com')
on conflict do nothing;
insert into public.admins (user_id, email)
  values ('11111111-1111-1111-1111-111111111111', 'admin@almailgroup.com')
on conflict do nothing;

-- ============================ pricing =======================================
do $$
declare q record;
begin
  select * into q from public.quote_stay(1::smallint, date '2026-10-04', date '2026-10-07');
  perform pg_temp.ok('Sun-Wed (4d) = 300 weekday package',
    q.total = 300 and q.package_key = 'weekday' and q.days = 4, format('got %s/%s', q.total, q.package_key));

  select * into q from public.quote_stay(1::smallint, date '2026-10-08', date '2026-10-10');
  perform pg_temp.ok('Thu-Sat (3d) = 350 weekend package',
    q.total = 350 and q.package_key = 'weekend', format('got %s/%s', q.total, q.package_key));

  select * into q from public.quote_stay(1::smallint, date '2026-10-11', date '2026-10-17');
  perform pg_temp.ok('Sun-Sat (7d) = 600 full week',
    q.total = 600 and q.package_key = 'fullWeek', format('got %s/%s', q.total, q.package_key));

  select * into q from public.quote_stay(1::smallint, date '2026-10-05', date '2026-10-07');
  perform pg_temp.ok('Mon-Wed (3d, no package) = 3x75 = 225',
    q.total = 225 and q.package_key is null, format('got %s', q.total));
end $$;

-- custom price overrides the flat package rate
insert into public.day_prices (chalet_id, day, price) values (1, '2026-10-05', 200);
do $$
declare q record;
begin
  select * into q from public.quote_stay(1::smallint, date '2026-10-04', date '2026-10-07');
  -- 75 + 200 + 75 + 75, and the package rate must NOT apply
  perform pg_temp.ok('Custom day price beats the package rate',
    q.total = 425 and q.package_key is null and q.has_custom, format('got %s/%s', q.total, q.package_key));
end $$;
delete from public.day_prices where day = '2026-10-05';

-- =================== special occasions (Eid etc) ============================
-- 2027-05-13..15 is a Thu-Sat, which would normally price as the 350 weekend
-- package; as an occasion it is a flat 900.
insert into public.special_occasions (name_en, name_ar, start_date, end_date, price)
  values ('Eid Test', 'عيد', '2027-05-13', '2027-05-15', 900);
do $$
declare q record;
begin
  select * into q from public.quote_stay(1::smallint, date '2027-05-13', date '2027-05-15');
  perform pg_temp.ok('Occasion Thu-Sat = 900, not the 350 weekend rate',
    q.total = 900 and q.package_key = 'special', format('got %s/%s', q.total, q.package_key));
  perform pg_temp.ok('Occasion name is returned for the UI',
    q.occasion = 'Eid Test', coalesce(q.occasion, 'null'));

  -- Wed-Sat: the occasion window plus one weekday night at the per-day rate.
  select * into q from public.quote_stay(1::smallint, date '2027-05-12', date '2027-05-15');
  perform pg_temp.ok('Days outside the occasion are added at the per-day rate',
    q.total = 975, format('got %s (expected 900 + 75)', q.total));

  -- An identical Thu-Sat a week later is untouched by the occasion.
  select * into q from public.quote_stay(1::smallint, date '2027-05-20', date '2027-05-22');
  perform pg_temp.ok('A Thu-Sat outside the window still costs 350',
    q.total = 350 and q.package_key = 'weekend', format('got %s/%s', q.total, q.package_key));
end $$;

-- A custom day price is more specific than the occasion and still wins.
insert into public.day_prices (chalet_id, day, price) values (1, '2027-05-13', 50);
do $$
declare q record;
begin
  select * into q from public.quote_stay(1::smallint, date '2027-05-13', date '2027-05-15');
  perform pg_temp.ok('Custom day price still beats an occasion',
    q.total = 290 and q.has_custom and q.package_key is null, format('got %s', q.total));
end $$;
delete from public.day_prices where day = '2027-05-13';

-- Two active occasions may not cover the same day.
do $$
begin
  begin
    insert into public.special_occasions (name_en, start_date, end_date, price)
      values ('Clashing', '2027-05-14', '2027-05-16', 800);
    perform pg_temp.ok('Overlapping active occasions are refused', false, 'accepted');
  exception when exclusion_violation then
    perform pg_temp.ok('Overlapping active occasions are refused', true, '');
  end;
end $$;

-- Deactivating one frees the window again.
update public.special_occasions set active = false where name_en = 'Eid Test';
do $$
declare q record;
begin
  select * into q from public.quote_stay(1::smallint, date '2027-05-13', date '2027-05-15');
  perform pg_temp.ok('An inactive occasion does not price anything',
    q.total = 350 and q.package_key = 'weekend', format('got %s/%s', q.total, q.package_key));
end $$;
delete from public.special_occasions where name_en = 'Eid Test';

-- ======================== availability ======================================
insert into public.blocked_dates (chalet_id, day) values (1, '2026-10-06');
do $$
begin
  perform pg_temp.ok('Range spanning a blocked day is unavailable',
    not public.is_range_available(1::smallint, date '2026-10-04', date '2026-10-07'));
  perform pg_temp.ok('Clear range is available',
    public.is_range_available(1::smallint, date '2026-10-11', date '2026-10-17'));
  perform pg_temp.ok('Past range is unavailable',
    not public.is_range_available(1::smallint, current_date - 5, current_date - 1));
  perform pg_temp.ok('Blocking chalet 1 does not block chalet 2',
    public.is_range_available(2::smallint, date '2026-10-04', date '2026-10-07'));
end $$;
delete from public.blocked_dates where day = '2026-10-06';

do $$
declare n integer; blocked integer;
begin
  select count(*), count(*) filter (where c.blocked)
    into n, blocked
  from public.availability_calendar(1::smallint, date '2026-10-01', date '2026-10-31') c;
  perform pg_temp.ok('availability_calendar returns one row per day', n = 31, format('%s rows', n));
end $$;

do $$
begin
  begin
    perform public.availability_calendar(1::smallint, date '2026-01-01', date '2030-01-01');
    perform pg_temp.ok('Oversized calendar range rejected', false);
  exception when others then
    perform pg_temp.ok('Oversized calendar range rejected', sqlerrm like '%too large%', sqlerrm);
  end;
end $$;
