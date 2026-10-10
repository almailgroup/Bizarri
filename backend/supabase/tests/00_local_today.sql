\set ON_ERROR_STOP on
create or replace function pg_temp.ok(label text, cond boolean, detail text default '')
returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %  %', label, detail;
  else raise exception 'FAIL  %  %', label, detail; end if;
end $$;

-- The real local_today(), before run.sh pins it for the other suites.
-- Kuwait is UTC+3 all year (no daylight saving), so the day turns over at
-- 21:00 UTC: the three hours in which the server's own date was a day behind.
do $$
begin
  perform pg_temp.ok('At 20:59 UTC it is still the same day in Kuwait',
    public.local_today(timestamptz '2026-10-10 20:59:00+00') = date '2026-10-10',
    public.local_today(timestamptz '2026-10-10 20:59:00+00')::text);
  perform pg_temp.ok('At 21:00 UTC it is already tomorrow in Kuwait',
    public.local_today(timestamptz '2026-10-10 21:00:00+00') = date '2026-10-11',
    public.local_today(timestamptz '2026-10-10 21:00:00+00')::text);
  perform pg_temp.ok('…whatever the server''s own time zone',
    (select public.local_today(timestamptz '2026-10-10 22:30:00+00')) = date '2026-10-11');
  perform pg_temp.ok('With no argument it is today in Kuwait now',
    public.local_today() = (now() at time zone 'Asia/Kuwait')::date);
end $$;

-- And the session's time zone must not leak in.
set time zone 'America/Los_Angeles';
do $$
begin
  perform pg_temp.ok('A session in another time zone gets the same answer',
    public.local_today(timestamptz '2026-10-10 21:00:00+00') = date '2026-10-11');
end $$;
reset time zone;
