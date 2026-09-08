-- ============================================================================
-- Baseline data. Idempotent: safe to re-run.
-- ============================================================================

insert into public.chalets (id, slug, name_en, name_ar, sort_order) values
  (1, 'bizarri-1', 'Bizarri Chalet 1', 'شاليه بيزاري ١', 1),
  (2, 'bizarri-2', 'Bizarri Chalet 2', 'شاليه بيزاري ٢', 2)
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
  ('notify_emails', jsonb_build_array('sales@bizarri.com'))
on conflict (key) do nothing;
