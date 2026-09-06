-- ============================================================================
-- Row Level Security.
--
-- Default posture: deny. Anonymous visitors may read the handful of things the
-- public site renders, and may call request_booking(). Everything else — and
-- all writes — requires an admin.
--
-- Note bookings has NO public select or insert policy at all. Guests reach it
-- only through request_booking() / lookup_booking(), which are SECURITY
-- DEFINER and bypass RLS deliberately and narrowly.
-- ============================================================================

alter table public.admins        enable row level security;
alter table public.chalets       enable row level security;
alter table public.rates         enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.day_prices    enable row level security;
alter table public.bookings      enable row level security;
alter table public.news          enable row level security;
alter table public.settings      enable row level security;
alter table public.audit_log     enable row level security;

-- Deliberately NOT "force row level security": request_booking() and
-- lookup_booking() are SECURITY DEFINER and run as the table owner. Forcing
-- RLS on the owner would block the one path guests are supposed to use.

-- ------------------------------------------------------------------- admins
drop policy if exists admins_self_read on public.admins;
create policy admins_self_read on public.admins
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Membership is granted out-of-band (SQL editor / service role), never
-- through the API: no insert, update or delete policy exists.

-- ------------------------------------------------------------------ chalets
drop policy if exists chalets_public_read on public.chalets;
create policy chalets_public_read on public.chalets
  for select to anon, authenticated
  using (active or public.is_admin());

drop policy if exists chalets_admin_write on public.chalets;
create policy chalets_admin_write on public.chalets
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- -------------------------------------------------------------------- rates
drop policy if exists rates_public_read on public.rates;
create policy rates_public_read on public.rates
  for select to anon, authenticated using (true);

drop policy if exists rates_admin_write on public.rates;
create policy rates_admin_write on public.rates
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------ blocked_dates
drop policy if exists blocked_public_read on public.blocked_dates;
create policy blocked_public_read on public.blocked_dates
  for select to anon, authenticated using (true);

drop policy if exists blocked_admin_write on public.blocked_dates;
create policy blocked_admin_write on public.blocked_dates
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------- day_prices
drop policy if exists prices_public_read on public.day_prices;
create policy prices_public_read on public.day_prices
  for select to anon, authenticated using (true);

drop policy if exists prices_admin_write on public.day_prices;
create policy prices_admin_write on public.day_prices
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------- bookings
-- Admins only. Guests never touch this table directly.
drop policy if exists bookings_admin_read on public.bookings;
create policy bookings_admin_read on public.bookings
  for select to authenticated using (public.is_admin());

drop policy if exists bookings_admin_write on public.bookings;
create policy bookings_admin_write on public.bookings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------- news
drop policy if exists news_public_read on public.news;
create policy news_public_read on public.news
  for select to anon, authenticated
  using (published or public.is_admin());

drop policy if exists news_admin_write on public.news;
create policy news_admin_write on public.news
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------- settings
drop policy if exists settings_public_read on public.settings;
create policy settings_public_read on public.settings
  for select to anon, authenticated using (true);

drop policy if exists settings_admin_write on public.settings;
create policy settings_admin_write on public.settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- audit_log
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log
  for select to authenticated using (public.is_admin());
-- Written only by triggers running as definer; no insert policy.

-- ============================================================================
-- Grants. RLS filters rows; grants decide who may attempt the verb at all.
-- ============================================================================

revoke all on all tables in schema public from anon, authenticated;

grant select on public.chalets, public.rates, public.blocked_dates,
                public.day_prices, public.news, public.settings
  to anon, authenticated;

grant select, insert, update, delete on
  public.chalets, public.rates, public.blocked_dates, public.day_prices,
  public.bookings, public.news, public.settings
  to authenticated;

grant select on public.admins, public.audit_log to authenticated;

-- Functions: lock down, then hand back only what each role needs.
revoke all on function public.request_booking(smallint, date, date, text, text, text, smallint, text) from public;
revoke all on function public.set_booking_status(uuid, public.booking_status, text) from public;

grant execute on function public.availability_calendar(smallint, date, date) to anon, authenticated;
grant execute on function public.quote_stay(smallint, date, date)            to anon, authenticated;
grant execute on function public.is_range_available(smallint, date, date)    to anon, authenticated;
grant execute on function public.lookup_booking(text, text)                  to anon, authenticated;
grant execute on function public.request_booking(smallint, date, date, text, text, text, smallint, text)
  to anon, authenticated;
grant execute on function public.set_booking_status(uuid, public.booking_status, text) to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ============================================================================
-- Audit trail for admin decisions.
-- ============================================================================

create or replace function public.log_booking_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'booking.created', 'bookings', new.ref,
            jsonb_build_object('chalet', new.chalet_id, 'start', new.start_date,
                               'end', new.end_date, 'total', new.total));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'booking.status', 'bookings', new.ref,
            jsonb_build_object('from', old.status, 'to', new.status));
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (actor, action, entity, entity_id, detail)
    values (auth.uid(), 'booking.deleted', 'bookings', old.ref,
            jsonb_build_object('start', old.start_date, 'end', old.end_date));
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists audit_bookings on public.bookings;
create trigger audit_bookings
  after insert or update or delete on public.bookings
  for each row execute function public.log_booking_change();
