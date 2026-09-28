\set ON_ERROR_STOP on
-- Finding a booking by reference, by email, or by phone.
create or replace function pg_temp.ok(label text, cond boolean, detail text default '')
returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %  %', label, detail;
  else raise exception 'FAIL  %  %', label, detail; end if;
end $$;

update public.settings set value = 'false'::jsonb
 where key = 'require_email_verification';
update public.rates set min_stay_days = 1 where id;

-- One booking to find three ways.
do $$
declare b public.bookings;
begin
  set local role anon;
  b := public.request_booking(1::smallint, date '2027-11-07', date '2027-11-09',
        'Findable Guest', '+965 7000 1234', 'Findable@Example.com',
        2::smallint, null, 'ids/find.jpg', true);
  perform set_config('pg_temp.ref', b.ref, false);
  perform pg_temp.ok('A booking to find', b.ref is not null, b.ref);
end $$;

reset role;
set role anon;

do $$
declare r record; n integer; v_ref text := current_setting('pg_temp.ref');
begin
  -- ---------------------------------------------------------- by reference
  select count(*) into n from public.lookup_booking_by_ref(v_ref);
  perform pg_temp.ok('The reference alone finds it', n = 1, n::text || ' rows');

  select count(*) into n from public.lookup_booking_by_ref(lower(v_ref) || '  ');
  perform pg_temp.ok('…however it was typed', n = 1, n::text || ' rows');

  select count(*) into n from public.lookup_booking_by_ref('BZR-NOPE99');
  perform pg_temp.ok('An unknown reference finds nothing', n = 0, n::text || ' rows');

  -- -------------------------------------------------------------- by email
  select count(*) into n from public.lookup_booking_by_email('findable@example.com');
  perform pg_temp.ok('The email alone finds it', n = 1, n::text || ' rows');

  select count(*) into n from public.lookup_booking_by_email('  FINDABLE@Example.COM ');
  perform pg_temp.ok('…whatever its case or padding', n = 1, n::text || ' rows');

  select count(*) into n from public.lookup_booking_by_email('nobody@example.com');
  perform pg_temp.ok('An unknown address finds nothing', n = 0, n::text || ' rows');

  -- -------------------------------------------------------------- by phone
  select count(*) into n from public.lookup_booking_by_phone('70001234');
  perform pg_temp.ok('The phone alone finds it', n = 1, n::text || ' rows');

  -- All three must agree about the same booking.
  select * into r from public.lookup_booking_by_ref(v_ref);
  perform pg_temp.ok('…and all three describe the same stay',
    r.start_date = date '2027-11-07' and r.days = 3, r.days::text);
end $$;

do $$
begin
  begin
    perform public.lookup_booking_by_email('not-an-address');
    perform pg_temp.ok('A malformed address is refused', false, 'accepted');
  exception when others then
    perform pg_temp.ok('A malformed address is refused',
      sqlerrm like '%valid email%', left(sqlerrm, 30));
  end;
  begin
    perform public.lookup_booking_by_ref('   ');
    perform pg_temp.ok('An empty reference is refused', false, 'accepted');
  exception when others then
    perform pg_temp.ok('An empty reference is refused',
      sqlerrm like '%booking reference%', left(sqlerrm, 30));
  end;
end $$;

-- Every way in has to be throttled, or the new ones are a way around the
-- limit on the old one.
do $$
declare i integer; stopped integer := 0; v_ref text := current_setting('pg_temp.ref');
begin
  for i in 1..40 loop
    begin
      perform public.lookup_booking_by_ref(v_ref);
    exception when others then
      if sqlerrm like '%Too many lookups%' then stopped := i; exit; else raise; end if;
    end;
  end loop;
  perform pg_temp.ok('Guessing at references is throttled hardest',
    stopped between 1 and 11, 'stopped on call ' || stopped::text);
end $$;

do $$
declare i integer; stopped integer := 0;
begin
  for i in 1..40 loop
    begin
      perform public.lookup_booking_by_email('findable@example.com');
    exception when others then
      if sqlerrm like '%Too many lookups%' then stopped := i; exit; else raise; end if;
    end;
  end loop;
  perform pg_temp.ok('Email lookups are throttled too', stopped between 1 and 40,
    'stopped on call ' || stopped::text);

  -- Per subject, so one address being hammered cannot lock out another.
  perform public.lookup_booking_by_email('someone.else@example.com');
  perform pg_temp.ok('…and only that address', true);
end $$;

do $$
begin
  begin
    perform public.note_lookup('ref', 'anything', 1);
    perform pg_temp.ok('anon cannot reach the throttle directly', false, 'call succeeded');
  exception when insufficient_privilege then
    perform pg_temp.ok('anon cannot reach the throttle directly', true, 'permission denied');
  end;
  begin
    perform 1 from public.lookup_throttle;
    perform pg_temp.ok('anon cannot read the throttle table', false, 'select succeeded');
  exception when others then
    perform pg_temp.ok('anon cannot read the throttle table', true, left(sqlerrm, 28));
  end;
end $$;

reset role;
