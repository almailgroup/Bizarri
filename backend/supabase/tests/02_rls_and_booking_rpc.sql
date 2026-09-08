\set ON_ERROR_STOP on
create or replace function pg_temp.ok(label text, cond boolean, detail text default '')
returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %  %', label, detail;
  else raise exception 'FAIL  %  %', label, detail; end if;
end $$;

-- ===================== anon: what a visitor can do ==========================
set role anon;
do $$
declare n integer; b record;
begin
  select count(*) into n from public.rates;
  perform pg_temp.ok('anon can read rates', n = 1);
  select count(*) into n from public.chalets;
  perform pg_temp.ok('anon can read chalets', n = 2);

  begin
    select count(*) into n from public.bookings;
    perform pg_temp.ok('anon CANNOT read bookings', false, format('read %s rows', n));
  exception when insufficient_privilege then
    perform pg_temp.ok('anon CANNOT read bookings', true, 'permission denied');
  end;

  begin
    insert into public.bookings (ref, chalet_id, start_date, end_date, total,
      guest_name, guest_phone, guest_email, guests)
    values ('BZR-HACKED', 1, '2026-11-01', '2026-11-04', 0,
            'Mallory', '+9650000', 'm@example.com', 2);
    perform pg_temp.ok('anon CANNOT insert a booking directly', false, 'insert succeeded');
  exception when insufficient_privilege then
    perform pg_temp.ok('anon CANNOT insert a booking directly', true, 'permission denied');
  end;

  begin
    insert into public.blocked_dates (chalet_id, day) values (1, '2026-12-25');
    perform pg_temp.ok('anon CANNOT block dates', false, 'insert succeeded');
  exception when insufficient_privilege then
    perform pg_temp.ok('anon CANNOT block dates', true, 'permission denied');
  end;

  begin
    update public.rates set full_week = 1;
    perform pg_temp.ok('anon CANNOT change rates', false, 'update succeeded');
  exception when insufficient_privilege then
    perform pg_temp.ok('anon CANNOT change rates', true, 'permission denied');
  end;
end $$;
reset role;

-- unpublished news is invisible to the public
insert into public.news (title_en, body_en, published) values ('Draft item', 'x', false);
insert into public.news (title_en, body_en, published, published_at) values ('Live item', 'y', true, now());
set role anon;
do $$
declare n integer;
begin
  select count(*) into n from public.news;
  perform pg_temp.ok('anon sees only published news', n = 1, format('%s rows', n));
end $$;
reset role;

-- ================== anon booking through the RPC ============================
set role anon;
do $$
declare b public.bookings; q record;
begin
  b := public.request_booking(1::smallint, date '2026-10-11', date '2026-10-17',
        'Aisha Al-Sabah', '+96594040955', 'Aisha@Example.com ', 6::smallint, ' late check-in ');
  perform pg_temp.ok('anon CAN request a booking via RPC', b.ref like 'BZR-%', b.ref);
  perform pg_temp.ok('Server prices the stay (600, not client-supplied)', b.total = 600, b.total::text);
  perform pg_temp.ok('Status forced to pending', b.status = 'pending');
  perform pg_temp.ok('Email normalised', b.guest_email = 'aisha@example.com', b.guest_email);
  perform pg_temp.ok('Notes trimmed', b.notes = 'late check-in', b.notes);
  perform pg_temp.ok('days is derived', b.days = 7, b.days::text);

  -- min stay
  begin
    b := public.request_booking(1::smallint, date '2026-11-02', date '2026-11-03',
          'Too Short', '+96599999999', 'short@example.com', 2::smallint);
    perform pg_temp.ok('Two-day request rejected', false, 'accepted');
  exception when others then
    perform pg_temp.ok('Two-day request rejected', sqlerrm like '%Minimum stay%', sqlerrm);
  end;

  -- unknown chalet
  begin
    b := public.request_booking(9::smallint, date '2026-11-08', date '2026-11-11',
          'Ghost', '+96599999999', 'g@example.com', 2::smallint);
    perform pg_temp.ok('Unknown chalet rejected', false, 'accepted');
  exception when others then
    perform pg_temp.ok('Unknown chalet rejected', sqlerrm like '%Unknown chalet%', sqlerrm);
  end;

  -- bad email fails the column constraint
  begin
    b := public.request_booking(1::smallint, date '2026-11-08', date '2026-11-11',
          'Bad Email', '+96599999999', 'nope@bad', 2::smallint);
    perform pg_temp.ok('Malformed email rejected', false, 'accepted');
  exception when others then
    perform pg_temp.ok('Malformed email rejected', true, 'constraint violated');
  end;
end $$;
reset role;
