-- ============================================================================
-- Part 18 of 18: admin_edit_booking_stay
--
-- Paste this whole file into the Supabase SQL editor and Run, then move on
-- to the next part. Run them in order; each one is safe to run twice.
-- ============================================================================

-- ============================================================================
-- An admin can move a booking: other dates, or the other chalet.
--
-- The edit form changed everything about a booking except when and where it
-- was, because moving a stay needs the same checks as making one -- an
-- accepted booking may not land on another accepted one or on a day the
-- admin closed -- and a plain column update would have skipped them. A guest
-- who rang to move their weekend had to be cancelled and booked again, under
-- a new reference, with the history split across two rows.
--
-- admin_update_booking() is that move. It keeps the reference, checks the new
-- dates the way admin_create_booking() checks new ones (an accepted booking
-- only: a pending one holds nothing an overlap could break), and either keeps
-- the price as it was or prices the new dates from the rates.
--
-- Past dates are allowed here, unlike on a new booking: correcting the record
-- of a stay that has already happened is a legitimate edit.
--
-- The activity log learns the fields this can change, so a moved booking says
-- where it moved from.
-- ============================================================================

create or replace function public.admin_update_booking(
  p_id        uuid,
  p_chalet_id smallint,
  p_start     date,
  p_end       date,
  p_reprice   boolean default false
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_booking public.bookings;
  v_quote   record;
  v_total   numeric;
  v_package text;
  v_clash   text;
  v_closed  date;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if p_start is null or p_end is null then
    raise exception 'Please choose the check-in and check-out dates' using errcode = 'P0001';
  end if;
  if p_end < p_start then
    raise exception 'The last night must be on or after the check-in date'
      using errcode = 'P0001';
  end if;
  if p_end - p_start + 1 > 90 then
    raise exception 'A booking can be at most 90 days long' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.chalets c where c.id = p_chalet_id) then
    raise exception 'Unknown chalet' using errcode = 'P0002';
  end if;

  if v_booking.status = 'accepted' then
    select b.ref into v_clash
    from public.bookings b
    where b.id <> p_id
      and b.chalet_id = p_chalet_id
      and b.status = 'accepted'
      and daterange(b.start_date, b.end_date, '[]') && daterange(p_start, p_end, '[]')
    limit 1;
    if v_clash is not null then
      raise exception 'Those dates are already held by booking %', v_clash using errcode = 'P0001';
    end if;

    select min(d.day) into v_closed
    from public.blocked_dates d
    where d.chalet_id = p_chalet_id and d.day between p_start and p_end;
    if v_closed is not null then
      raise exception 'Those dates include % which is marked unavailable. Make it available first.',
        to_char(v_closed, 'Dy DD Mon YYYY') using errcode = 'P0001';
    end if;
  end if;

  -- The price as it was, unless the admin asked for the new dates' price.
  v_total := v_booking.total;
  v_package := v_booking.package_key;
  if coalesce(p_reprice, false) then
    select * into v_quote from public.quote_stay(p_chalet_id, p_start, p_end);
    v_total := v_quote.total;
    v_package := v_quote.package_key;
  end if;

  update public.bookings
     set chalet_id   = p_chalet_id,
         start_date  = p_start,
         end_date    = p_end,
         total       = v_total,
         package_key = v_package
   where id = p_id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.admin_update_booking(uuid, smallint, date, date, boolean)
  from public, anon;
grant execute on function public.admin_update_booking(uuid, smallint, date, date, boolean)
  to authenticated;

-- The activity log, restated with the fields an admin can now change: the
-- chalet, the dates and the email language join the ones it already kept.
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

  -- Field-level edits from the admin panel. Each changed column is recorded
  -- as [old, new]; unchanged columns are omitted so the entry stays readable.
  if old.chalet_id is distinct from new.chalet_id then
    v_changed := v_changed || jsonb_build_object(
      'chalet', jsonb_build_array(old.chalet_id, new.chalet_id));
  end if;
  if old.start_date is distinct from new.start_date then
    v_changed := v_changed || jsonb_build_object(
      'start_date', jsonb_build_array(old.start_date, new.start_date));
  end if;
  if old.end_date is distinct from new.end_date then
    v_changed := v_changed || jsonb_build_object(
      'end_date', jsonb_build_array(old.end_date, new.end_date));
  end if;
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
  if old.deposit is distinct from new.deposit then
    v_changed := v_changed || jsonb_build_object(
      'deposit', jsonb_build_array(old.deposit, new.deposit));
  end if;
  if old.lang is distinct from new.lang then
    v_changed := v_changed || jsonb_build_object(
      'lang', jsonb_build_array(old.lang, new.lang));
  end if;

  if v_changed <> '{}'::jsonb then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'booking.edited', 'bookings', new.ref, v_changed);
  end if;

  return new;
end;
$$;
