-- ============================================================================
-- Part 16 of 16: insurance_deposit
--
-- Paste this whole file into the Supabase SQL editor and Run, then move on
-- to the next part. Run them in order; each one is safe to run twice.
-- ============================================================================

-- ============================================================================
-- A refundable insurance deposit on every stay.
--
-- The guest now pays the stay plus a fixed deposit (100 KD to start with),
-- returned in full once the stay is over. It is kept apart from the price:
--
--   bookings.total    what the stay costs, as before -- revenue, the admin's
--                     overrides and every existing figure keep their meaning
--   bookings.deposit  the refundable deposit on top, recorded per booking so
--                     a later change to the amount never rewrites an old one
--
-- What the guest is asked for is total + deposit, and every place that shows
-- them a price (the booking page, the confirmation, the lookup, the emails)
-- shows that sum with the deposit named in it.
--
-- The amount is one row in settings, so the owner can change it from the
-- dashboard and the booking page reads the same number the database records.
-- New rows pick it up through the column default, which is why neither
-- request_booking() nor admin_create_booking() had to be restated. Rows that
-- existed before this migration were booked without a deposit and keep 0.
-- ============================================================================

insert into public.settings (key, value)
values ('insurance_deposit', '100'::jsonb)
on conflict (key) do nothing;

/**
 * The deposit a new booking carries, from settings.insurance_deposit.
 *
 * A column default runs on every insert, so this must never fail one: a
 * value that is not a non-negative number (a typo, a string, a null) falls
 * back to 100 rather than refusing the booking.
 */
create or replace function public.insurance_deposit()
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- CASE, not AND: Postgres may evaluate an AND in either order, and the cast
  -- must only ever see a number. CASE tests its branches in turn.
  select coalesce(
    (select case
              when jsonb_typeof(s.value) <> 'number' then null
              when (s.value #>> '{}')::numeric < 0 then null
              else round((s.value #>> '{}')::numeric, 3)
            end
       from public.settings s
      where s.key = 'insurance_deposit'),
    100
  );
$$;

comment on function public.insurance_deposit() is
  'The refundable deposit a new booking carries (settings.insurance_deposit, default 100).';

grant execute on function public.insurance_deposit() to anon, authenticated;

-- Existing rows first, at 0; then new rows take the setting.
alter table public.bookings
  add column if not exists deposit numeric(10,3) not null default 0;
alter table public.bookings drop constraint if exists bookings_deposit_check;
alter table public.bookings add constraint bookings_deposit_check check (deposit >= 0);
alter table public.bookings alter column deposit set default public.insurance_deposit();

comment on column public.bookings.deposit is
  'Refundable insurance deposit on top of total. The guest pays total + deposit.';

-- ------------------------------------------------------------- the lookups

-- The guest's own lookup shows what they pay, so it needs the deposit too. A
-- function's result columns cannot be changed in place, hence drop and
-- create. The bodies are the previous ones with deposit added; the deposit is
-- the same for everyone, so it widens the deliberate exposure by nothing.
drop function if exists public.lookup_booking_by_ref(text);
drop function if exists public.lookup_booking_by_email(text);
drop function if exists public.lookup_booking_by_phone(text);

create function public.lookup_booking_by_ref(p_ref text)
returns table (
  ref text, status public.booking_status, chalet_id smallint,
  start_date date, end_date date, days integer, total numeric, currency text,
  deposit numeric
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_ref text := upper(btrim(coalesce(p_ref, '')));
begin
  if v_ref = '' then
    raise exception 'Please enter your booking reference' using errcode = 'P0001';
  end if;

  -- Tighter than the others: a reference is guessable in a way an address is
  -- not, so repeated tries at one are worth slowing down harder.
  perform public.note_lookup('ref', v_ref, 10);

  return query
    select b.ref, b.status, b.chalet_id, b.start_date, b.end_date,
           b.days, b.total, b.currency, b.deposit
    from public.bookings b
    where b.ref = v_ref;
end;
$$;

create function public.lookup_booking_by_email(p_email text)
returns table (
  ref text, status public.booking_status, chalet_id smallint,
  start_date date, end_date date, days integer, total numeric, currency text,
  deposit numeric
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_email !~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    raise exception 'Please enter a valid email address' using errcode = 'P0001';
  end if;

  perform public.note_lookup('email', v_email, 20);

  return query
    select b.ref, b.status, b.chalet_id, b.start_date, b.end_date,
           b.days, b.total, b.currency, b.deposit
    from public.bookings b
    where lower(b.guest_email) = v_email
    order by b.created_at desc
    limit 5;
end;
$$;

create function public.lookup_booking_by_phone(p_phone text)
returns table (
  ref text, status public.booking_status, chalet_id smallint,
  start_date date, end_date date, days integer, total numeric, currency text,
  deposit numeric
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_tail text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 8);
begin
  if length(v_tail) < 8 then
    raise exception 'Please enter a valid phone number' using errcode = 'P0001';
  end if;

  perform public.note_lookup('phone', v_tail, 20);

  return query
    select b.ref, b.status, b.chalet_id, b.start_date, b.end_date,
           b.days, b.total, b.currency, b.deposit
    from public.bookings b
    where right(regexp_replace(b.guest_phone, '\D', '', 'g'), 8) = v_tail
    order by b.created_at desc
    limit 5;
end;
$$;

revoke all on function public.lookup_booking_by_ref(text)   from public;
revoke all on function public.lookup_booking_by_email(text) from public;
revoke all on function public.lookup_booking_by_phone(text) from public;

grant execute on function public.lookup_booking_by_ref(text)   to anon, authenticated;
grant execute on function public.lookup_booking_by_email(text) to anon, authenticated;
grant execute on function public.lookup_booking_by_phone(text) to anon, authenticated;

-- Deposit edits from the dashboard belong in the activity log with the rest.
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
  if old.deposit is distinct from new.deposit then
    v_changed := v_changed || jsonb_build_object(
      'deposit', jsonb_build_array(old.deposit, new.deposit));
  end if;

  if v_changed <> '{}'::jsonb then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'booking.edited', 'bookings', new.ref, v_changed);
  end if;

  return new;
end;
$$;
