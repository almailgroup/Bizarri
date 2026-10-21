\set ON_ERROR_STOP on
create or replace function pg_temp.ok(label text, cond boolean, detail text default '')
returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %  %', label, detail;
  else raise exception 'FAIL  %  %', label, detail; end if;
end $$;

-- Discount codes. Today is pinned to Wed 30 Sep 2026; August 2027 on both
-- chalets is untouched by earlier suites. 1 Aug 2027 is a Sunday: 1-4 is a
-- Sun-Wed (weekday package, 300), 19-21 a Thu-Sat (weekend, 350).
update public.settings set value = 'false'::jsonb where key = 'require_email_verification';

create or replace function pg_temp.book(p_chalet smallint, p_start date, p_end date,
  p_email text, p_code text default null)
returns public.bookings language sql as $$
  select * from public.request_booking(p_chalet, p_start, p_end, 'Code Guest',
    '+96551114444', p_email, 2::smallint, null, 'ids/code.jpg', true, 'en', p_code);
$$;
create or replace function pg_temp.try_book(p_chalet smallint, p_start date, p_end date,
  p_email text, p_code text default null)
returns text language plpgsql as $$
begin
  perform pg_temp.book(p_chalet, p_start, p_end, p_email, p_code);
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
create or replace function pg_temp.try_code(p_code text, p_kind text, p_value numeric,
  p_max integer default null)
returns text language plpgsql as $$
begin
  insert into public.discount_codes (code, kind, value, max_uses)
  values (p_code, p_kind, p_value, p_max);
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
grant execute on function pg_temp.book(smallint, date, date, text, text) to anon, authenticated;
grant execute on function pg_temp.try_book(smallint, date, date, text, text) to anon, authenticated;
grant execute on function pg_temp.try_code(text, text, numeric, integer) to anon, authenticated;

-- ================================================== who may see and make ====
set role anon;
do $$
declare e text;
begin
  e := pg_temp.try_code('GUEST', 'percent', 50);
  perform pg_temp.ok('A guest cannot make a code', e like '%permission denied%', e);
  begin
    perform 1 from public.discount_codes;
    perform pg_temp.ok('…nor read them', false, 'read succeeded');
  exception when insufficient_privilege then
    perform pg_temp.ok('…nor read them', true);
  end;
end $$;
reset role;

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare e text; n integer;
begin
  e := pg_temp.try_code('NOTADMIN', 'percent', 50);
  perform pg_temp.ok('A signed-in non-admin cannot make one', e like '%row-level security%', e);
end $$;
reset role; reset request.jwt.claim.sub;

-- ============================================================ the admin =====
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.discount_codes (code, kind, value) values ('TENOFF', 'percent', 10);
insert into public.discount_codes (code, kind, value, max_uses) values ('ONCE50', 'amount', 50, 1);
insert into public.discount_codes (code, kind, value, expires_on) values ('OLD', 'percent', 20, '2026-09-29');
insert into public.discount_codes (code, kind, value, active) values ('PAUSED', 'percent', 20, false);
insert into public.discount_codes (code, kind, value) values ('BIG', 'amount', 1000);
insert into public.discount_codes (code, kind, value) values ('NODEPOSIT', 'percent', 0);

do $$
declare e text;
begin
  e := pg_temp.try_code('lower', 'percent', 10);
  perform pg_temp.ok('A code is capitals, digits, - and _', e like '%discount_codes_code_format%', e);
  e := pg_temp.try_code('TENOFF', 'percent', 5);
  perform pg_temp.ok('…and unique', e like '%duplicate key%', e);
  e := pg_temp.try_code('TOOMUCH', 'percent', 120);
  perform pg_temp.ok('A percentage is at most 100', e like '%discount_codes_value%', e);
  e := pg_temp.try_code('NEGATIVE', 'amount', -5);
  perform pg_temp.ok('…and an amount is not negative', e like '%discount_codes_value%', e);
  e := pg_temp.try_code('ZEROUSES', 'percent', 10, 0);
  perform pg_temp.ok('A limit is at least one use', e like '%discount_codes_max_uses%', e);
end $$;
reset role; reset request.jwt.claim.sub;

-- ============================================== checking one, as a guest ====
set role anon;
do $$
declare r record;
begin
  select * into r from public.check_discount_code('  tenoff ');
  perform pg_temp.ok('A guest can check a code, however it is typed',
    r.valid and r.code = 'TENOFF' and r.kind = 'percent' and r.value = 10, row_to_json(r)::text);
  select * into r from public.check_discount_code('NOPE');
  perform pg_temp.ok('A code that does not exist is not valid',
    not r.valid and r.reason = 'invalid' and r.code is null, row_to_json(r)::text);
  select * into r from public.check_discount_code('PAUSED');
  perform pg_temp.ok('…nor is one switched off, and it says no more than that',
    not r.valid and r.reason = 'invalid' and r.code is null, row_to_json(r)::text);
  select * into r from public.check_discount_code('OLD');
  perform pg_temp.ok('One past its last day has expired', not r.valid and r.reason = 'expired',
    row_to_json(r)::text);
end $$;

-- ===================================================== booking with one =====
do $$
declare b public.bookings;
begin
  b := pg_temp.book(1::smallint, '2027-08-01', '2027-08-04', 'code-1@example.com', 'tenoff');
  perform pg_temp.ok('A percentage comes off the stay',
    b.total = 270 and b.discount = 30 and b.discount_percent = 10 and b.discount_code = 'TENOFF',
    format('total %s, discount %s', b.total, b.discount));
  perform pg_temp.ok('…and there is no insurance deposit', b.deposit = 0, b.deposit::text);

  b := pg_temp.book(1::smallint, '2027-08-08', '2027-08-11', 'code-2@example.com', 'ONCE50');
  perform pg_temp.ok('An amount comes off the stay',
    b.total = 250 and b.discount = 50 and b.discount_percent is null and b.deposit = 0,
    format('total %s, discount %s', b.total, b.discount));

  b := pg_temp.book(1::smallint, '2027-08-15', '2027-08-18', 'code-3@example.com', 'BIG');
  perform pg_temp.ok('A discount larger than the stay makes it free, not negative',
    b.total = 0 and b.discount = 300, format('total %s, discount %s', b.total, b.discount));

  b := pg_temp.book(2::smallint, '2027-08-01', '2027-08-04', 'code-4@example.com', 'NODEPOSIT');
  perform pg_temp.ok('A 0% code still waives the deposit',
    b.total = 300 and b.discount = 0 and b.deposit = 0, format('total %s, deposit %s', b.total, b.deposit));

  b := pg_temp.book(2::smallint, '2027-08-08', '2027-08-11', 'code-5@example.com');
  perform pg_temp.ok('Without a code the deposit is charged as before',
    b.total = 300 and b.discount = 0 and b.deposit = 100 and b.discount_code is null,
    format('total %s, deposit %s', b.total, b.deposit));
end $$;

do $$
declare e text; r record;
begin
  e := pg_temp.try_book(2::smallint, '2027-08-15', '2027-08-18', 'code-6@example.com', 'ONCE50');
  perform pg_temp.ok('A one-time code cannot be used twice', e like '%already been used%', e);
  select * into r from public.check_discount_code('ONCE50');
  perform pg_temp.ok('…and checking it says so', not r.valid and r.reason = 'used', row_to_json(r)::text);
  e := pg_temp.try_book(2::smallint, '2027-08-15', '2027-08-18', 'code-6@example.com', 'OLD');
  perform pg_temp.ok('An expired code is refused at booking', e like '%has expired%', e);
  e := pg_temp.try_book(2::smallint, '2027-08-15', '2027-08-18', 'code-6@example.com', 'NOPE');
  perform pg_temp.ok('…and so is one that does not exist', e like '%not valid%', e);
end $$;
reset role;

-- A booking turned down gives its use back.
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select id as once_booking from public.bookings where guest_email = 'code-2@example.com'
\gset
select public.set_booking_status(:'once_booking'::uuid, 'rejected');
reset role; reset request.jwt.claim.sub;
set role anon;
do $$
declare r record; b public.bookings;
begin
  select * into r from public.check_discount_code('ONCE50');
  perform pg_temp.ok('A rejected booking gives its use back', r.valid, row_to_json(r)::text);
  b := pg_temp.book(2::smallint, '2027-08-15', '2027-08-18', 'code-7@example.com', 'ONCE50');
  perform pg_temp.ok('…so the code can be used again', b.discount = 50, b.discount::text);
end $$;
reset role;

-- ==================================================== guessing is slowed ====
set role anon;
set request.headers = '{"x-forwarded-for": "203.0.113.9, 10.0.0.1"}';
do $$
declare r record; i integer;
begin
  for i in 1..20 loop
    perform public.check_discount_code('GUESS' || i);
  end loop;
  select * into r from public.check_discount_code('TENOFF');
  perform pg_temp.ok('Twenty wrong codes in an hour and an address must wait',
    not r.valid and r.reason = 'throttled', row_to_json(r)::text);
end $$;
set request.headers = '{"x-forwarded-for": "198.51.100.7"}';
do $$
declare r record;
begin
  select * into r from public.check_discount_code('TENOFF');
  perform pg_temp.ok('…but nobody else has to', r.valid, row_to_json(r)::text);
end $$;
reset request.headers;
reset role;

-- ======================================= moving a booking keeps its discount
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
declare b public.bookings; v uuid;
begin
  select id into v from public.bookings where guest_email = 'code-1@example.com';
  b := public.admin_update_booking(v, 1::smallint, '2027-08-19', '2027-08-21', true);
  perform pg_temp.ok('Repricing a moved booking takes the same percentage off the new price',
    b.total = 315 and b.discount = 35, format('total %s, discount %s', b.total, b.discount));
  select id into v from public.bookings where guest_email = 'code-7@example.com';
  b := public.admin_update_booking(v, 2::smallint, '2027-08-19', '2027-08-21', true);
  perform pg_temp.ok('…or the same amount', b.total = 300 and b.discount = 50,
    format('total %s, discount %s', b.total, b.discount));
end $$;

-- ===================================================== the activity log =====
update public.discount_codes set max_uses = 5 where code = 'TENOFF';
delete from public.discount_codes where code = 'BIG';
do $$
declare n integer;
begin
  select count(*) into n from public.audit_log where action = 'discount.created';
  perform pg_temp.ok('Making a code is logged', n = 6, format('%s entries', n));
  select count(*) into n from public.audit_log
   where action = 'discount.updated' and entity_id = 'TENOFF' and detail ? 'max_uses';
  perform pg_temp.ok('…changing one', n = 1, format('%s entries', n));
  select count(*) into n from public.audit_log where action = 'discount.deleted' and entity_id = 'BIG';
  perform pg_temp.ok('…and deleting one', n = 1, format('%s entries', n));
  select count(*) into n from public.audit_log
   where action = 'booking.created' and detail->>'code' = 'TENOFF';
  perform pg_temp.ok('A booking made with a code says which', n = 1, format('%s entries', n));
  perform pg_temp.ok('Deleting a code leaves the bookings that used it as they were',
    (select discount_code = 'BIG' and discount_code_id is null and discount = 300
       from public.bookings where guest_email = 'code-3@example.com'));
end $$;
reset role; reset request.jwt.claim.sub;
