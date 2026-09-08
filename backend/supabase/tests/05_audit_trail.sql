\set ON_ERROR_STOP on
-- Extended audit trail: booking field edits, settings changes, chalet changes.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(label text, cond boolean, detail text default '')
returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %  %', label, detail;
  else raise exception 'FAIL  %  %', label, detail; end if;
end $$;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@almailgroup.com')
on conflict do nothing;
insert into public.admins (user_id, email)
  values ('11111111-1111-1111-1111-111111111111', 'admin@almailgroup.com')
on conflict do nothing;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

-- ---- booking field edit is audited ----
do $$
declare v_id uuid; v_ref text; n integer; v_detail jsonb;
begin
  insert into public.bookings (ref, chalet_id, start_date, end_date, total,
    guest_name, guest_phone, guest_email, guests, status)
  values ('BZR-EDITME', 1, '2027-02-01', '2027-02-04', 300,
          'Original Name', '+96500000000', 'orig@example.com', 2, 'pending')
  returning id, ref into v_id, v_ref;

  update public.bookings
     set guest_name = 'Corrected Name', total = 275, admin_note = 'discount applied'
   where id = v_id;

  select count(*) into n from public.audit_log
   where action = 'booking.edited' and entity_id = v_ref;
  perform pg_temp.ok('Direct field edit is audited as booking.edited', n = 1, format('%s rows', n));

  select detail into v_detail from public.audit_log
   where action = 'booking.edited' and entity_id = v_ref limit 1;
  perform pg_temp.ok('Edit detail captures guest_name change',
    v_detail->'guest_name' = jsonb_build_array('Original Name', 'Corrected Name'), v_detail::text);
  perform pg_temp.ok('Edit detail captures total change',
    v_detail->'total' = jsonb_build_array(300, 275), v_detail::text);
  perform pg_temp.ok('Edit detail captures admin_note change',
    v_detail->'admin_note' = jsonb_build_array(null, 'discount applied'), v_detail::text);
  perform pg_temp.ok('Edit detail does NOT include unchanged columns',
    not (v_detail ? 'guest_phone'), v_detail::text);

  -- a no-op update (nothing actually changes) must not spam the log
  update public.bookings set guest_name = 'Corrected Name' where id = v_id;
  select count(*) into n from public.audit_log
   where action = 'booking.edited' and entity_id = v_ref;
  perform pg_temp.ok('No-op update does not create a duplicate log entry', n = 1, format('%s rows', n));

  delete from public.bookings where id = v_id;
end $$;

-- ---- settings change is audited ----
do $$
declare n integer; v_detail jsonb;
begin
  update public.settings set value = jsonb_build_object('phone', '+96500000000') where key = 'contact';
  select count(*) into n from public.audit_log where action = 'settings.updated' and entity_id = 'contact';
  perform pg_temp.ok('Settings change is audited', n = 1, format('%s rows', n));
  select detail into v_detail from public.audit_log where action = 'settings.updated' and entity_id = 'contact' limit 1;
  perform pg_temp.ok('Settings audit captures before/after', v_detail ? 'before' and v_detail ? 'after', v_detail::text);
end $$;

-- ---- chalet change is audited ----
do $$
declare n integer; v_detail jsonb;
begin
  update public.chalets set active = false where id = 2;
  select count(*) into n from public.audit_log where action = 'chalet.updated' and entity_id = '2';
  perform pg_temp.ok('Chalet deactivation is audited', n = 1, format('%s rows', n));
  select detail into v_detail from public.audit_log where action = 'chalet.updated' and entity_id = '2' limit 1;
  perform pg_temp.ok('Chalet audit captures the active flag flip',
    v_detail->'active' = jsonb_build_array(true, false), v_detail::text);
  update public.chalets set active = true where id = 2;
end $$;

reset role; reset request.jwt.claim.sub;
