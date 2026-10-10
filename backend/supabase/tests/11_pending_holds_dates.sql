\set ON_ERROR_STOP on
create or replace function pg_temp.ok(label text, cond boolean, detail text default '')
returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %  %', label, detail;
  else raise exception 'FAIL  %  %', label, detail; end if;
end $$;

-- A pending request holds its dates. Today is pinned to Wed 30 Sep 2026.
-- March 2027 on chalet 2 is untouched by earlier suites; 7 Mar 2027 is a
-- Sunday, so 7-10 is a Sun-Wed and 11-13 the Thu-Sat after it.
update public.settings set value = 'false'::jsonb where key = 'require_email_verification';

create or replace function pg_temp.ask(p_start date, p_end date, p_email text)
returns text language plpgsql as $$
begin
  perform public.request_booking(2::smallint, p_start, p_end, 'Guest', '+96551113333',
    p_email, 2::smallint, null, 'ids/held.jpg', true, 'en');
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
grant execute on function pg_temp.ask(date, date, text) to anon;

create or replace function pg_temp.day(p_day date)
returns record language sql as $$
  select (c.blocked, c.pending)
  from public.availability_calendar(2::smallint, p_day, p_day) c;
$$;

-- =============================================== the first request ==========
set role anon;
do $$
declare e text;
begin
  e := pg_temp.ask('2027-03-07', '2027-03-10', 'first@example.com');
  perform pg_temp.ok('A guest asks for Sun-Wed', e = 'ok', e);
end $$;

do $$
declare b boolean; p boolean;
begin
  select c.blocked, c.pending into b, p from public.availability_calendar(2::smallint, '2027-03-08', '2027-03-08') c;
  perform pg_temp.ok('Its days are blocked for everyone else', b);
  perform pg_temp.ok('…and marked pending, so the page draws them grey', p);
  select c.blocked, c.pending into b, p from public.availability_calendar(2::smallint, '2027-03-11', '2027-03-11') c;
  perform pg_temp.ok('The day after is still free', not b and not p);
  perform pg_temp.ok('The range is no longer available',
    not public.is_range_available(2::smallint, '2027-03-07', '2027-03-10'));
  perform pg_temp.ok('…nor any range that overlaps it',
    not public.is_range_available(2::smallint, '2027-03-10', '2027-03-10'));
end $$;

-- =============================================== a second guest =============
do $$
declare e text;
begin
  e := pg_temp.ask('2027-03-07', '2027-03-10', 'second@example.com');
  perform pg_temp.ok('A second guest cannot ask for the same days', e like '%no longer available%', e);
  e := pg_temp.ask('2027-03-10', '2027-03-10', 'second@example.com');
  perform pg_temp.ok('…nor for one day of them', e like '%no longer available%', e);
  e := pg_temp.ask('2027-03-11', '2027-03-13', 'second@example.com');
  perform pg_temp.ok('…but can have the weekend straight after', e = 'ok', e);
end $$;
reset role;

-- ========================================== the guard on the row itself =====
-- Past the RPC's own check: the trigger is what stops two simultaneous
-- requests both getting through it.
do $$
begin
  begin
    insert into public.bookings (ref, chalet_id, start_date, end_date, total,
      guest_name, guest_phone, guest_email, guests, status)
    values ('BZR-RACE01', 2, '2027-03-09', '2027-03-09', 75,
            'Racer', '+96551114444', 'race@example.com', 2, 'pending');
    perform pg_temp.ok('A guest row that overlaps a request is refused at the table', false, 'inserted');
  exception when others then
    perform pg_temp.ok('A guest row that overlaps a request is refused at the table',
      sqlerrm like '%no longer available%', sqlerrm);
  end;
end $$;

-- ================================================= the admin =================
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
declare b public.bookings;
begin
  -- The owner may still record a booking over a request they mean to decline.
  b := public.admin_create_booking(2::smallint, '2027-03-08', '2027-03-09',
    'Phone Guest', '96590004444', 'phone-held@example.com', 2::smallint);
  perform pg_temp.ok('The admin may still enter a booking over a pending request', b.status = 'pending');
  delete from public.bookings where id = b.id;
end $$;

do $$
declare v_id uuid; b boolean; p boolean;
begin
  -- Declined: the days are free again.
  select id into v_id from public.bookings where guest_email = 'first@example.com';
  perform public.set_booking_status(v_id, 'rejected');
  select c.blocked, c.pending into b, p from public.availability_calendar(2::smallint, '2027-03-08', '2027-03-08') c;
  perform pg_temp.ok('Rejecting the request frees its days', not b and not p);
  perform pg_temp.ok('…for a range check too',
    public.is_range_available(2::smallint, '2027-03-07', '2027-03-10'));

  -- Accepted: reserved, which is black, not grey.
  select id into v_id from public.bookings where guest_email = 'second@example.com';
  perform public.set_booking_status(v_id, 'accepted');
  select c.blocked, c.pending into b, p from public.availability_calendar(2::smallint, '2027-03-12', '2027-03-12') c;
  perform pg_temp.ok('Accepting a request makes its days reserved, not pending', b and not p);

  -- Cancelled: free again.
  perform public.set_booking_status(v_id, 'cancelled');
  select c.blocked, c.pending into b, p from public.availability_calendar(2::smallint, '2027-03-12', '2027-03-12') c;
  perform pg_temp.ok('Cancelling it frees them', not b and not p);
end $$;
reset role; reset request.jwt.claim.sub;

-- A day both closed by the admin and requested reads as closed (black): the
-- firmer reason wins.
insert into public.blocked_dates (chalet_id, day) values (2, '2027-03-21');
insert into public.bookings (ref, chalet_id, start_date, end_date, total,
  guest_name, guest_phone, guest_email, guests, status, source)
values ('BZR-OVER01', 2, '2027-03-21', '2027-03-22', 150,
        'Admin Override', '+96551115555', 'override@example.com', 2, 'pending', 'admin');
do $$
declare b boolean; p boolean;
begin
  select c.blocked, c.pending into b, p from public.availability_calendar(2::smallint, '2027-03-21', '2027-03-21') c;
  perform pg_temp.ok('A closed day under a request reads as closed, not pending', b and not p);
  select c.blocked, c.pending into b, p from public.availability_calendar(2::smallint, '2027-03-22', '2027-03-22') c;
  perform pg_temp.ok('…and the open day beside it as pending', b and p);
end $$;

do $$
begin
  perform pg_temp.ok('Guests can still read the calendar',
    has_function_privilege('anon', 'public.availability_calendar(smallint,date,date)', 'execute'));
  perform pg_temp.ok('…but not call the guard',
    not has_function_privilege('anon', 'public.guard_guest_overlap()', 'execute'));
end $$;
