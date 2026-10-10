\set ON_ERROR_STOP on
create or replace function pg_temp.ok(label text, cond boolean, detail text default '')
returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %  %', label, detail;
  else raise exception 'FAIL  %  %', label, detail; end if;
end $$;

-- The refundable insurance deposit. Today is pinned to Wed 30 September 2026;
-- January 2027 on chalet 2 is untouched by earlier suites. 10 Jan 2027 is a
-- Sunday, so 10-13 is the Sun-Wed weekday package at 300.
update public.settings set value = 'false'::jsonb where key = 'require_email_verification';

create or replace function pg_temp.book(p_start date, p_end date, p_email text)
returns public.bookings language sql as $$
  select * from public.request_booking(2::smallint, p_start, p_end, 'Deposit Guest',
    '+96551112222', p_email, 2::smallint, null, 'ids/deposit.jpg', true, 'en');
$$;
grant execute on function pg_temp.book(date, date, text) to anon;

do $$
begin
  perform pg_temp.ok('The deposit is a setting, 100 to start with',
    (select value = '100'::jsonb from public.settings where key = 'insurance_deposit'));
  perform pg_temp.ok('…and insurance_deposit() reads it', public.insurance_deposit() = 100);
end $$;

-- ================================================ a guest's booking =========
set role anon;
do $$
declare b public.bookings;
begin
  b := pg_temp.book('2027-01-10', '2027-01-13', 'deposit-1@example.com');
  perform pg_temp.ok('A new booking carries the deposit', b.deposit = 100, b.deposit::text);
  perform pg_temp.ok('…on top of the stay, which is still priced as before',
    b.total = 300, format('total %s, deposit %s', b.total, b.deposit));
end $$;
reset role;

-- ================================================ changing the amount =======
update public.settings set value = '150'::jsonb where key = 'insurance_deposit';
set role anon;
do $$
declare b public.bookings;
begin
  b := pg_temp.book('2027-01-17', '2027-01-20', 'deposit-2@example.com');
  perform pg_temp.ok('A new amount applies to the next booking', b.deposit = 150, b.deposit::text);
end $$;
reset role;
do $$ begin
  perform pg_temp.ok('…and leaves the ones already made alone',
    (select deposit from public.bookings where guest_email = 'deposit-1@example.com') = 100);
end $$;

-- A bad value must never stop a booking: the default runs on every insert.
update public.settings set value = '"a hundred"'::jsonb where key = 'insurance_deposit';
do $$ begin
  perform pg_temp.ok('A setting that is not a number falls back to 100', public.insurance_deposit() = 100);
end $$;
update public.settings set value = '-5'::jsonb where key = 'insurance_deposit';
do $$ begin
  perform pg_temp.ok('…and so does a negative one', public.insurance_deposit() = 100);
end $$;
delete from public.settings where key = 'insurance_deposit';
set role anon;
do $$
declare b public.bookings;
begin
  perform pg_temp.ok('…and a missing one', public.insurance_deposit() = 100);
  b := pg_temp.book('2027-01-24', '2027-01-27', 'deposit-3@example.com');
  perform pg_temp.ok('…with bookings still taken', b.deposit = 100, b.deposit::text);
end $$;
reset role;
insert into public.settings (key, value) values ('insurance_deposit', '100'::jsonb);

-- ===================================================== who may change it ====
set role anon;
do $$
declare n integer;
begin
  update public.settings set value = '0'::jsonb where key = 'insurance_deposit';
  get diagnostics n = row_count;
  perform pg_temp.ok('A guest cannot change the deposit', n = 0, format('%s rows', n));
exception when insufficient_privilege then
  perform pg_temp.ok('A guest cannot change the deposit', true, 'refused');
end $$;
reset role;

-- ================================================== what the guest sees ====
-- The reference is handed over out of band, as a guest would have it.
select ref as depref from public.bookings where guest_email = 'deposit-1@example.com'
\gset
set my.depref = :'depref';
set role anon;
do $$
declare r record; v_ref text;
begin
  v_ref := current_setting('my.depref');
  select * into r from public.lookup_booking_by_ref(v_ref);
  perform pg_temp.ok('The lookup by reference returns the deposit',
    r.deposit = 100 and r.total = 300, format('%s + %s', r.total, r.deposit));
  select * into r from public.lookup_booking_by_email('deposit-2@example.com');
  perform pg_temp.ok('…and by email', r.deposit = 150, r.deposit::text);
  select * into r from public.lookup_booking_by_phone('51112222');
  perform pg_temp.ok('…and by phone', r.deposit is not null, r.deposit::text);
end $$;
reset role;

-- ================================================== the admin ===============
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
declare b public.bookings; n integer;
begin
  b := public.admin_create_booking(2::smallint, '2027-02-07', '2027-02-08',
    'Phone Guest', '96590003333', 'deposit-admin@example.com', 2::smallint);
  perform pg_temp.ok('A booking the admin enters carries it too', b.deposit = 100, b.deposit::text);

  update public.bookings set deposit = 0 where id = b.id;
  perform pg_temp.ok('An admin can waive it on one booking',
    (select deposit from public.bookings where id = b.id) = 0);
  select count(*) into n from public.audit_log
   where action = 'booking.edited' and entity_id = b.ref and detail ? 'deposit';
  perform pg_temp.ok('…and the change is in the activity log', n = 1, format('%s entries', n));

  begin
    update public.bookings set deposit = -1 where id = b.id;
    perform pg_temp.ok('A negative deposit is refused', false, 'accepted');
  exception when check_violation then
    perform pg_temp.ok('A negative deposit is refused', true);
  end;
end $$;
reset role; reset request.jwt.claim.sub;
