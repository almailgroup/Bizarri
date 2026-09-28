\set ON_ERROR_STOP on
-- The email one-time code, the gate it puts in front of request_booking(),
-- and finding a booking again from the phone number alone.
create or replace function pg_temp.ok(label text, cond boolean, detail text default '')
returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %  %', label, detail;
  else raise exception 'FAIL  %  %', label, detail; end if;
end $$;

-- 02-04 turned this off to book directly. This suite is the one that cares.
update public.settings set value = 'true'::jsonb
 where key = 'require_email_verification';

-- ---------------------------------------------------------------- the code

-- start_email_verification runs as the owner here, standing in for the Edge
-- Function's service_role. anon must not reach it, which is checked below.
do $$
declare
  v_code  text;
  v_hash  text;
  v_salt  text;
  v_plain text;
  i       integer;
begin
  v_code := public.start_email_verification('Guest@Example.COM');
  perform pg_temp.ok('A code is issued', v_code ~ '^[0-9]{6}$', v_code);

  select salt, code_hash into v_salt, v_hash
  from public.email_verifications where email = 'guest@example.com';
  perform pg_temp.ok('The address is stored folded to lower case', v_salt is not null);

  -- The point of the table: the code itself must not be recoverable from it.
  select v_code into v_plain;
  perform pg_temp.ok('Only a salted hash is kept, never the code',
    v_hash <> v_plain and v_hash = encode(digest(v_salt || v_plain, 'sha256'), 'hex'),
    left(v_hash, 16) || '…');

  -- False, not an exception: an exception here would roll back the attempt
  -- counter along with it and the cap further down would never bite.
  perform pg_temp.ok('A wrong code is refused',
    not public.verify_email_code('guest@example.com',
      lpad(((v_code::integer + 1) % 1000000)::text, 6, '0')));

  select attempts into strict i from public.email_verifications
   where email = 'guest@example.com';
  perform pg_temp.ok('…and the failed attempt is actually recorded', i = 1, i::text);
end $$;

do $$
declare v_code text;
begin
  -- A second request retires the first, so the newest code is the live one.
  v_code := public.start_email_verification('guest@example.com');
  perform pg_temp.ok('The right code verifies',
    public.verify_email_code('guest@example.com', v_code));
  perform pg_temp.ok('…and the address now reads as verified',
    public.is_email_verified('GUEST@example.com'));
  perform pg_temp.ok('…but only that address',
    not public.is_email_verified('someone.else@example.com'));
end $$;

-- Whitespace and case are what guests actually type.
do $$
declare v_code text;
begin
  v_code := public.start_email_verification('  Spaced@Example.com  ');
  perform pg_temp.ok('A padded, mixed-case address still verifies',
    public.verify_email_code('spaced@example.com', '  ' || v_code || '  '));
end $$;

do $$
declare v_code text;
begin
  v_code := public.start_email_verification('expired@example.com');
  update public.email_verifications set expires_at = now() - interval '1 second'
   where email = 'expired@example.com';
  begin
    perform public.verify_email_code('expired@example.com', v_code);
    perform pg_temp.ok('An expired code is refused', false, 'accepted');
  exception when others then
    perform pg_temp.ok('An expired code is refused', sqlerrm like '%expired%', left(sqlerrm, 32));
  end;
  perform pg_temp.ok('…and an expired code leaves the address unverified',
    not public.is_email_verified('expired@example.com'));
end $$;

do $$
declare v_code text; v_wrong text; i integer;
begin
  v_code  := public.start_email_verification('bruteforce@example.com');
  v_wrong := lpad(((v_code::integer + 7) % 1000000)::text, 6, '0');
  for i in 1..5 loop
    begin perform public.verify_email_code('bruteforce@example.com', v_wrong);
    exception when others then null; end;
  end loop;
  begin
    -- The correct code, but the attempts are spent: guessing has to cost
    -- something or a 6-digit code is worth nothing.
    perform public.verify_email_code('bruteforce@example.com', v_code);
    perform pg_temp.ok('Guessing is capped', false, 'accepted after 5 wrong tries');
  exception when others then
    perform pg_temp.ok('Guessing is capped', sqlerrm like '%Too many attempts%', left(sqlerrm, 32));
  end;
end $$;

do $$
declare i integer;
begin
  for i in 1..5 loop perform public.start_email_verification('flood@example.com'); end loop;
  begin
    perform public.start_email_verification('flood@example.com');
    perform pg_temp.ok('Requesting codes is rate limited', false, 'issued a 6th');
  exception when others then
    perform pg_temp.ok('Requesting codes is rate limited',
      sqlerrm like '%Too many codes%', left(sqlerrm, 32));
  end;
end $$;

do $$
begin
  begin
    perform public.start_email_verification('not-an-address');
    perform pg_temp.ok('A malformed address is refused', false, 'accepted');
  exception when others then
    perform pg_temp.ok('A malformed address is refused',
      sqlerrm like '%valid email%', left(sqlerrm, 32));
  end;
end $$;

-- ------------------------------------------------------------- the gate

set role anon;

do $$
declare b public.bookings;
begin
  begin
    b := public.request_booking(1::smallint, date '2027-03-07', date '2027-03-10',
          'Unverified Guest', '+96551110001', 'unverified@example.com',
          2::smallint, null, 'ids/unverified.jpg', true);
    perform pg_temp.ok('An unverified address cannot book', false, b.ref);
  exception when others then
    perform pg_temp.ok('An unverified address cannot book',
      sqlerrm like '%confirm your email%', left(sqlerrm, 32));
  end;
end $$;

-- anon must not be able to mint its own code: that would let a guest verify
-- an address they do not own by reading the code out of the response.
do $$
begin
  begin
    perform public.start_email_verification('attacker@example.com');
    perform pg_temp.ok('anon cannot mint a code', false, 'call succeeded');
  exception when insufficient_privilege then
    perform pg_temp.ok('anon cannot mint a code', true, 'permission denied');
  end;
end $$;

do $$
begin
  begin
    perform public.is_email_verified('guest@example.com');
    perform pg_temp.ok('anon cannot probe which addresses are verified', false, 'call succeeded');
  exception when insufficient_privilege then
    perform pg_temp.ok('anon cannot probe which addresses are verified', true, 'permission denied');
  end;
end $$;

do $$
begin
  begin
    perform 1 from public.email_verifications;
    perform pg_temp.ok('anon cannot read the hashes', false, 'select succeeded');
  exception when others then
    perform pg_temp.ok('anon cannot read the hashes', true, left(sqlerrm, 32));
  end;
end $$;

reset role;

-- The whole path, end to end, with the gate on.
do $$
declare v_code text; b public.bookings;
begin
  v_code := public.start_email_verification('e2e@example.com');
  perform public.verify_email_code('e2e@example.com', v_code);
  set local role anon;
  b := public.request_booking(1::smallint, date '2027-03-07', date '2027-03-10',
        'Verified Guest', '+965 5111 0002', 'e2e@example.com',
        2::smallint, null, 'ids/e2e.jpg', true);
  perform pg_temp.ok('A verified address books normally', b.ref ~ '^BZR-[A-Z0-9]{6}$', b.ref);
  perform pg_temp.ok('…and the booking carries the reference and the phone',
    b.guest_phone = '+965 5111 0002' and b.guest_email = 'e2e@example.com', b.guest_phone);
end $$;

reset role;

-- The switch has to work, or a Resend outage closes the site.
do $$
declare b public.bookings;
begin
  update public.settings set value = 'false'::jsonb
   where key = 'require_email_verification';
  set local role anon;
  b := public.request_booking(2::smallint, date '2027-04-04', date '2027-04-07',
        'Switch Off', '+96551110003', 'switchedoff@example.com',
        2::smallint, null, 'ids/off.jpg', true);
  perform pg_temp.ok('Turning the setting off reopens booking', b.ref is not null, b.ref);
end $$;

reset role;
update public.settings set value = 'true'::jsonb
 where key = 'require_email_verification';

-- --------------------------------------------------------- phone lookup

set role anon;

do $$
declare r record; n integer;
begin
  -- The number was stored as '+965 5111 0002'; a guest will type it any of
  -- these ways and expects to find their stay either way.
  select count(*) into n from public.lookup_booking_by_phone('+965 5111 0002');
  perform pg_temp.ok('The number as typed finds the booking', n = 1, n::text || ' rows');

  select count(*) into n from public.lookup_booking_by_phone('96551110002');
  perform pg_temp.ok('…so does it without spaces or a plus', n = 1, n::text || ' rows');

  select count(*) into n from public.lookup_booking_by_phone('51110002');
  perform pg_temp.ok('…so does the local number alone', n = 1, n::text || ' rows');

  select * into r from public.lookup_booking_by_phone('51110002');
  perform pg_temp.ok('It returns the reference the guest needs',
    r.ref ~ '^BZR-', r.ref);
  perform pg_temp.ok('…with the status and the stay',
    r.status = 'pending' and r.start_date = date '2027-03-07' and r.total > 0,
    r.status::text || ' ' || r.total::text);

  select count(*) into n from public.lookup_booking_by_phone('+96599998888');
  perform pg_temp.ok('An unknown number finds nothing', n = 0, n::text || ' rows');
end $$;

do $$
begin
  begin
    perform public.lookup_booking_by_phone('1234');
    perform pg_temp.ok('Too short a number is refused', false, 'accepted');
  exception when others then
    perform pg_temp.ok('Too short a number is refused',
      sqlerrm like '%valid phone%', left(sqlerrm, 32));
  end;
end $$;

do $$
declare i integer; v_stopped_at integer := 0;
begin
  -- The assertions above already spent part of this number's allowance, so
  -- count until it trips rather than assuming the cap starts fresh here.
  for i in 1..40 loop
    begin
      perform public.lookup_booking_by_phone('51110002');
    exception when others then
      if sqlerrm like '%Too many lookups%' then v_stopped_at := i; exit; else raise; end if;
    end;
  end loop;
  perform pg_temp.ok('Repeated lookups on one number are throttled',
    v_stopped_at between 1 and 40, 'stopped on call ' || v_stopped_at::text);

  -- Per number, so one guest hammering it cannot lock everybody else out.
  perform public.lookup_booking_by_phone('96551110003');
  perform pg_temp.ok('…and only that number', true, 'another number still answers');
end $$;

reset role;

-- ---------------------------------------------------------- booking language

do $$
declare v_code text; b public.bookings;
begin
  v_code := public.start_email_verification('arabic@example.com');
  perform public.verify_email_code('arabic@example.com', v_code);
  set local role anon;
  b := public.request_booking(1::smallint, date '2027-05-09', date '2027-05-12',
        'ضيف', '+96551110004', 'arabic@example.com',
        2::smallint, null, 'ids/ar.jpg', true, 'ar');
  perform pg_temp.ok('A booking remembers the language it was made in',
    b.lang = 'ar', b.lang);
end $$;

reset role;

do $$
declare v_code text; b public.bookings;
begin
  v_code := public.start_email_verification('default-lang@example.com');
  perform public.verify_email_code('default-lang@example.com', v_code);
  set local role anon;
  b := public.request_booking(1::smallint, date '2027-06-06', date '2027-06-09',
        'Default Lang', '+96551110005', 'default-lang@example.com',
        2::smallint, null, 'ids/def.jpg', true);
  perform pg_temp.ok('…and defaults to English when not told', b.lang = 'en', b.lang);
end $$;

reset role;

do $$
declare v_code text; b public.bookings;
begin
  v_code := public.start_email_verification('junk-lang@example.com');
  perform public.verify_email_code('junk-lang@example.com', v_code);
  set local role anon;
  -- A junk value must not reach the column's CHECK as an error the guest sees.
  b := public.request_booking(1::smallint, date '2027-07-04', date '2027-07-07',
        'Junk Lang', '+96551110006', 'junk-lang@example.com',
        2::smallint, null, 'ids/junk.jpg', true, 'klingon');
  perform pg_temp.ok('…and falls back rather than failing on a junk value',
    b.lang = 'en', b.lang);
end $$;

reset role;
