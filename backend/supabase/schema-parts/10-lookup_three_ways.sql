-- ============================================================================
-- Part 10 of 14: lookup_three_ways
--
-- Paste this whole file into the Supabase SQL editor and Run, then move on
-- to the next part. Run them in order; each one is safe to run twice.
-- ============================================================================

-- ============================================================================
-- Three ways to find a booking: the reference, the email, or the phone.
--
-- A guest who has lost one of the three still has the other two. Each is a
-- single field — asking for two makes the "I have lost it" case worse, which
-- is the only case this page exists for.
--
-- The throttle is shared rather than per-function, so a new way in cannot
-- ship without one. It is generalised from the phone-only table the previous
-- migration added; throttle rows are disposable, so that one is dropped.
-- ============================================================================

drop table if exists public.lookup_attempts;

create table if not exists public.lookup_throttle (
  id      bigserial primary key,
  kind    text not null,
  subject text not null,
  at      timestamptz not null default now()
);

comment on table public.lookup_throttle is
  'Rate limiting for the booking lookups. subject is the thing being looked '
  'up, never more of it than the match needs: the last 8 digits of a phone, '
  'not the whole number.';

create index if not exists lookup_throttle_recent_idx
  on public.lookup_throttle (kind, subject, at desc);

alter table public.lookup_throttle enable row level security;

/**
 * Record one attempt and refuse when there have been too many.
 *
 * Not granted to anon: the lookups below are SECURITY DEFINER, so they call
 * this as the owner. A guest able to call it directly could fill the table.
 */
create or replace function public.note_lookup(
  p_kind    text,
  p_subject text,
  p_cap     integer default 20
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_recent integer;
begin
  delete from public.lookup_throttle where at < now() - interval '1 day';

  select count(*) into v_recent
  from public.lookup_throttle t
  where t.kind = p_kind and t.subject = p_subject and t.at > now() - interval '1 hour';

  if v_recent >= p_cap then
    raise exception 'Too many lookups. Please try again later.' using errcode = 'P0001';
  end if;

  insert into public.lookup_throttle (kind, subject) values (p_kind, p_subject);
end;
$$;

-- ---------------------------------------------------------------- by reference

/**
 * The reference is the one thing a guest was given that nobody else knows,
 * so it stands on its own — the same way a parcel tracking number does.
 */
create or replace function public.lookup_booking_by_ref(p_ref text)
returns table (
  ref text, status public.booking_status, chalet_id smallint,
  start_date date, end_date date, days integer, total numeric, currency text
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
           b.days, b.total, b.currency
    from public.bookings b
    where b.ref = v_ref;
end;
$$;

-- -------------------------------------------------------------------- by email

/**
 * DELIBERATE EXPOSURE, the same trade as the phone lookup: anyone who knows
 * an address can see what it has booked. Chosen so a guest who has lost the
 * reference is not stuck. Do not widen the returned columns without
 * revisiting that.
 */
create or replace function public.lookup_booking_by_email(p_email text)
returns table (
  ref text, status public.booking_status, chalet_id smallint,
  start_date date, end_date date, days integer, total numeric, currency text
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
           b.days, b.total, b.currency
    from public.bookings b
    where lower(b.guest_email) = v_email
    order by b.created_at desc
    limit 5;
end;
$$;

-- -------------------------------------------------------------------- by phone

-- Restated against the shared throttle; the matching rule is unchanged.
create or replace function public.lookup_booking_by_phone(p_phone text)
returns table (
  ref text, status public.booking_status, chalet_id smallint,
  start_date date, end_date date, days integer, total numeric, currency text
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
           b.days, b.total, b.currency
    from public.bookings b
    where right(regexp_replace(b.guest_phone, '\D', '', 'g'), 8) = v_tail
    order by b.created_at desc
    limit 5;
end;
$$;

-- --------------------------------------------------------------------- grants

revoke all on function public.note_lookup(text, text, integer)   from public;
revoke all on function public.lookup_booking_by_ref(text)        from public;
revoke all on function public.lookup_booking_by_email(text)      from public;
revoke all on function public.lookup_booking_by_phone(text)      from public;

grant execute on function public.lookup_booking_by_ref(text)     to anon, authenticated;
grant execute on function public.lookup_booking_by_email(text)   to anon, authenticated;
grant execute on function public.lookup_booking_by_phone(text)   to anon, authenticated;
