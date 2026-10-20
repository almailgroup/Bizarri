\set ON_ERROR_STOP on
create or replace function pg_temp.ok(label text, cond boolean, detail text default '')
returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %  %', label, detail;
  else raise exception 'FAIL  %  %', label, detail; end if;
end $$;

-- Offers: dates the admin picks, at one price for the whole stay. Today is
-- pinned to Wed 30 Sep 2026; May 2027 on both chalets is untouched by earlier
-- suites. 2 May 2027 is a Sunday: 2-5 is a Sun-Wed (weekday package, 300),
-- 6-8 a Thu-Sat (weekend, 350).
update public.settings set value = 'false'::jsonb where key = 'require_email_verification';

create or replace function pg_temp.try_offer(p_chalet smallint, p_start date, p_end date,
  p_price numeric)
returns text language plpgsql as $$
begin
  insert into public.offers (chalet_id, start_date, end_date, price)
  values (p_chalet, p_start, p_end, p_price);
  return 'ok';
exception when others then
  return sqlerrm;
end $$;
grant execute on function pg_temp.try_offer(smallint, date, date, numeric)
  to anon, authenticated;

-- ===================================================== who may make one =====
set role anon;
do $$
declare e text;
begin
  e := pg_temp.try_offer(null, '2027-05-02', '2027-05-05', 1);
  perform pg_temp.ok('A guest cannot make an offer', e like '%permission denied%', e);
end $$;
reset role;

set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare e text;
begin
  e := pg_temp.try_offer(null, '2027-05-02', '2027-05-05', 1);
  perform pg_temp.ok('…nor a signed-in non-admin', e like '%row-level security%', e);
end $$;
reset role; reset request.jwt.claim.sub;

-- ================================================ the admin makes three =====
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.offers (title_en, title_ar, start_date, end_date, price)
  values ('Midweek escape', 'عرض منتصف الأسبوع', '2027-05-02', '2027-05-05', 200);
insert into public.offers (chalet_id, start_date, end_date, price)
  values (2, '2027-05-06', '2027-05-08', 250);
insert into public.offers (start_date, end_date, price, active)
  values ('2027-05-16', '2027-05-19', 100, false);

do $$
declare e text;
begin
  -- The shape of the dates.
  e := pg_temp.try_offer(null, '2027-05-13', '2027-05-14', 100);
  perform pg_temp.ok('An offer cannot take part of a weekend', e like '%offers_weekend_whole%', e);
  e := pg_temp.try_offer(null, '2027-05-05', '2027-05-02', 100);
  perform pg_temp.ok('…nor end before it starts', e like '%offers_dates_ordered%', e);
  e := pg_temp.try_offer(null, '2027-05-02', '2027-08-31', 100);
  perform pg_temp.ok('…nor run past 90 days', e like '%offers_at_most_90_days%', e);
  e := pg_temp.try_offer(null, '2027-05-23', '2027-05-26', -1);
  perform pg_temp.ok('…nor have a negative price', e like '%check constraint%', e);
end $$;
reset role; reset request.jwt.claim.sub;

-- ============================================================== pricing =====
do $$
declare q record;
begin
  select * into q from public.quote_stay(1::smallint, '2027-05-02', '2027-05-05');
  perform pg_temp.ok('An offer prices exactly its own dates',
    q.total = 200 and q.package_key = 'offer', format('%s %s', q.total, q.package_key));
  perform pg_temp.ok('…and says which offer', q.occasion = 'Midweek escape', q.occasion);
  select * into q from public.quote_stay(2::smallint, '2027-05-02', '2027-05-05');
  perform pg_temp.ok('An offer for both chalets prices both', q.total = 200, q.total::text);

  select * into q from public.quote_stay(1::smallint, '2027-05-02', '2027-05-04');
  perform pg_temp.ok('A stay that only overlaps it is priced as usual',
    q.total = 225 and q.package_key is null, format('%s %s', q.total, q.package_key));

  select * into q from public.quote_stay(2::smallint, '2027-05-06', '2027-05-08');
  perform pg_temp.ok('An offer for one chalet prices that chalet', q.total = 250, q.total::text);
  select * into q from public.quote_stay(1::smallint, '2027-05-06', '2027-05-08');
  perform pg_temp.ok('…and not the other one', q.total = 350 and q.package_key = 'weekend',
    format('%s %s', q.total, q.package_key));

  select * into q from public.quote_stay(1::smallint, '2027-05-16', '2027-05-19');
  perform pg_temp.ok('An offer switched off prices nothing', q.total = 300, q.total::text);
end $$;

-- A custom day price inside an offer's dates does not undo the offer.
insert into public.day_prices (chalet_id, day, price) values (1, '2027-05-03', 500);
do $$
declare q record;
begin
  select * into q from public.quote_stay(1::smallint, '2027-05-02', '2027-05-05');
  perform pg_temp.ok('The offer stands over a custom day price', q.total = 200, q.total::text);
end $$;
delete from public.day_prices where chalet_id = 1 and day = '2027-05-03';

-- ===================================================== what a guest sees ====
set role anon;
do $$
declare n integer; b public.bookings;
begin
  select count(*) into n from public.offers where start_date >= '2027-05-01';
  perform pg_temp.ok('A guest sees the offers that are on, not the one switched off', n = 2,
    format('%s offers', n));

  b := public.request_booking(1::smallint, '2027-05-02', '2027-05-05', 'Offer Guest',
    '+96551113333', 'offer-guest@example.com', 2::smallint, null, 'ids/offer.jpg', true, 'en');
  perform pg_temp.ok('Booking an offer charges its price',
    b.total = 200 and b.package_key = 'offer', format('%s %s', b.total, b.package_key));
end $$;
reset role;

-- ================================================= the activity log =========
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update public.offers set price = 180 where title_en = 'Midweek escape';
delete from public.offers where start_date = '2027-05-16';
do $$
declare n integer;
begin
  select count(*) into n from public.audit_log where action = 'offer.created';
  perform pg_temp.ok('Making an offer is logged', n = 3, format('%s entries', n));
  select count(*) into n from public.audit_log
   where action = 'offer.updated' and detail ? 'price' and detail->>'title' = 'Midweek escape';
  perform pg_temp.ok('…changing one, with the old price and the new', n = 1, format('%s entries', n));
  select count(*) into n from public.audit_log where action = 'offer.deleted';
  perform pg_temp.ok('…and deleting one', n = 1, format('%s entries', n));
end $$;
reset role; reset request.jwt.claim.sub;
