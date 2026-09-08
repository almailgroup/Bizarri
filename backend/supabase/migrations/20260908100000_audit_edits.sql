-- ============================================================================
-- Broaden the audit trail to cover what the expanded admin panel can now do:
-- editing a booking's guest details/price (not just its status), and changes
-- to settings and chalets. Previously only booking.created/status/deleted
-- were logged, so a direct field edit left no trace at all.
-- ============================================================================

create or replace function public.log_booking_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_changed jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'booking.created', 'bookings', new.ref,
            jsonb_build_object('chalet', new.chalet_id, 'start', new.start_date,
                               'end', new.end_date, 'total', new.total));
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'booking.deleted', 'bookings', old.ref,
            jsonb_build_object('start', old.start_date, 'end', old.end_date));
    return old;
  end if;

  -- tg_op = 'UPDATE'
  if new.status is distinct from old.status then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'booking.status', 'bookings', new.ref,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  -- Field-level edits from the admin panel's "edit details" form. Each
  -- changed column is recorded as [old, new]; unchanged columns are omitted
  -- so the log entry stays readable instead of dumping the whole row.
  if old.guest_name is distinct from new.guest_name then
    v_changed := v_changed || jsonb_build_object(
      'guest_name', jsonb_build_array(old.guest_name, new.guest_name));
  end if;
  if old.guest_phone is distinct from new.guest_phone then
    v_changed := v_changed || jsonb_build_object(
      'guest_phone', jsonb_build_array(old.guest_phone, new.guest_phone));
  end if;
  if old.guest_email is distinct from new.guest_email then
    v_changed := v_changed || jsonb_build_object(
      'guest_email', jsonb_build_array(old.guest_email, new.guest_email));
  end if;
  if old.guests is distinct from new.guests then
    v_changed := v_changed || jsonb_build_object(
      'guests', jsonb_build_array(old.guests, new.guests));
  end if;
  if old.notes is distinct from new.notes then
    v_changed := v_changed || jsonb_build_object(
      'notes', jsonb_build_array(old.notes, new.notes));
  end if;
  if old.admin_note is distinct from new.admin_note then
    v_changed := v_changed || jsonb_build_object(
      'admin_note', jsonb_build_array(old.admin_note, new.admin_note));
  end if;
  if old.total is distinct from new.total then
    v_changed := v_changed || jsonb_build_object(
      'total', jsonb_build_array(old.total, new.total));
  end if;

  if v_changed <> '{}'::jsonb then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'booking.edited', 'bookings', new.ref, v_changed);
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------- settings

create or replace function public.log_settings_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.value is distinct from new.value then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'settings.updated', 'settings', new.key,
            jsonb_build_object('before', old.value, 'after', new.value));
  end if;
  return new;
end;
$$;

drop trigger if exists audit_settings on public.settings;
create trigger audit_settings
  after update on public.settings
  for each row execute function public.log_settings_change();

-- --------------------------------------------------------------- chalets

create or replace function public.log_chalet_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_changed jsonb := '{}'::jsonb;
begin
  if old.active is distinct from new.active then
    v_changed := v_changed || jsonb_build_object(
      'active', jsonb_build_array(old.active, new.active));
  end if;
  if old.name_en is distinct from new.name_en then
    v_changed := v_changed || jsonb_build_object(
      'name_en', jsonb_build_array(old.name_en, new.name_en));
  end if;
  if old.name_ar is distinct from new.name_ar then
    v_changed := v_changed || jsonb_build_object(
      'name_ar', jsonb_build_array(old.name_ar, new.name_ar));
  end if;
  if old.sort_order is distinct from new.sort_order then
    v_changed := v_changed || jsonb_build_object(
      'sort_order', jsonb_build_array(old.sort_order, new.sort_order));
  end if;

  if v_changed <> '{}'::jsonb then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'chalet.updated', 'chalets', new.id::text, v_changed);
  end if;
  return new;
end;
$$;

drop trigger if exists audit_chalets on public.chalets;
create trigger audit_chalets
  after update on public.chalets
  for each row execute function public.log_chalet_change();
