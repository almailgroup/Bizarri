\set ON_ERROR_STOP on
create or replace function pg_temp.ok(label text, cond boolean, detail text default '')
returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %  %', label, detail;
  else raise exception 'FAIL  %  %', label, detail; end if;
end $$;

-- Whether a code waives the insurance deposit is the admin's choice. Today is
-- pinned to Wed 30 Sep 2026; September 2027 on chalet 2 is untouched by
-- earlier suites. 5 Sep 2027 is a Sunday: 5-8 is the Sun-Wed weekday, 300.
update public.settings set value = 'false'::jsonb where key = 'require_email_verification';

create or replace function pg_temp.book(p_start date, p_end date, p_email text, p_code text)
returns public.bookings language sql as $$
  select * from public.request_booking(2::smallint, p_start, p_end, 'Deposit Choice',
    '+96551115555', p_email, 2::smallint, null, 'ids/choice.jpg', true, 'en', p_code);
$$;
grant execute on function pg_temp.book(date, date, text, text) to anon;

do $$
begin
  perform pg_temp.ok('Codes made before the choice existed still waive the deposit',
    (select bool_and(waives_deposit) from public.discount_codes));
end $$;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.discount_codes (code, kind, value, waives_deposit)
  values ('KEEPDEPOSIT', 'percent', 10, false);
insert into public.discount_codes (code, kind, value) values ('DROPDEPOSIT', 'percent', 10);
reset role; reset request.jwt.claim.sub;

set role anon;
do $$
declare r record; b public.bookings;
begin
  select * into r from public.check_discount_code('keepdeposit');
  perform pg_temp.ok('Checking a code says whether it waives the deposit',
    r.valid and r.waives_deposit = false, row_to_json(r)::text);
  select * into r from public.check_discount_code('DROPDEPOSIT');
  perform pg_temp.ok('…a new code waives it unless told otherwise',
    r.valid and r.waives_deposit, row_to_json(r)::text);
  select * into r from public.check_discount_code('NOSUCHCODE');
  perform pg_temp.ok('…and an unknown code says nothing about it',
    not r.valid and r.waives_deposit is null, row_to_json(r)::text);

  b := pg_temp.book('2027-09-05', '2027-09-08', 'keep@example.com', 'KEEPDEPOSIT');
  perform pg_temp.ok('A code that keeps the deposit still takes its discount',
    b.total = 270 and b.discount = 30, format('total %s, discount %s', b.total, b.discount));
  perform pg_temp.ok('…and the deposit is charged', b.deposit = 100, b.deposit::text);

  b := pg_temp.book('2027-09-12', '2027-09-15', 'drop@example.com', 'DROPDEPOSIT');
  perform pg_temp.ok('A code that waives it charges none', b.total = 270 and b.deposit = 0,
    format('total %s, deposit %s', b.total, b.deposit));
end $$;
reset role;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update public.discount_codes set waives_deposit = true where code = 'KEEPDEPOSIT';
do $$
declare n integer;
begin
  select count(*) into n from public.audit_log
   where action = 'discount.updated' and entity_id = 'KEEPDEPOSIT' and detail ? 'waives_deposit';
  perform pg_temp.ok('Changing it is in the activity log', n = 1, format('%s entries', n));
  select count(*) into n from public.audit_log
   where action = 'discount.created' and entity_id = 'KEEPDEPOSIT'
     and detail->>'waives_deposit' = 'false';
  perform pg_temp.ok('…and so is what a new code was made with', n = 1, format('%s entries', n));
  perform pg_temp.ok('Changing it leaves the bookings already made as they were',
    (select deposit = 100 from public.bookings where guest_email = 'keep@example.com'));
end $$;
reset role; reset request.jwt.claim.sub;
