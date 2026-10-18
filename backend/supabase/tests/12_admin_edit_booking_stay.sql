\set ON_ERROR_STOP on
create or replace function pg_temp.ok(label text, cond boolean, detail text default '')
returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %  %', label, detail;
  else raise exception 'FAIL  %  %', label, detail; end if;
end $$;

-- Moving a booking from the dashboard. Today is pinned to Wed 30 Sep 2026.
-- April 2027 on both chalets is untouched by earlier suites; 4 Apr 2027 is a
-- Sunday, so 4-7 is a Sun-Wed (weekday package, 300) and 8-10 a Thu-Sat.

create or replace function pg_temp.try_move(p_id uuid, p_chalet smallint, p_start date,
  p_end date, p_reprice boolean default false)
returns text language plpgsql as $$
begin
  perform public.admin_update_booking(p_id, p_chalet, p_start, p_end, p_reprice);
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
grant execute on function pg_temp.try_move(uuid, smallint, date, date, boolean)
  to anon, authenticated;

do $$
begin
  perform pg_temp.ok('The browser''s anonymous key cannot reach it',
    not has_function_privilege('anon',
      'public.admin_update_booking(uuid,smallint,date,date,boolean)', 'execute'));
end $$;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- Two accepted stays on chalet 1, one pending on chalet 2.
select (public.admin_create_booking(1::smallint, '2027-04-04', '2027-04-07', 'Mover',
  '96590005555', 'mover@example.com', 2::smallint, 'accepted', 280)).id as mover
\gset
select (public.admin_create_booking(1::smallint, '2027-04-11', '2027-04-14', 'Neighbour',
  '96590006666', 'neighbour@example.com', 2::smallint, 'accepted')).id as neighbour
\gset
select (public.admin_create_booking(2::smallint, '2027-04-18', '2027-04-19', 'Waiting',
  '96590007777', 'waiting@example.com', 2::smallint)).id as waiting
\gset
set my.mover = :'mover';
set my.neighbour = :'neighbour';
set my.waiting = :'waiting';

do $$
declare b public.bookings; e text; v uuid := current_setting('my.mover')::uuid; n integer;
begin
  -- A move that keeps the price.
  b := public.admin_update_booking(v, 1::smallint, '2027-04-08', '2027-04-10');
  perform pg_temp.ok('An accepted booking moves to free dates',
    b.start_date = '2027-04-08' and b.end_date = '2027-04-10' and b.days = 3,
    format('%s → %s', b.start_date, b.end_date));
  perform pg_temp.ok('…keeping its reference and its status', b.ref like 'BZR-%' and b.status = 'accepted');
  perform pg_temp.ok('…and its price, unless asked to reprice', b.total = 280, b.total::text);

  -- And one that prices the new dates.
  b := public.admin_update_booking(v, 1::smallint, '2027-04-04', '2027-04-07', true);
  perform pg_temp.ok('Repricing charges the new dates from the rates',
    b.total = 300 and b.package_key = 'weekday', format('%s %s', b.total, b.package_key));

  -- The other chalet.
  b := public.admin_update_booking(v, 2::smallint, '2027-04-04', '2027-04-07');
  perform pg_temp.ok('A booking can move to the other chalet', b.chalet_id = 2);
  b := public.admin_update_booking(v, 1::smallint, '2027-04-04', '2027-04-07');

  -- What an accepted booking may not land on.
  e := pg_temp.try_move(v, 1::smallint, '2027-04-13', '2027-04-15');
  perform pg_temp.ok('Not on another accepted stay', e like '%already held by booking%', e);
  insert into public.blocked_dates (chalet_id, day) values (1, '2027-04-25');
  e := pg_temp.try_move(v, 1::smallint, '2027-04-25', '2027-04-26');
  perform pg_temp.ok('Not on a day marked unavailable', e like '%marked unavailable%', e);

  -- A pending booking holds nothing, so it may.
  e := pg_temp.try_move(current_setting('my.waiting')::uuid, 1::smallint, '2027-04-13', '2027-04-13');
  perform pg_temp.ok('A pending booking may be moved over a stay', e = 'ok', e);

  -- The shape of the range.
  e := pg_temp.try_move(v, 1::smallint, '2027-04-07', '2027-04-04');
  perform pg_temp.ok('A reversed range is refused', e like '%on or after the check-in%', e);
  e := pg_temp.try_move(v, 1::smallint, '2027-04-01', '2027-08-01');
  perform pg_temp.ok('A stay longer than 90 days is refused', e like '%at most 90 days%', e);
  e := pg_temp.try_move(v, 9::smallint, '2027-04-04', '2027-04-07');
  perform pg_temp.ok('An unknown chalet is refused', e like '%Unknown chalet%', e);
  e := pg_temp.try_move(gen_random_uuid(), 1::smallint, '2027-04-04', '2027-04-07');
  perform pg_temp.ok('A booking that does not exist is refused', e like '%not found%', e);

  -- Correcting a stay that has already happened.
  e := pg_temp.try_move(current_setting('my.waiting')::uuid, 2::smallint, '2026-09-01', '2026-09-02');
  perform pg_temp.ok('Past dates are allowed, to correct the record', e = 'ok', e);

  -- The activity log says where it moved from.
  select count(*) into n from public.audit_log a
   where a.action = 'booking.edited'
     and a.entity_id = (select ref from public.bookings where id = v)
     and a.detail ? 'start_date' and a.detail ? 'end_date';
  perform pg_temp.ok('Each change of dates is in the activity log, old and new', n = 2, format('%s entries', n));
  select count(*) into n from public.audit_log a
   where a.action = 'booking.edited'
     and a.entity_id = (select ref from public.bookings where id = v)
     and a.detail ? 'chalet';
  perform pg_temp.ok('…and each change of chalet', n = 2, format('%s entries', n));
end $$;

do $$
declare n integer; v_ref text;
begin
  update public.bookings set lang = 'ar' where id = current_setting('my.neighbour')::uuid
  returning ref into v_ref;
  select count(*) into n from public.audit_log
   where action = 'booking.edited' and entity_id = v_ref and detail ? 'lang';
  perform pg_temp.ok('A change of email language is logged too', n = 1, format('%s entries', n));
end $$;
reset role; reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare e text;
begin
  e := pg_temp.try_move(current_setting('my.mover')::uuid, 1::smallint, '2027-04-04', '2027-04-07');
  perform pg_temp.ok('A signed-in non-admin cannot move a booking', e like '%Not authorised%', e);
end $$;
reset role; reset request.jwt.claim.sub;
