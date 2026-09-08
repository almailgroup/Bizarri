-- ============================================================================
-- Friendlier validation in request_booking().
--
-- The column CHECKs already refuse a bad guest count and a reversed range, but
-- they surface as raw Postgres text ("new row for relation \"bookings\"
-- violates check constraint ...") and the client renders the error message
-- straight to the guest. Validate first and say something useful.
--
-- Added as a follow-up migration rather than an edit so it applies cleanly
-- whether or not the earlier ones have already been pushed.
-- ============================================================================

create or replace function public.request_booking(
  p_chalet_id   smallint,
  p_start       date,
  p_end         date,
  p_guest_name  text,
  p_guest_phone text,
  p_guest_email text,
  p_guests      smallint,
  p_notes       text default null
)
returns public.bookings
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_min      smallint;
  v_quote    record;
  v_booking  public.bookings;
  v_recent   integer;
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
  -- addresses routinely carry surrounding whitespace. Checking the raw input
  -- would reject them for a reason the guest cannot see.
  if btrim(coalesce(p_guest_email, '')) !~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    raise exception 'Please enter a valid email address' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.chalets c where c.id = p_chalet_id and c.active) then
    raise exception 'Unknown chalet' using errcode = 'P0002';
  end if;

  if not public.is_range_available(p_chalet_id, p_start, p_end) then
    raise exception 'Those dates are no longer available' using errcode = 'P0001';
  end if;

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
    guest_name, guest_phone, guest_email, guests, notes, status
  ) values (
    public.generate_booking_ref(), p_chalet_id, p_start, p_end,
    v_quote.total, v_quote.package_key,
    btrim(p_guest_name), btrim(p_guest_phone), lower(btrim(p_guest_email)),
    p_guests, nullif(btrim(coalesce(p_notes, '')), ''), 'pending'
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.request_booking(smallint, date, date, text, text, text, smallint, text) from public;
grant execute on function public.request_booking(smallint, date, date, text, text, text, smallint, text)
  to anon, authenticated;
