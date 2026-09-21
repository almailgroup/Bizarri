-- ============================================================================
-- Special occasion pricing, and the two things a guest must now provide to
-- check out: a Civil ID image and an explicit acceptance of the terms.
--
-- Special occasions (Eid and the like) are premium windows — typically a
-- Thu-Sat — that carry a flat price instead of the normal weekend rate.
-- They are their own table rather than a rates column because each one has
-- its own dates, and the admin needs to add next year's Eid without a
-- migration.
-- ============================================================================

-- ------------------------------------------------------------- occasions

create table if not exists public.special_occasions (
  id         uuid primary key default gen_random_uuid(),
  name_en    text not null check (length(btrim(name_en)) > 0),
  name_ar    text not null default '',
  start_date date not null,
  end_date   date not null,
  price      numeric(10,3) not null default 900 check (price >= 0),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  constraint occasions_dates_ordered check (end_date >= start_date)
);

comment on table public.special_occasions is
  'Premium date windows (Eid etc). price is the flat total for the window, '
  'not a per-day rate.';

-- Two active occasions may not cover the same day: a day can only have one
-- premium price, and quote_stay would otherwise have to pick arbitrarily.
alter table public.special_occasions drop constraint if exists occasions_no_overlap;
alter table public.special_occasions add constraint occasions_no_overlap
  exclude using gist (daterange(start_date, end_date, '[]') with &&) where (active);

create index if not exists occasions_range_idx
  on public.special_occasions (start_date, end_date) where active;

drop trigger if exists touch_special_occasions on public.special_occasions;
create trigger touch_special_occasions before update on public.special_occasions
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------- checkout

alter table public.bookings
  add column if not exists civil_id_path    text,
  add column if not exists terms_accepted_at timestamptz;

comment on column public.bookings.civil_id_path is
  'Object path in the private civil-ids storage bucket. Admins read it through '
  'a signed URL; it is never public.';

-- 'special' joins the package vocabulary now that an occasion can price a stay.
alter table public.bookings drop constraint if exists bookings_package_key_check;
alter table public.bookings add constraint bookings_package_key_check
  check (package_key in ('fullWeek', 'weekend', 'weekday', 'special'));

-- ------------------------------------------------------------- pricing

/**
 * Price a stay.
 *
 * Precedence, most specific first:
 *   1. custom day prices  — if the admin priced any day in the range, the whole
 *                           range is summed per day so an override is never
 *                           masked by a flat rate.
 *   2. special occasion   — the occasion's flat price, plus the per-day default
 *                           for any days the stay extends beyond the window.
 *   3. exact package      — fullWeek / weekend / weekday.
 *   4. per-day defaults.
 *
 * Returns the occasion name when branch 2 applied, so the UI can say why the
 * price is what it is.
 */
drop function if exists public.quote_stay(smallint, date, date);
create function public.quote_stay(
  p_chalet_id smallint,
  p_start     date,
  p_end       date
)
returns table (total numeric, package_key text, days integer, has_custom boolean, occasion text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_rates      public.rates;
  v_has_custom boolean;
  v_package    text;
  v_sum        numeric;
  v_occ        public.special_occasions%rowtype;
  v_outside    numeric;
begin
  if p_end < p_start then
    raise exception 'end date precedes start date' using errcode = '22007';
  end if;

  select * into v_rates from public.rates where id limit 1;
  if not found then
    raise exception 'rates are not configured' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.day_prices dp
    where dp.chalet_id = p_chalet_id and dp.day between p_start and p_end
  ) into v_has_custom;

  select coalesce(sum(coalesce(dp.price, public.default_day_rate(d::date, v_rates))), 0)
    into v_sum
  from generate_series(p_start, p_end, interval '1 day') d
  left join public.day_prices dp
    on dp.chalet_id = p_chalet_id and dp.day = d::date;

  if v_has_custom then
    return query select v_sum, null::text, (p_end - p_start + 1)::integer, true, null::text;
    return;
  end if;

  -- The overlap constraint makes at most one active occasion possible here;
  -- the ordering only decides which wins if that constraint is ever relaxed.
  select * into v_occ
  from public.special_occasions o
  where o.active
    and daterange(o.start_date, o.end_date, '[]') && daterange(p_start, p_end, '[]')
  order by o.price desc, o.start_date
  limit 1;

  if found then
    select coalesce(sum(public.default_day_rate(d::date, v_rates)), 0)
      into v_outside
    from generate_series(p_start, p_end, interval '1 day') d
    where d::date < v_occ.start_date or d::date > v_occ.end_date;

    return query select
      v_occ.price + v_outside, 'special'::text,
      (p_end - p_start + 1)::integer, false, v_occ.name_en;
    return;
  end if;

  v_package := public.match_package(p_start, p_end);

  return query select
    case v_package
      when 'fullWeek' then v_rates.full_week
      when 'weekend'  then v_rates.weekend
      when 'weekday'  then v_rates.weekday
      else v_sum
    end,
    v_package,
    (p_end - p_start + 1)::integer,
    false,
    null::text;
end;
$$;

-- ------------------------------------------------------- request_booking

/**
 * The only way a guest creates a booking.
 *
 * Now also the gate for the two checkout requirements: a Civil ID image must
 * already be uploaded (the client puts it in the private bucket and passes the
 * path) and the terms must be explicitly accepted. Both are enforced here
 * rather than only in the form, because the form is not the security boundary.
 */
-- Drop the old 8-argument signature so it cannot linger as an overload that
-- bypasses the new checkout requirements; "or replace" on the new one keeps
-- re-applying the migrations idempotent.
drop function if exists public.request_booking(smallint, date, date, text, text, text, smallint, text);
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
  p_terms_accepted boolean default false
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
    civil_id_path, terms_accepted_at
  ) values (
    public.generate_booking_ref(), p_chalet_id, p_start, p_end,
    v_quote.total, v_quote.package_key,
    btrim(p_guest_name), btrim(p_guest_phone), lower(btrim(p_guest_email)),
    p_guests, nullif(btrim(coalesce(p_notes, '')), ''), 'pending',
    v_civil, now()
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

-- ------------------------------------------------------------------- RLS

alter table public.special_occasions enable row level security;

drop policy if exists occasions_public_read on public.special_occasions;
create policy occasions_public_read on public.special_occasions
  for select to anon, authenticated using (true);

drop policy if exists occasions_admin_write on public.special_occasions;
create policy occasions_admin_write on public.special_occasions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.special_occasions to anon, authenticated;
grant select, insert, update, delete on public.special_occasions to authenticated;

-- Re-grant: dropping a function drops its grants with it.
revoke all on function public.quote_stay(smallint, date, date) from public;
revoke all on function public.request_booking(
  smallint, date, date, text, text, text, smallint, text, text, boolean) from public;

grant execute on function public.quote_stay(smallint, date, date) to anon, authenticated;
grant execute on function public.request_booking(
  smallint, date, date, text, text, text, smallint, text, text, boolean)
  to anon, authenticated;

-- --------------------------------------------------------------- storage

-- Guarded: the local test harness emulates auth but not storage, so this is a
-- no-op there and applies on Supabase.
do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('civil-ids', 'civil-ids', false, 5242880,
          array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- A guest uploads their own ID before the booking exists, so anon needs
  -- INSERT. It deliberately gets nothing else: no select, update or delete,
  -- so an uploaded ID cannot be read back, overwritten or enumerated.
  drop policy if exists "civil ids: guests may upload" on storage.objects;
  create policy "civil ids: guests may upload" on storage.objects
    for insert to anon, authenticated
    with check (bucket_id = 'civil-ids');

  drop policy if exists "civil ids: admins may read" on storage.objects;
  create policy "civil ids: admins may read" on storage.objects
    for select to authenticated
    using (bucket_id = 'civil-ids' and public.is_admin());

  drop policy if exists "civil ids: admins may delete" on storage.objects;
  create policy "civil ids: admins may delete" on storage.objects
    for delete to authenticated
    using (bucket_id = 'civil-ids' and public.is_admin());
end $$;
