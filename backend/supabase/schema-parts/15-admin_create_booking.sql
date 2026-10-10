-- ============================================================================
-- Part 15 of 15: admin_create_booking
--
-- Paste this whole file into the Supabase SQL editor and Run, then move on
-- to the next part. Run them in order; each one is safe to run twice.
-- ============================================================================

-- ============================================================================
-- Bookings the admin enters by hand.
--
-- A booking taken over the phone or on WhatsApp used to have no way into the
-- system except the guest's own form, which asks for an emailed code, a Civil
-- ID photo and accepted terms -- none of which the admin has for someone they
-- are talking to. admin_create_booking() is the admin's door: the same
-- validation of who, when and how many, without the guest-only gates.
--
-- It is deliberately looser than request_booking() in two places, because the
-- admin is allowed to make exceptions a guest is not:
--   * no minimum stay, and
--   * a weekend need not be taken whole.
-- The price is still the server's (quote_stay), unless the admin types a
-- total of their own, which is recorded as given.
--
-- It is stricter in one: an accepted booking may not land on a day the admin
-- has marked unavailable. Those days are closed for a reason the admin chose,
-- and accepting a stay across them is more likely a slip than an intent.
--
-- Two columns say where a row came from and whether the guest should hear
-- about it, so the notifier can tell an admin's booking from a guest's
-- request: the team does not need an email about a booking they just typed
-- in, and a guest booked over the phone may not want one at all.
-- ============================================================================

alter table public.bookings
  add column if not exists source       text    not null default 'guest',
  add column if not exists notify_guest boolean not null default true;

alter table public.bookings drop constraint if exists bookings_source_check;
alter table public.bookings add constraint bookings_source_check
  check (source in ('guest', 'admin'));

comment on column public.bookings.source is
  'guest: requested on the site. admin: entered by an admin from the dashboard.';
comment on column public.bookings.notify_guest is
  'Whether the guest is emailed about this booking when it is created.';

create or replace function public.admin_create_booking(
  p_chalet_id    smallint,
  p_start        date,
  p_end          date,
  p_guest_name   text,
  p_guest_phone  text,
  p_guest_email  text,
  p_guests       smallint,
  p_status       public.booking_status default 'pending',
  p_total        numeric default null,
  p_notes        text default null,
  p_admin_note   text default null,
  p_lang         text default 'en',
  p_notify_guest boolean default true
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_quote   record;
  v_booking public.bookings;
  v_clash   text;
  v_closed  date;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  if p_start is null or p_end is null then
    raise exception 'Please choose the check-in and check-out dates' using errcode = 'P0001';
  end if;
  if p_end < p_start then
    raise exception 'The last night must be on or after the check-in date'
      using errcode = 'P0001';
  end if;
  if p_start < public.local_today() then
    raise exception 'The check-in date is in the past' using errcode = 'P0001';
  end if;
  if p_end - p_start + 1 > 90 then
    raise exception 'A booking can be at most 90 days long' using errcode = 'P0001';
  end if;

  if p_status is null or p_status not in ('pending', 'accepted') then
    raise exception 'A new booking can only be pending or accepted' using errcode = 'P0001';
  end if;

  if length(btrim(coalesce(p_guest_name, ''))) < 2 then
    raise exception 'Please enter the guest''s full name' using errcode = 'P0001';
  end if;
  if length(regexp_replace(coalesce(p_guest_phone, ''), '\D', '', 'g')) < 8 then
    raise exception 'Please enter a valid phone number' using errcode = 'P0001';
  end if;
  if btrim(coalesce(p_guest_email, '')) !~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    raise exception 'Please enter a valid email address' using errcode = 'P0001';
  end if;
  if p_guests is null or p_guests < 1 or p_guests > 20 then
    raise exception 'Please enter between 1 and 20 guests' using errcode = 'P0001';
  end if;
  if p_total is not null and p_total < 0 then
    raise exception 'The total cannot be negative' using errcode = 'P0001';
  end if;

  -- Any chalet, active or not: switching one off hides it from guests, and
  -- an admin may still need to record a stay in it.
  if not exists (select 1 from public.chalets c where c.id = p_chalet_id) then
    raise exception 'Unknown chalet' using errcode = 'P0002';
  end if;

  if p_status = 'accepted' then
    select b.ref into v_clash
    from public.bookings b
    where b.chalet_id = p_chalet_id
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

  select * into v_quote from public.quote_stay(p_chalet_id, p_start, p_end);

  insert into public.bookings (
    ref, chalet_id, start_date, end_date, total, package_key,
    guest_name, guest_phone, guest_email, guests, notes, admin_note, status,
    decided_at, decided_by, lang, source, notify_guest
  ) values (
    public.generate_booking_ref(), p_chalet_id, p_start, p_end,
    coalesce(round(p_total, 3), v_quote.total), v_quote.package_key,
    btrim(p_guest_name), btrim(p_guest_phone), lower(btrim(p_guest_email)),
    p_guests,
    nullif(btrim(coalesce(p_notes, '')), ''),
    nullif(btrim(coalesce(p_admin_note, '')), ''),
    p_status,
    case when p_status = 'accepted' then now() end,
    case when p_status = 'accepted' then auth.uid() end,
    case when lower(coalesce(p_lang, 'en')) = 'ar' then 'ar' else 'en' end,
    'admin',
    coalesce(p_notify_guest, true)
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

-- Not for guests. The function checks is_admin() itself, but there is no
-- reason for the browser's anonymous key to reach it at all; see the
-- lock-down migration for why PUBLIC alone is not enough on Supabase.
revoke all on function public.admin_create_booking(
  smallint, date, date, text, text, text, smallint, public.booking_status,
  numeric, text, text, text, boolean) from public, anon;
grant execute on function public.admin_create_booking(
  smallint, date, date, text, text, text, smallint, public.booking_status,
  numeric, text, text, text, boolean) to authenticated;
