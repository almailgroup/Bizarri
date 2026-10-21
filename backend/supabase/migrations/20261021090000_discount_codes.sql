-- ============================================================================
-- Discount codes.
--
-- The admin makes a code -- a percentage or an amount off the stay -- and
-- decides how often it may be used: once, a set number of times, or without
-- limit, until an optional last day. A guest who enters one pays the stay
-- less the discount, and no insurance deposit: with a code, the price is the
-- chalet alone.
--
-- A use is a booking that carries the code and is pending or accepted. One
-- that is rejected or cancelled gives its use back, so a one-time code
-- turned down by the admin can still be used. Counted, not kept in a column
-- that could drift from the bookings it is supposed to describe.
--
-- Each booking keeps what it was given -- the code as typed, the amount
-- taken off, and the percentage if it was one -- so editing or deleting the
-- code afterwards changes nothing already booked.
--
-- The code is checked twice: by check_discount_code(), which the booking page
-- asks so the guest sees the discount before sending, and by request_booking(),
-- which is what decides. Guests cannot read the codes; checking one is
-- throttled per address so they cannot be guessed by trying them all.
-- ============================================================================

create table if not exists public.discount_codes (
  id         uuid primary key default gen_random_uuid(),
  code       text not null,
  kind       text not null default 'percent',
  value      numeric(10,3) not null,
  max_uses   integer,
  expires_on date,
  note       text not null default '',
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  constraint discount_codes_code_format check (code ~ '^[A-Z0-9_-]{3,32}$'),
  constraint discount_codes_kind check (kind in ('percent', 'amount')),
  constraint discount_codes_value check (
    value >= 0 and (kind <> 'percent' or value <= 100)),
  constraint discount_codes_max_uses check (max_uses is null or max_uses >= 1)
);

create unique index if not exists discount_codes_code_key on public.discount_codes (code);

comment on table public.discount_codes is
  'Codes a guest can enter at booking: kind percent (value 0-100) or amount '
  '(KD off the stay). max_uses null is unlimited. A booking with a code pays '
  'no insurance deposit.';

drop trigger if exists touch_discount_codes on public.discount_codes;
create trigger touch_discount_codes before update on public.discount_codes
  for each row execute function public.touch_updated_at();

-- What a booking was given. total is what the stay costs after the discount;
-- total + discount is what it would have cost without it.
alter table public.bookings
  add column if not exists discount         numeric(10,3) not null default 0,
  add column if not exists discount_code    text,
  add column if not exists discount_code_id uuid references public.discount_codes (id)
                                            on delete set null,
  add column if not exists discount_percent numeric(6,3);

alter table public.bookings drop constraint if exists bookings_discount_nonnegative;
alter table public.bookings add constraint bookings_discount_nonnegative check (discount >= 0);

create index if not exists bookings_discount_code_idx
  on public.bookings (discount_code_id) where discount_code_id is not null;

-- ------------------------------------------------------------------- RLS

alter table public.discount_codes enable row level security;

drop policy if exists discount_codes_admin on public.discount_codes;
create policy discount_codes_admin on public.discount_codes
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.discount_codes from anon;
grant select, insert, update, delete on public.discount_codes to authenticated;

-- ------------------------------------------------------------- the rules

/** Bookings holding a use of the code: pending or accepted. */
create or replace function public.discount_code_uses(p_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer from public.bookings b
  where b.discount_code_id = p_id and b.status in ('pending', 'accepted');
$$;

/** The amount a code takes off a stay: never more than the stay itself. */
create or replace function public.discount_amount(p_total numeric, p_kind text, p_value numeric)
returns numeric
language sql
immutable
as $$
  select least(p_total, case when p_kind = 'percent'
                             then round(p_total * p_value / 100, 3)
                             else p_value end);
$$;

/**
 * Why a code cannot be used today, or null if it can. Shared by the check the
 * booking page makes and by request_booking(), so the two never disagree.
 */
create or replace function public.discount_code_problem(p_code public.discount_codes)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_code.id is null or not p_code.active then
    return 'invalid';
  end if;
  if p_code.expires_on is not null and public.local_today() > p_code.expires_on then
    return 'expired';
  end if;
  if p_code.max_uses is not null and public.discount_code_uses(p_code.id) >= p_code.max_uses then
    return 'used';
  end if;
  return null;
end;
$$;

/**
 * The booking page asks this when a guest presses Apply. It says whether the
 * code can be used and what it gives, and nothing about any other code.
 *
 * Returns a row rather than raising, so that a miss is recorded: a raise
 * would roll the record back with it. Misses are counted per address (the
 * X-Forwarded-For that PostgREST passes on), twenty an hour, which is plenty
 * for typos and far too few to guess a code by trying them.
 */
create or replace function public.check_discount_code(p_code text)
returns table (valid boolean, reason text, code text, kind text, value numeric)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_code    public.discount_codes;
  v_who     text;
  v_misses  integer;
  v_problem text;
begin
  begin
    v_who := nullif(btrim(split_part(
      current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1)), '');
  exception when others then
    v_who := null;
  end;
  v_who := coalesce(v_who, 'unknown');

  delete from public.lookup_throttle where at < now() - interval '1 day';
  select count(*) into v_misses from public.lookup_throttle t
   where t.kind = 'discount_miss' and t.subject = v_who and t.at > now() - interval '1 hour';
  if v_misses >= 20 then
    return query select false, 'throttled'::text, null::text, null::text, null::numeric;
    return;
  end if;

  select * into v_code from public.discount_codes d
   where d.code = upper(btrim(coalesce(p_code, '')));
  v_problem := public.discount_code_problem(v_code);

  if v_problem = 'invalid' then
    insert into public.lookup_throttle (kind, subject) values ('discount_miss', v_who);
    return query select false, 'invalid'::text, null::text, null::text, null::numeric;
    return;
  end if;
  if v_problem is not null then
    return query select false, v_problem, v_code.code, null::text, null::numeric;
    return;
  end if;

  return query select true, null::text, v_code.code, v_code.kind, v_code.value;
end;
$$;

revoke all on function public.discount_code_uses(uuid) from public;
revoke all on function public.discount_amount(numeric, text, numeric) from public;
revoke all on function public.discount_code_problem(public.discount_codes) from public;
revoke all on function public.check_discount_code(text) from public;
grant execute on function public.check_discount_code(text) to anon, authenticated;

-- ------------------------------------------------------------ request_booking
--
-- Restated from 20261001090000 with the code at the end: checked under a lock
-- on its row, so two guests sending the last use of a code at the same
-- moment cannot both have it; the second waits, counts the first, and is
-- told the code has been used. A new parameter means a new signature, so the
-- old one goes first rather than living on beside it as an overload.

drop function if exists public.request_booking(
  smallint, date, date, text, text, text, smallint, text, text, boolean, text);

create or replace function public.request_booking(
  p_chalet_id      smallint,
  p_start          date,
  p_end            date,
  p_guest_name     text,
  p_guest_phone    text,
  p_guest_email    text,
  p_guests         smallint,
  p_notes          text default null,
  p_civil_id_path  text default null,
  p_terms_accepted boolean default false,
  p_lang           text default 'en',
  p_discount_code  text default null
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_min      smallint;
  v_quote    record;
  v_booking  public.bookings;
  v_recent   integer;
  v_civil    text := nullif(btrim(coalesce(p_civil_id_path, '')), '');
  v_wanted   text := nullif(upper(btrim(coalesce(p_discount_code, ''))), '');
  v_code     public.discount_codes;
  v_problem  text;
  v_discount numeric := 0;
begin
  -- Order matters: check the range is coherent before measuring its length,
  -- otherwise a reversed range reports "minimum stay" and confuses the guest.
  if p_start is null or p_end is null then
    raise exception 'Please choose your dates' using errcode = 'P0001';
  end if;
  if p_end < p_start then
    raise exception 'The check-out date must be on or after the check-in date'
      using errcode = 'P0001';
  end if;

  select min_stay_days into v_min from public.rates where id limit 1;
  v_min := coalesce(v_min, 3);
  if p_end - p_start + 1 < v_min then
    raise exception 'Minimum stay is % days', v_min using errcode = 'P0001';
  end if;

  -- Thu-Sat is one product. A range that takes part of a weekend is refused
  -- rather than quietly repriced, because there is no honest price for half
  -- of something sold whole.
  if not public.weekend_is_whole(p_start, p_end) then
    raise exception 'A weekend is booked Thursday to Saturday. Please include all three days.'
      using errcode = 'P0001';
  end if;

  if p_guests is null or p_guests < 1 or p_guests > 20 then
    raise exception 'Please enter between 1 and 20 guests' using errcode = 'P0001';
  end if;

  if length(btrim(coalesce(p_guest_name, ''))) < 2 then
    raise exception 'Please enter your full name' using errcode = 'P0001';
  end if;
  if length(regexp_replace(coalesce(p_guest_phone, ''), '\D', '', 'g')) < 8 then
    raise exception 'Please enter a valid phone number' using errcode = 'P0001';
  end if;
  -- Validate the TRIMMED value: the row is stored trimmed, and pasted
  -- addresses routinely carry surrounding whitespace.
  if btrim(coalesce(p_guest_email, '')) !~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    raise exception 'Please enter a valid email address' using errcode = 'P0001';
  end if;

  -- The form asks for the code, but the form is not the security boundary.
  -- Gated on a setting because it puts mail delivery on the critical path of
  -- every booking: if Resend breaks, this is the switch that keeps the site
  -- open. Missing key means on, so a fresh database is strict by default.
  if coalesce(
       (select value = 'true'::jsonb from public.settings
         where key = 'require_email_verification'),
       true)
     and not public.is_email_verified(p_guest_email) then
    raise exception 'Please confirm your email address with the code we sent you.'
      using errcode = 'P0001';
  end if;

  if not coalesce(p_terms_accepted, false) then
    raise exception 'Please accept the terms and regulations to continue.'
      using errcode = 'P0001';
  end if;

  if v_civil is null then
    raise exception 'A Civil ID image is required to complete the booking.'
      using errcode = 'P0001';
  end if;

  -- The bucket's own policies decide what may be stored; this only keeps a
  -- caller from writing an arbitrary string into the column.
  if length(v_civil) > 300 or v_civil !~ '^[A-Za-z0-9._/-]+$' then
    raise exception 'That Civil ID upload is not valid. Please attach it again.'
      using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.chalets c where c.id = p_chalet_id and c.active) then
    raise exception 'Unknown chalet' using errcode = 'P0002';
  end if;

  if not public.is_range_available(p_chalet_id, p_start, p_end) then
    raise exception 'Those dates are no longer available' using errcode = 'P0001';
  end if;

  -- Light abuse guard: one email cannot flood the queue.
  select count(*) into v_recent
  from public.bookings b
  where lower(b.guest_email) = lower(btrim(p_guest_email))
    and b.created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'Too many requests. Please contact us directly.' using errcode = 'P0001';
  end if;

  select * into v_quote from public.quote_stay(p_chalet_id, p_start, p_end);

  if v_wanted is not null then
    select * into v_code from public.discount_codes d where d.code = v_wanted for update;
    v_problem := public.discount_code_problem(v_code);
    if v_problem = 'invalid' then
      raise exception 'That discount code is not valid.' using errcode = 'P0001';
    elsif v_problem = 'expired' then
      raise exception 'That discount code has expired.' using errcode = 'P0001';
    elsif v_problem = 'used' then
      raise exception 'That discount code has already been used.' using errcode = 'P0001';
    end if;
    v_discount := public.discount_amount(v_quote.total, v_code.kind, v_code.value);
  end if;

  insert into public.bookings (
    ref, chalet_id, start_date, end_date, total, package_key,
    guest_name, guest_phone, guest_email, guests, notes, status,
    civil_id_path, terms_accepted_at, lang,
    discount, discount_code, discount_code_id, discount_percent, deposit
  ) values (
    public.generate_booking_ref(), p_chalet_id, p_start, p_end,
    v_quote.total - v_discount, v_quote.package_key,
    btrim(p_guest_name), btrim(p_guest_phone), lower(btrim(p_guest_email)),
    p_guests, nullif(btrim(coalesce(p_notes, '')), ''), 'pending',
    v_civil, now(),
    case when lower(coalesce(p_lang, 'en')) = 'ar' then 'ar' else 'en' end,
    v_discount, v_code.code, v_code.id,
    case when v_code.kind = 'percent' then v_code.value end,
    -- With a code, the price is the chalet alone: no insurance deposit.
    case when v_code.id is not null then 0 else public.insurance_deposit() end
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.request_booking(
  smallint, date, date, text, text, text, smallint, text, text, boolean, text, text) from public;
grant execute on function public.request_booking(
  smallint, date, date, text, text, text, smallint, text, text, boolean, text, text)
  to anon, authenticated;

-- ------------------------------------------------------- admin_update_booking
--
-- Restated from 20261018090000 so that repricing a moved booking keeps the
-- discount it was given: the same percentage of the new price, or the same
-- amount (never more than the price). Everything else is as it was.

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
  v_booking  public.bookings;
  v_quote    record;
  v_total    numeric;
  v_package  text;
  v_discount numeric;
  v_clash    text;
  v_closed   date;
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
  v_discount := v_booking.discount;
  if coalesce(p_reprice, false) then
    select * into v_quote from public.quote_stay(p_chalet_id, p_start, p_end);
    v_package := v_quote.package_key;
    v_discount := case
      when v_booking.discount_percent is not null
        then public.discount_amount(v_quote.total, 'percent', v_booking.discount_percent)
      else least(v_booking.discount, v_quote.total)
    end;
    v_total := v_quote.total - v_discount;
  end if;

  update public.bookings
     set chalet_id   = p_chalet_id,
         start_date  = p_start,
         end_date    = p_end,
         total       = v_total,
         package_key = v_package,
         discount    = v_discount
   where id = p_id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.admin_update_booking(uuid, smallint, date, date, boolean)
  from public, anon;
grant execute on function public.admin_update_booking(uuid, smallint, date, date, boolean)
  to authenticated;

-- ------------------------------------------------------------- activity log

create or replace function public.log_discount_code_change()
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
    values (auth.uid(), 'discount.created', 'discount_codes', new.code,
            jsonb_build_object('kind', new.kind, 'value', new.value,
                               'max_uses', new.max_uses, 'expires_on', new.expires_on));
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'discount.deleted', 'discount_codes', old.code, '{}'::jsonb);
    return old;
  end if;

  if old.code is distinct from new.code then
    v_changed := v_changed || jsonb_build_object('code', jsonb_build_array(old.code, new.code));
  end if;
  if old.kind is distinct from new.kind then
    v_changed := v_changed || jsonb_build_object('kind', jsonb_build_array(old.kind, new.kind));
  end if;
  if old.value is distinct from new.value then
    v_changed := v_changed || jsonb_build_object('value', jsonb_build_array(old.value, new.value));
  end if;
  if old.max_uses is distinct from new.max_uses then
    v_changed := v_changed || jsonb_build_object('max_uses', jsonb_build_array(old.max_uses, new.max_uses));
  end if;
  if old.expires_on is distinct from new.expires_on then
    v_changed := v_changed || jsonb_build_object('expires_on', jsonb_build_array(old.expires_on, new.expires_on));
  end if;
  if old.note is distinct from new.note then
    v_changed := v_changed || jsonb_build_object('note', jsonb_build_array(old.note, new.note));
  end if;
  if old.active is distinct from new.active then
    v_changed := v_changed || jsonb_build_object('active', jsonb_build_array(old.active, new.active));
  end if;

  if v_changed <> '{}'::jsonb then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'discount.updated', 'discount_codes', new.code, v_changed);
  end if;
  return new;
end;
$$;

drop trigger if exists audit_discount_codes on public.discount_codes;
create trigger audit_discount_codes
  after insert or update or delete on public.discount_codes
  for each row execute function public.log_discount_code_change();

-- A booking made with a code says so in its "created" entry, and a change to
-- its discount is an edit like any other. Restated from 20261018090000.
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
                               'end', new.end_date, 'total', new.total)
            || case when new.discount_code is not null
                    then jsonb_build_object('code', new.discount_code, 'discount', new.discount)
                    else '{}'::jsonb end);
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
  if old.discount is distinct from new.discount then
    v_changed := v_changed || jsonb_build_object(
      'discount', jsonb_build_array(old.discount, new.discount));
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
