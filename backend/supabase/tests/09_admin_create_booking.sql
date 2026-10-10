\set ON_ERROR_STOP on
create or replace function pg_temp.ok(label text, cond boolean, detail text default '')
returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %  %', label, detail;
  else raise exception 'FAIL  %  %', label, detail; end if;
end $$;

-- Bookings an admin types in from the dashboard. Today is pinned to Wed 30
-- September 2026; December 2026 on chalet 2 is untouched by earlier suites.
-- 6 Dec 2026 is a Sunday.

-- Calls the function and returns the error text, or 'ok'.
create or replace function pg_temp.try_create(
  p_chalet smallint, p_start date, p_end date,
  p_name text default 'Walk-in Guest', p_phone text default '+96599990000',
  p_email text default 'walkin@example.com', p_guests smallint default 2,
  p_status public.booking_status default 'pending', p_total numeric default null)
returns text language plpgsql as $$
begin
  perform public.admin_create_booking(p_chalet, p_start, p_end, p_name, p_phone,
    p_email, p_guests, p_status, p_total);
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
grant execute on function pg_temp.try_create(smallint, date, date, text, text, text,
  smallint, public.booking_status, numeric) to anon, authenticated;

-- ================================================== who may call it =========
do $$
begin
  perform pg_temp.ok('The browser''s anonymous key cannot reach it',
    not has_function_privilege('anon',
      'public.admin_create_booking(smallint,date,date,text,text,text,smallint,public.booking_status,numeric,text,text,text,boolean)',
      'execute'));
  perform pg_temp.ok('A signed-in user can, and the function decides',
    has_function_privilege('authenticated',
      'public.admin_create_booking(smallint,date,date,text,text,text,smallint,public.booking_status,numeric,text,text,text,boolean)',
      'execute'));
end $$;

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare e text;
begin
  e := pg_temp.try_create(2::smallint, '2026-12-06', '2026-12-09');
  perform pg_temp.ok('A signed-in non-admin is refused', e like '%Not authorised%', e);
end $$;
reset role; reset request.jwt.claim.sub;

-- ======================================================= the admin ==========
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare b public.bookings;
begin
  b := public.admin_create_booking(2::smallint, '2026-12-06', '2026-12-09',
    '  Walk-in Guest  ', '+965 9999 0000', '  WalkIn@Example.com ', 3::smallint);
  perform pg_temp.ok('A pending booking is created', b.status = 'pending', b.ref);
  perform pg_temp.ok('…with a real reference', b.ref ~ '^BZR-[A-Z0-9]{6}$', b.ref);
  perform pg_temp.ok('…priced by the server: Sun-Wed is the weekday package',
    b.total = 300 and b.package_key = 'weekday', format('%s %s', b.total, b.package_key));
  perform pg_temp.ok('…marked as the admin''s, not a guest''s', b.source = 'admin', b.source);
  perform pg_temp.ok('…emailing the guest unless told not to', b.notify_guest);
  perform pg_temp.ok('…with the details tidied like a guest''s',
    b.guest_name = 'Walk-in Guest' and b.guest_email = 'walkin@example.com',
    format('%s / %s', b.guest_name, b.guest_email));
  perform pg_temp.ok('…and not stamped as decided', b.decided_at is null and b.decided_by is null);
end $$;

do $$
declare b public.bookings;
begin
  b := public.admin_create_booking(2::smallint, '2026-12-13', '2026-12-15',
    'Phone Booking', '96590001111', 'phone@example.com', 6::smallint,
    'accepted', 250, 'Arrives late', 'Paid cash deposit', 'ar', false);
  perform pg_temp.ok('An accepted booking is created', b.status = 'accepted');
  perform pg_temp.ok('…and stamped with who decided and when',
    b.decided_at is not null and b.decided_by = '11111111-1111-1111-1111-111111111111');
  perform pg_temp.ok('A total the admin types is kept as given', b.total = 250, b.total::text);
  perform pg_temp.ok('Notes, internal note and language are stored',
    b.notes = 'Arrives late' and b.admin_note = 'Paid cash deposit' and b.lang = 'ar');
  perform pg_temp.ok('"Do not email the guest" is stored', not b.notify_guest);
end $$;

do $$
declare e text;
begin
  e := pg_temp.try_create(2::smallint, '2026-12-14', '2026-12-16', p_status => 'accepted');
  perform pg_temp.ok('An accepted booking cannot overlap another accepted one',
    e like '%already held by booking BZR-%', e);
  e := pg_temp.try_create(2::smallint, '2026-12-14', '2026-12-16');
  perform pg_temp.ok('…but a pending one may, as guests'' requests can', e = 'ok', e);
end $$;

-- A day the admin closed.
insert into public.blocked_dates (chalet_id, day) values (2, '2026-12-21');
do $$
declare e text;
begin
  e := pg_temp.try_create(2::smallint, '2026-12-20', '2026-12-22', p_status => 'accepted');
  perform pg_temp.ok('An accepted booking may not cross a day marked unavailable',
    e like '%marked unavailable%' and e like '%21 Dec 2026%', e);
  e := pg_temp.try_create(2::smallint, '2026-12-20', '2026-12-22');
  perform pg_temp.ok('…a pending one may, since it holds nothing', e = 'ok', e);
end $$;

-- The admin may make the exceptions a guest cannot.
do $$
declare b public.bookings;
begin
  b := public.admin_create_booking(2::smallint, '2026-12-11', '2026-12-11',
    'Friday Only', '96590002222', 'friday@example.com', 2::smallint);
  perform pg_temp.ok('An admin may book a lone Friday, which a guest cannot',
    b.days = 1, format('%s day(s)', b.days));
  perform pg_temp.ok('…priced at the daily weekend rate', b.total = 120, b.total::text);
end $$;

-- ================================================ what it refuses ===========
do $$
declare e text;
begin
  e := pg_temp.try_create(2::smallint, '2026-09-29', '2026-10-01');
  perform pg_temp.ok('A check-in in the past', e like '%in the past%', e);
  e := pg_temp.try_create(2::smallint, '2026-12-09', '2026-12-06');
  perform pg_temp.ok('A reversed range', e like '%on or after the check-in%', e);
  e := pg_temp.try_create(2::smallint, null, '2026-12-06');
  perform pg_temp.ok('No dates', e like '%choose the check-in%', e);
  e := pg_temp.try_create(2::smallint, '2026-12-01', '2027-03-15');
  perform pg_temp.ok('A stay longer than 90 days', e like '%at most 90 days%', e);
  e := pg_temp.try_create(2::smallint, '2026-12-06', '2026-12-07', p_status => 'rejected');
  perform pg_temp.ok('A status other than pending or accepted',
    e like '%only be pending or accepted%', e);
  e := pg_temp.try_create(2::smallint, '2026-12-06', '2026-12-07', p_status => 'cancelled');
  perform pg_temp.ok('…cancelled included', e like '%only be pending or accepted%', e);
  e := pg_temp.try_create(2::smallint, '2026-12-06', '2026-12-07', p_name => 'A');
  perform pg_temp.ok('A one-letter name', e like '%full name%', e);
  e := pg_temp.try_create(2::smallint, '2026-12-06', '2026-12-07', p_phone => '12345');
  perform pg_temp.ok('A phone number too short to be one', e like '%valid phone%', e);
  e := pg_temp.try_create(2::smallint, '2026-12-06', '2026-12-07', p_email => 'not-an-email');
  perform pg_temp.ok('An email address that is not one', e like '%valid email%', e);
  e := pg_temp.try_create(2::smallint, '2026-12-06', '2026-12-07', p_guests => 0::smallint);
  perform pg_temp.ok('No guests', e like '%between 1 and 20%', e);
  e := pg_temp.try_create(2::smallint, '2026-12-06', '2026-12-07', p_guests => 21::smallint);
  perform pg_temp.ok('Too many guests', e like '%between 1 and 20%', e);
  e := pg_temp.try_create(2::smallint, '2026-12-06', '2026-12-07', p_total => -1);
  perform pg_temp.ok('A negative total', e like '%cannot be negative%', e);
  e := pg_temp.try_create(99::smallint, '2026-12-06', '2026-12-07');
  perform pg_temp.ok('A chalet that does not exist', e like '%Unknown chalet%', e);
end $$;

-- ================================================ the paper trail ===========
do $$
declare n integer;
begin
  select count(*) into n from public.audit_log a
  join public.bookings b on b.ref = a.entity_id
  where a.action = 'booking.created' and b.source = 'admin'
    and a.actor = '11111111-1111-1111-1111-111111111111';
  perform pg_temp.ok('Each admin booking is logged against the admin who made it',
    n = (select count(*) from public.bookings where source = 'admin'), format('%s logged', n));
end $$;
reset role; reset request.jwt.claim.sub;

do $$
begin
  perform pg_temp.ok('Guests'' requests are still marked as theirs',
    not exists (select 1 from public.bookings where source = 'admin' and civil_id_path is not null)
    and exists (select 1 from public.bookings where source = 'guest'));
end $$;
