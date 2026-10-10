-- ============================================================================
-- Part 4 of 16: seed
--
-- Paste this whole file into the Supabase SQL editor and Run, then move on
-- to the next part. Run them in order; each one is safe to run twice.
-- ============================================================================

-- ============================================================================
-- Baseline data. Idempotent: safe to re-run.
-- ============================================================================

insert into public.chalets (id, slug, name_en, name_ar, sort_order) values
  -- Latin digits, like every other number on the Arabic site: see
  -- 20260930120000_latin_digits_in_arabic_names.sql.
  (1, 'bizarri-1', 'Bizarri Chalet 1', 'شاليه بيزاري 1', 1),
  (2, 'bizarri-2', 'Bizarri Chalet 2', 'شاليه بيزاري 2', 2)
on conflict (id) do nothing;

insert into public.rates (id) values (true)
on conflict (id) do nothing;

insert into public.settings (key, value) values
  ('contact', jsonb_build_object(
     'phone', '+96594040955',
     'whatsapp', '96594040955',
     'email', 'sales@bizarri.com',
     'instagram', 'https://www.instagram.com/bizarri.chalet',
     'maps', 'https://maps.app.goo.gl/5wjw1skfpqdnDhFa6')),
  ('notify_emails', jsonb_build_array('admin@almailgroup.com'))
on conflict (key) do nothing;
