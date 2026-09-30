-- ============================================================================
-- One digit set on the Arabic site.
--
-- The chalets were seeded "شاليه بيزاري ١" and "شاليه بيزاري ٢", in
-- Arabic-Indic digits. Nothing else on the site is written that way: a price
-- is "350 د.ك", a booking reference is BZR-4K2M9X, the phone number is
-- +965 94040955, and the day cells of the booking calendar are a plain 1, 2,
-- 3. A reference and a phone number cannot be anything but Latin, so Latin is
-- the only digit set the whole site can agree on, and the front end now
-- formats every date that way too.
--
-- Only rows still holding the seeded name are touched. An owner who has
-- renamed a chalet from the admin panel keeps their name; for them this is a
-- no-op, which is also what makes it safe to re-run.
-- ============================================================================

update public.chalets set name_ar = 'شاليه بيزاري 1'
 where id = 1 and name_ar = 'شاليه بيزاري ١';

update public.chalets set name_ar = 'شاليه بيزاري 2'
 where id = 2 and name_ar = 'شاليه بيزاري ٢';
