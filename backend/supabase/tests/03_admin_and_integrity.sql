\set ON_ERROR_STOP on
create or replace function pg_temp.ok(label text, cond boolean, detail text default '')
returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %  %', label, detail;
  else raise exception 'FAIL  %  %', label, detail; end if;
end $$;

select b.ref as goodref, b.id::text as goodid
from public.bookings b where b.guest_email = 'aisha@example.com' limit 1
\gset
-- psql does not interpolate inside dollar-quoted blocks, so hand the values
-- to the DO blocks through session settings instead.
set my.goodref = :'goodref';
set my.goodid  = :'goodid';

-- guest lookup, as anon, using a ref obtained out of band (as a guest would)
set role anon;
do $$
declare n integer;
begin
  select count(*) into n from public.lookup_booking(current_setting('my.goodref'), 'wrong@example.com');
  perform pg_temp.ok('Lookup with wrong email returns nothing', n = 0, format('%s', n));
  select count(*) into n from public.lookup_booking(current_setting('my.goodref'), 'AISHA@example.com');
  perform pg_temp.ok('Lookup with correct ref+email works (case-insensitive)', n = 1, format('%s', n));
end $$;
reset role;

-- =============== authenticated but NOT an admin ==============================
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare n integer;
begin
  perform pg_temp.ok('is_admin() false for a normal user', not public.is_admin());
  select count(*) into n from public.bookings;
  perform pg_temp.ok('Non-admin user sees zero bookings (RLS)', n = 0, format('%s rows', n));

  begin
    insert into public.blocked_dates (chalet_id, day) values (1, '2026-12-31');
    perform pg_temp.ok('Non-admin CANNOT block dates', false, 'insert succeeded');
  exception when insufficient_privilege then
    perform pg_temp.ok('Non-admin CANNOT block dates', true, 'RLS denied');
  end;

  begin
    perform public.set_booking_status(current_setting('my.goodid')::uuid, 'accepted');
    perform pg_temp.ok('Non-admin CANNOT accept a booking', false, 'accepted');
  exception when others then
    perform pg_temp.ok('Non-admin CANNOT accept a booking', sqlerrm like '%Not authorised%', sqlerrm);
  end;
end $$;
reset role; reset request.jwt.claim.sub;

-- ========================== admin ============================================
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
declare n integer; b public.bookings;
begin
  perform pg_temp.ok('is_admin() true for the allow-listed user', public.is_admin());
  select count(*) into n from public.bookings;
  perform pg_temp.ok('Admin sees bookings', n >= 1, format('%s rows', n));

  insert into public.blocked_dates (chalet_id, day) values (1, '2026-12-31');
  perform pg_temp.ok('Admin can block a date', true);

  update public.rates set full_week = 650;
  perform pg_temp.ok('Admin can change rates', (select full_week from public.rates) = 650);
  update public.rates set full_week = 600;

  b := public.set_booking_status(current_setting('my.goodid')::uuid, 'accepted', 'confirmed by phone');
  perform pg_temp.ok('Admin can accept a booking', b.status = 'accepted');
  perform pg_temp.ok('Decision is stamped', b.decided_at is not null and b.decided_by is not null);
end $$;
reset role; reset request.jwt.claim.sub;

-- ================= double-booking is physically impossible ===================
do $$
declare b public.bookings; msg text;
begin
  -- an accepted stay now holds 2026-10-11..17; the same range must be unavailable
  perform pg_temp.ok('Accepted stay makes the range unavailable',
    not public.is_range_available(1::smallint, date '2026-10-11', date '2026-10-17'));
  perform pg_temp.ok('Overlapping range also unavailable',
    not public.is_range_available(1::smallint, date '2026-10-14', date '2026-10-20'));
  perform pg_temp.ok('Adjacent range is still available',
    public.is_range_available(1::smallint, date '2026-10-18', date '2026-10-21'));

  -- the RPC refuses it
  begin
    b := public.request_booking(1::smallint, date '2026-10-12', date '2026-10-16',
          'Second Guest', '+96588888888', 'second@example.com', 2::smallint);
    perform pg_temp.ok('RPC refuses an overlapping request', false, 'accepted');
  exception when others then
    perform pg_temp.ok('RPC refuses an overlapping request', sqlerrm like '%no longer available%', sqlerrm);
  end;

  -- and the constraint refuses it even from a privileged path
  begin
    insert into public.bookings (ref, chalet_id, start_date, end_date, total,
      guest_name, guest_phone, guest_email, guests, status)
    values ('BZR-FORCED', 1, '2026-10-13', '2026-10-15', 300,
            'Forced Insert', '+9650000', 'f@example.com', 2, 'accepted');
    perform pg_temp.ok('Exclusion constraint blocks overlapping accepted rows', false, 'insert succeeded');
  exception when exclusion_violation then
    perform pg_temp.ok('Exclusion constraint blocks overlapping accepted rows', true, 'exclusion_violation');
  end;

  -- pending requests MAY overlap: several guests can ask for the same week
  insert into public.bookings (ref, chalet_id, start_date, end_date, total,
    guest_name, guest_phone, guest_email, guests, status)
  values ('BZR-PEND01', 1, '2026-10-13', '2026-10-15', 300,
          'Waiting Guest', '+9650000', 'w@example.com', 2, 'pending');
  perform pg_temp.ok('Pending requests may overlap (waiting list works)', true);
end $$;

-- ====================== admin acceptance conflict ============================
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
declare v_id uuid;
begin
  select id into v_id from public.bookings where ref = 'BZR-PEND01';
  begin
    perform public.set_booking_status(v_id, 'accepted');
    perform pg_temp.ok('Accepting a clashing request is refused with a clear message', false, 'accepted');
  exception when others then
    perform pg_temp.ok('Accepting a clashing request is refused with a clear message',
      sqlerrm like '%already held by booking%', sqlerrm);
  end;
end $$;
reset role; reset request.jwt.claim.sub;

-- ============================== audit ========================================
do $$
declare n integer;
begin
  select count(*) into n from public.audit_log where action = 'booking.created';
  perform pg_temp.ok('Booking creation is audited', n >= 1, format('%s rows', n));
  select count(*) into n from public.audit_log where action = 'booking.status';
  perform pg_temp.ok('Status changes are audited', n >= 1, format('%s rows', n));
end $$;
