-- ============================================================================
-- Part 21 of 21: discount_deposit_choice
--
-- Paste this whole file into the Supabase SQL editor and Run, then move on
-- to the next part. Run them in order; each one is safe to run twice.
-- ============================================================================

-- ============================================================================
-- Discount codes: the admin decides whether a code also waives the deposit.
--
-- Until now every code waived the refundable insurance deposit. Some codes are
-- meant only as money off the stay, with the deposit still taken, so each code
-- now says which: waives_deposit, true for every code that already exists, so
-- nothing changes for them until the admin says otherwise.
--
-- request_booking() reads it when it sets the deposit; check_discount_code()
-- returns it, so the booking page shows the guest the right total before they
-- send; the activity log records a change to it. Everything else is restated
-- exactly as 20261021090000 left it.
-- ============================================================================

alter table public.discount_codes
  add column if not exists waives_deposit boolean not null default true;

comment on column public.discount_codes.waives_deposit is
  'True: a booking with this code pays no insurance deposit. False: the code '
  'only takes money off the stay, and the deposit is charged as usual.';

-- ------------------------------------------------------- check_discount_code
-- A column more in its result, so it is replaced rather than edited.

drop function if exists public.check_discount_code(text);

create function public.check_discount_code(p_code text)
returns table (valid boolean, reason text, code text, kind text, value numeric,
               waives_deposit boolean)
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
    return query select false, 'throttled'::text, null::text, null::text, null::numeric, null::boolean;
    return;
  end if;

  select * into v_code from public.discount_codes d
   where d.code = upper(btrim(coalesce(p_code, '')));
  v_problem := public.discount_code_problem(v_code);

  if v_problem = 'invalid' then
    insert into public.lookup_throttle (kind, subject) values ('discount_miss', v_who);
    return query select false, 'invalid'::text, null::text, null::text, null::numeric, null::boolean;
    return;
  end if;
  if v_problem is not null then
    return query select false, v_problem, v_code.code, null::text, null::numeric, null::boolean;
    return;
  end if;

  return query select true, null::text, v_code.code, v_code.kind, v_code.value,
    v_code.waives_deposit;
end;
$$;

revoke all on function public.check_discount_code(text) from public;
grant execute on function public.check_discount_code(text) to anon, authenticated;

-- ------------------------------------------------------------ request_booking

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
    -- A code waives the insurance deposit unless the admin set it to keep it.
    case when v_code.id is not null and v_code.waives_deposit then 0
         else public.insurance_deposit() end
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
                               'max_uses', new.max_uses, 'expires_on', new.expires_on,
                               'waives_deposit', new.waives_deposit));
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
  if old.waives_deposit is distinct from new.waives_deposit then
    v_changed := v_changed || jsonb_build_object(
      'waives_deposit', jsonb_build_array(old.waives_deposit, new.waives_deposit));
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
