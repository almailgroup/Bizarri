-- ============================================================================
-- Part 8 of 16: email_verification_and_phone_lookup
--
-- Paste this whole file into the Supabase SQL editor and Run, then move on
-- to the next part. Run them in order; each one is safe to run twice.
-- ============================================================================

-- ============================================================================
-- Proving the guest owns the email address, emailing them their reference, and
-- letting them find a booking again with just their phone number.
--
-- Three connected changes:
--
--   1. A one-time code, mailed to the address the guest typed, which they must
--      enter before request_booking() will accept it. A mistyped address used
--      to fail silently: the booking went through, the confirmation bounced,
--      and nobody found out until the guest called.
--
--   2. lookup_booking_by_phone(), so a returning guest who has lost the
--      reference can still find their stay.
--
--   3. A settings switch for (1), because it puts email delivery on the
--      critical path of every booking. If Resend is misconfigured, flipping
--      require_email_verification to false keeps the site taking bookings.
-- ============================================================================

-- --------------------------------------------------------- email verification

create table if not exists public.email_verifications (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  salt       text not null,
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   smallint not null default 0,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.email_verifications is
  'One-time email codes. Only the salted SHA-256 of the code is stored; the '
  'plaintext exists for the length of one function call, long enough to be '
  'handed to the mailer.';

create index if not exists email_verifications_email_idx
  on public.email_verifications (lower(email), created_at desc);

-- No policies at all. Every path in and out is a SECURITY DEFINER function
-- below, so a guest can neither read a hash nor write one they already know.
alter table public.email_verifications enable row level security;

/**
 * Mint a code and return it to the caller to deliver.
 *
 * Returning the plaintext is the whole point, and the reason this is granted
 * to service_role only: the Edge Function that sends the mail is the sole
 * caller. If anon could call it, a guest could mint a code for any address,
 * read it straight out of the response, and "verify" an address they do not
 * own — which is exactly what this is meant to prevent.
 */
create or replace function public.start_email_verification(p_email text)
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_code   text;
  v_salt   text;
  v_recent integer;
begin
  if v_email !~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    raise exception 'Please enter a valid email address' using errcode = 'P0001';
  end if;

  select count(*) into v_recent
  from public.email_verifications v
  where lower(v.email) = v_email
    and v.created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'Too many codes requested. Please try again later.'
      using errcode = 'P0001';
  end if;

  -- gen_random_bytes, not random(): this is an authentication code, and
  -- random() is seeded predictably enough to guess a sequence of them.
  v_code := lpad((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint
                  % 1000000)::text, 6, '0');
  v_salt := encode(gen_random_bytes(16), 'hex');

  insert into public.email_verifications (email, salt, code_hash, expires_at)
  values (v_email, v_salt,
          encode(digest(v_salt || v_code, 'sha256'), 'hex'),
          now() + interval '10 minutes');

  return v_code;
end;
$$;

/**
 * Check a code the guest typed.
 *
 * A wrong code RETURNS FALSE rather than raising, and that is load-bearing.
 * Raising would roll the statement back — including the attempts increment
 * made two lines earlier — so the counter would never advance and the cap
 * below would never fire, leaving a six-digit code open to being guessed.
 * The caller words the message; only this function knows the count is real.
 */
create or replace function public.verify_email_code(p_email text, p_code text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_code  text := btrim(coalesce(p_code, ''));
  v_row   public.email_verifications%rowtype;
begin
  -- Only the newest outstanding code counts. Asking for a second code should
  -- retire the first, or a guest who requests three and reads the oldest mail
  -- gets a confusing failure.
  select * into v_row
  from public.email_verifications v
  where lower(v.email) = v_email
    and v.verified_at is null
  order by v.created_at desc
  limit 1
  for update;

  if not found or v_row.expires_at <= now() then
    raise exception 'That code has expired. Please request a new one.'
      using errcode = 'P0001';
  end if;

  if v_row.attempts >= 5 then
    raise exception 'Too many attempts. Please request a new code.'
      using errcode = 'P0001';
  end if;

  update public.email_verifications
     set attempts = attempts + 1
   where id = v_row.id;

  if encode(digest(v_row.salt || v_code, 'sha256'), 'hex') <> v_row.code_hash then
    return false;
  end if;

  update public.email_verifications
     set verified_at = now()
   where id = v_row.id;

  return true;
end;
$$;

/**
 * Was this address proved recently? The window is long enough to finish the
 * form and short enough that a verification cannot be banked for later.
 */
create or replace function public.is_email_verified(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.email_verifications v
    where lower(v.email) = lower(btrim(coalesce(p_email, '')))
      and v.verified_at > now() - interval '1 hour'
  );
$$;

-- ------------------------------------------------------------- phone lookup

create table if not exists public.lookup_attempts (
  id         bigserial primary key,
  phone_tail text not null,
  at         timestamptz not null default now()
);

comment on table public.lookup_attempts is
  'Throttle for lookup_booking_by_phone. Holds the last 8 digits only, never '
  'a whole number.';

create index if not exists lookup_attempts_recent_idx
  on public.lookup_attempts (phone_tail, at desc);

alter table public.lookup_attempts enable row level security;

/**
 * Find a booking from the phone number alone.
 *
 * DELIBERATE EXPOSURE, chosen by the owner: unlike lookup_booking(), this
 * asks for nothing the guest has to have been told. Anyone who knows a
 * number can see whether it has a stay booked, when, and for how much. The
 * throttle below slows repeated hits on one number; it does not make the
 * data private, and nothing here can. Do not widen the returned columns
 * without revisiting that trade.
 *
 * Matching is on the last 8 digits so +965 9404 0955, 96594040955 and
 * 94040955 are the same number, which is how guests actually type it.
 */
create or replace function public.lookup_booking_by_phone(p_phone text)
returns table (
  ref text, status public.booking_status, chalet_id smallint,
  start_date date, end_date date, days integer, total numeric, currency text
)
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_tail   text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 8);
  v_recent integer;
begin
  if length(v_tail) < 8 then
    raise exception 'Please enter a valid phone number' using errcode = 'P0001';
  end if;

  delete from public.lookup_attempts where at < now() - interval '1 day';

  select count(*) into v_recent
  from public.lookup_attempts a
  where a.phone_tail = v_tail and a.at > now() - interval '1 hour';
  if v_recent >= 20 then
    raise exception 'Too many lookups. Please try again later.' using errcode = 'P0001';
  end if;

  insert into public.lookup_attempts (phone_tail) values (v_tail);

  return query
    select b.ref, b.status, b.chalet_id, b.start_date, b.end_date,
           b.days, b.total, b.currency
    from public.bookings b
    where right(regexp_replace(b.guest_phone, '\D', '', 'g'), 8) = v_tail
    order by b.created_at desc
    limit 5;
end;
$$;

-- ------------------------------------------------------------ booking lang

-- The guest's copy of the confirmation is written in whichever language they
-- booked in; without this the notifier has no way to know which that was and
-- every Arabic guest gets an English email.
alter table public.bookings
  add column if not exists lang text not null default 'en';
alter table public.bookings drop constraint if exists bookings_lang_check;
alter table public.bookings add constraint bookings_lang_check check (lang in ('en', 'ar'));

-- --------------------------------------------------- request_booking, gated

-- The whole function is restated rather than patched, because Postgres has no
-- way to edit one. It is the previous body with the verification block added
-- after the email format check; nothing else about it changed.
drop function if exists public.request_booking(
  smallint, date, date, text, text, text, smallint, text, text, boolean);
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
  p_lang           text default 'en'
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

  insert into public.bookings (
    ref, chalet_id, start_date, end_date, total, package_key,
    guest_name, guest_phone, guest_email, guests, notes, status,
    civil_id_path, terms_accepted_at, lang
  ) values (
    public.generate_booking_ref(), p_chalet_id, p_start, p_end,
    v_quote.total, v_quote.package_key,
    btrim(p_guest_name), btrim(p_guest_phone), lower(btrim(p_guest_email)),
    p_guests, nullif(btrim(coalesce(p_notes, '')), ''), 'pending',
    v_civil, now(),
    case when lower(coalesce(p_lang, 'en')) = 'ar' then 'ar' else 'en' end
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

-- ------------------------------------------------------------------- settings

insert into public.settings (key, value) values
  ('require_email_verification', 'true'::jsonb)
on conflict (key) do nothing;

-- --------------------------------------------------------------------- grants

revoke all on function public.start_email_verification(text) from public;
revoke all on function public.verify_email_code(text, text)   from public;
revoke all on function public.is_email_verified(text)         from public;
revoke all on function public.lookup_booking_by_phone(text)   from public;
revoke all on function public.request_booking(
  smallint, date, date, text, text, text, smallint, text, text, boolean, text) from public;

grant execute on function public.verify_email_code(text, text)   to anon, authenticated;
grant execute on function public.lookup_booking_by_phone(text)   to anon, authenticated;
grant execute on function public.request_booking(
  smallint, date, date, text, text, text, smallint, text, text, boolean, text)
  to anon, authenticated;

-- start_email_verification hands back the plaintext code, so it goes to the
-- mailer and to nobody else. is_email_verified is not granted either: the
-- gate in request_booking is the only thing that needs to ask, and a guest
-- being able to probe which addresses have verified is an avoidable leak.
-- The role exists in Supabase but not in the local test harness, where the
-- suites call these as the owner instead.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.start_email_verification(text) to service_role;
    grant execute on function public.is_email_verified(text)        to service_role;
  end if;
end $$;
