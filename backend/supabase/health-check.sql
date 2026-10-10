-- ============================================================================
-- Health check: what this database has, and whether the rules behave.
--
-- Paste the whole file into the Supabase SQL editor and Run. Every row should
-- read true. A false row names what is missing; re-running the matching part
-- from schema-parts/ is always the fix, and is safe even if it already ran.
--
-- The dates are October 2026, chosen because the 4th is a Sunday: the 8th-10th
-- is a Thu-Sat weekend and the 11th-17th a full Sun-Sat week. They are only
-- arithmetic -- prices and weekdays -- so whether they have passed does not
-- matter, and nothing is inserted, so this is safe to run against production.
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
  ('14 Kuwait today',     (to_regprocedure('public.local_today(timestamptz)')            is not null))
) t(item, ok)
union all
select 'pricing', * from (values
  ('One weekday = 75',          ((select total from public.quote_stay(1::smallint,'2026-10-05','2026-10-05')) = 75)),
  ('Sun-Wed = 300',             ((select total from public.quote_stay(1::smallint,'2026-10-04','2026-10-07')) = 300)),
  ('Thu-Sat = 350',             ((select total from public.quote_stay(1::smallint,'2026-10-08','2026-10-10')) = 350)),
  ('Wed-Sat = 75 + 350',        ((select total from public.quote_stay(1::smallint,'2026-10-07','2026-10-10')) = 425)),
  ('Sun-Sat = 600 full week',   ((select total from public.quote_stay(1::smallint,'2026-10-11','2026-10-17')) = 600)),
  ('Two weekends = 2 x 350',    ((select total from public.quote_stay(1::smallint,'2026-10-08','2026-10-17')) = 1000))
) t(item, ok)
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
  ('The code minter reaches service_role', (has_function_privilege('service_role','public.start_email_verification(text)','execute'))),
  ('…but a guest may verify one',   (has_function_privilege('anon','public.verify_email_code(text,text)','execute'))),
  ('Lookup by ref',                 (has_function_privilege('anon','public.lookup_booking_by_ref(text)','execute'))),
  ('Lookup by email',               (has_function_privilege('anon','public.lookup_booking_by_email(text)','execute'))),
  ('Lookup by phone',               (has_function_privilege('anon','public.lookup_booking_by_phone(text)','execute')))
) t(item, ok)
union all
select 'settings', * from (values
  ('Email gate is on',    ((select value = 'true'::jsonb from public.settings where key='require_email_verification'))),
  ('Contact details set', (exists (select 1 from public.settings where key='contact'))),
  ('An admin exists',     (exists (select 1 from public.admins)))
) t(item, ok);
