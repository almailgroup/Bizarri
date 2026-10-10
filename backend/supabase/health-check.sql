-- ============================================================================
-- Health check: what this database has, and whether the rules behave.
--
-- Paste the whole file into the Supabase SQL editor and Run. Every row should
-- read true. A false row names what is missing; re-running the matching part
-- from schema-parts/ is always the fix, and is safe even if it already ran.
--
-- The dates start in October 2026, chosen because the 4th is a Sunday: the
-- 8th-10th is a Thu-Sat weekend and the 11th-17th a full Sun-Sat week. They
-- are only arithmetic -- prices and weekdays -- so whether they have passed
-- does not matter, and nothing is inserted, so this is safe to run against
-- production. The pricing rows compare against the rates as they stand, on
-- the first fortnight with no custom price or occasion, so an owner who has
-- changed a rate or priced a day still sees true; a false one says what the
-- price came out as.
--
-- What it cannot tell you is anything outside Postgres: whether the Edge
-- Functions are deployed, whether the booking webhooks are wired, or whether
-- RESEND_API_KEY is set. Those live in the dashboard.
-- ============================================================================

select 'migrations' as area, * from (values
  ('01 core schema',      (to_regclass('public.bookings')                                is not null)),
  ('02 booking logic',    (to_regprocedure('public.quote_stay(smallint,date,date)')      is not null)),
  ('03 RLS',              (to_regprocedure('public.is_admin()')                          is not null)),
  ('04 seed',             ((select count(*) from public.chalets) > 0)),
  ('05 booking guards',   (to_regprocedure('public.generate_booking_ref()')              is not null)),
  ('06 audit',            (to_regclass('public.audit_log')                               is not null)),
  ('07 occasions',        (to_regclass('public.special_occasions')                       is not null)),
  ('08 email codes',      (to_regclass('public.email_verifications')                     is not null)),
  ('09 min stay 1 day',   ((select min_stay_days from public.rates where id) = 1)),
  ('10 three-way lookup', (to_regprocedure('public.lookup_booking_by_email(text)')       is not null)),
  ('11 latin digits',     ((select bool_and(name_ar !~ '[٠-٩]') from public.chalets))),
  ('12 weekend rule',     (to_regprocedure('public.weekend_is_whole(date,date)')         is not null)),
  ('13 function lockdown', (not has_function_privilege('anon','public.start_email_verification(text)','execute'))),
  ('14 Kuwait today',     (to_regprocedure('public.local_today(timestamptz)')            is not null)),
  ('15 admin bookings',   (to_regprocedure('public.admin_create_booking(smallint,date,date,text,text,text,smallint,public.booking_status,numeric,text,text,text,boolean)') is not null)),
  ('16 insurance deposit', (to_regprocedure('public.insurance_deposit()')              is not null))
) t(item, ok)
union all
-- Expected from the rates as they stand, not from the defaults: the owner
-- edits them under Package Rates, and a check that assumed 350 for a weekend
-- read false the moment the weekend rate changed. The dates are the first
-- Sun-Sat fortnight with no custom day price and no special occasion on
-- chalet 1, so what is measured is the rates alone. A false row says what
-- it got.
select 'pricing', t.item, t.ok
from (select * from public.rates where id) r
cross join lateral (
  select s::date as sun
  from generate_series(date '2026-10-04', date '2026-10-04' + 7 * 104, interval '7 days') s
  where not exists (select 1 from public.day_prices dp
                     where dp.chalet_id = 1 and dp.day between s::date and s::date + 13)
    and not exists (select 1 from public.special_occasions o
                     where o.active and o.start_date <= s::date + 13 and o.end_date >= s::date)
  order by 1
  limit 1
) f
cross join lateral (
  select
    (select total from public.quote_stay(1::smallint, f.sun + 1, f.sun + 1))  as one_weekday,
    (select total from public.quote_stay(1::smallint, f.sun,     f.sun + 3))  as sun_wed,
    (select total from public.quote_stay(1::smallint, f.sun + 4, f.sun + 6))  as thu_sat,
    (select total from public.quote_stay(1::smallint, f.sun + 3, f.sun + 6))  as wed_sat,
    (select total from public.quote_stay(1::smallint, f.sun,     f.sun + 6))  as sun_sat,
    (select total from public.quote_stay(1::smallint, f.sun + 4, f.sun + 13)) as two_weekends
) q
cross join lateral (values
  ('One weekday = daily weekday rate',          q.one_weekday,  r.daily_weekday),
  ('Sun-Wed = weekday package',                 q.sun_wed,      r.weekday),
  ('Thu-Sat = weekend rate',                    q.thu_sat,      r.weekend),
  ('Wed-Sat = one weekday + weekend',           q.wed_sat,      r.daily_weekday + r.weekend),
  ('Sun-Sat = full week',                       q.sun_sat,      r.full_week),
  ('Two weekends = 2 weekends + 4 weekdays',    q.two_weekends, 2 * r.weekend + 4 * r.daily_weekday)
) v(label, got, expected)
cross join lateral (select
  format('%s (%s%s, week of %s)', v.label, trim_scale(v.expected),
         case when v.got = v.expected then '' else format(', got %s', trim_scale(v.got)) end,
         to_char(f.sun, 'DD Mon YYYY')) as item,
  v.got = v.expected as ok
) t
union all
select 'weekend rule', * from (values
  ('A lone Friday is refused',      (not public.weekend_is_whole('2026-10-09','2026-10-09'))),
  ('Thu-Fri is refused',            (not public.weekend_is_whole('2026-10-08','2026-10-09'))),
  ('Sun-Thu is refused',            (not public.weekend_is_whole('2026-10-04','2026-10-08'))),
  ('A whole Thu-Sat is allowed',    (public.weekend_is_whole('2026-10-08','2026-10-10'))),
  ('A single weekday is allowed',   (public.weekend_is_whole('2026-10-05','2026-10-05'))),
  ('Sun-Wed is allowed',            (public.weekend_is_whole('2026-10-04','2026-10-07'))),
  -- "Past" means past in Kuwait, not on the server's UTC clock, which runs
  -- three hours behind and used to keep the day that had just ended open.
  ('Today is Kuwait''s today',      (public.local_today() = (now() at time zone 'Asia/Kuwait')::date)),
  ('…and availability goes by it',  (pg_get_functiondef('public.is_range_available(smallint,date,date)'::regprocedure) like '%local_today%'
                                     and pg_get_functiondef('public.availability_calendar(smallint,date,date)'::regprocedure) like '%local_today%'))
) t(item, ok)
union all
select 'guest access', * from (values
  ('Guests cannot insert bookings', (not has_table_privilege('anon','public.bookings','insert'))),
  ('…and book through the RPC',     (has_function_privilege('anon','public.request_booking(smallint,date,date,text,text,text,smallint,text,text,boolean,text)','execute'))),
  ('Code minting is server-only',   (not has_function_privilege('anon','public.start_email_verification(text)','execute'))),
  ('Verified-check is server-only', (not has_function_privilege('anon','public.is_email_verified(text)','execute'))),
  ('The throttle is server-only',   (not has_function_privilege('anon','public.note_lookup(text,text,integer)','execute'))),
  ('Deciding a booking is not anon',(not has_function_privilege('anon','public.set_booking_status(uuid,public.booking_status,text)','execute'))),
  ('…but an admin still can',       (has_function_privilege('authenticated','public.set_booking_status(uuid,public.booking_status,text)','execute'))),
  ('Admin bookings are not anon',   (not has_function_privilege('anon','public.admin_create_booking(smallint,date,date,text,text,text,smallint,public.booking_status,numeric,text,text,text,boolean)','execute'))),
  ('The code minter reaches service_role', (has_function_privilege('service_role','public.start_email_verification(text)','execute'))),
  ('…but a guest may verify one',   (has_function_privilege('anon','public.verify_email_code(text,text)','execute'))),
  ('Lookup by ref',                 (has_function_privilege('anon','public.lookup_booking_by_ref(text)','execute'))),
  ('Lookup by email',               (has_function_privilege('anon','public.lookup_booking_by_email(text)','execute'))),
  ('Lookup by phone',               (has_function_privilege('anon','public.lookup_booking_by_phone(text)','execute')))
) t(item, ok)
union all
select 'settings', * from (values
  ('Email gate is on',    ((select value = 'true'::jsonb from public.settings where key='require_email_verification'))),
  ('Deposit is set',      (public.insurance_deposit() >= 0
                           and exists (select 1 from public.settings where key='insurance_deposit'))),
  ('New bookings take it', ((select column_default like '%insurance_deposit()%'
                              from information_schema.columns
                             where table_schema='public' and table_name='bookings'
                               and column_name='deposit'))),
  ('Contact details set', (exists (select 1 from public.settings where key='contact'))),
  ('An admin exists',     (exists (select 1 from public.admins)))
) t(item, ok);
