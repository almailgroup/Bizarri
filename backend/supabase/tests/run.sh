#!/usr/bin/env bash
# Apply the migrations to a throwaway Postgres and run the SQL test suites.
#
#   supabase/tests/run.sh              # uses a local cluster on port 55432
#   PGPORT=5432 supabase/tests/run.sh  # or point it at your own
#
# The suites are ordered and stateful: 01 seeds, 02 books, 03 decides. They
# need a fresh database, which this script creates.
set -euo pipefail
cd "$(dirname "$0")/../.."

PGPORT="${PGPORT:-55432}"
PGHOST="${PGHOST:-/tmp}"
PGUSER="${PGUSER:-postgres}"
DB="${DB:-bizarri_test}"
PSQL=(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -d postgres -c "drop database if exists $DB;" -c "create database $DB;"

# Emulate the pieces of the Supabase runtime the migrations rely on. Objects are
# owned by a NON-superuser so RLS and SECURITY DEFINER behave as they do in
# production — a superuser owner would bypass RLS and hide real policy bugs.
"${PSQL[@]}" -d "$DB" <<'SQL'
create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create schema auth;
create table auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin create role anon nologin;          exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin;  exception when duplicate_object then null; end $$;
do $$ begin create role app_owner nosuperuser nologin; exception when duplicate_object then null; end $$;
grant usage on schema public, auth to anon, authenticated, service_role, app_owner;
grant create on schema public to app_owner;
grant all on auth.users to app_owner;
grant select on auth.users to anon, authenticated;

-- A real Supabase project ships this, and leaving it out made the harness
-- lie. Without it, "revoke all on function <fn> from public" is enough to
-- lock a function, so every grant assertion passed. With it, each new
-- function carries an EXPLICIT grant to anon and authenticated that a revoke
-- from PUBLIC does not touch -- which is how start_email_verification(), a
-- function that returns a plaintext one-time code, stayed callable from the
-- browser on the live site while the suite reported it locked.
alter default privileges for role app_owner in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
SQL

for f in supabase/migrations/*.sql; do
  "${PSQL[@]}" -d "$DB" -c "set role app_owner;" -f "$f" > /dev/null
done
echo "migrations applied"

# "Today" for the booking rules is public.local_today(). 00_ tests the real
# one; everything after runs with it pinned to Wednesday 30 September 2026,
# the day the fixtures were written for. Dates like "Thu 8 October 2026" are
# then always in the future, instead of the suite failing one fixture at a
# time as the real calendar overtakes them.
pin_today() {
  "${PSQL[@]}" -d "$DB" -c "set role app_owner;" -c "
    create or replace function public.local_today(p_at timestamptz default now())
    returns date language sql stable as \$\$ select date '2026-09-30' \$\$;" > /dev/null
}

fail=0
pinned=0
for f in supabase/tests/[0-9]*.sql; do
  case "$(basename "$f")" in
    00_*) ;;
    *) if [ "$pinned" -eq 0 ]; then pin_today; pinned=1; echo "(today pinned to 2026-09-30)"; fi ;;
  esac
  echo "── $(basename "$f")"
  if out=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB" -q -f "$f" 2>&1); then
    echo "$out" | sed 's/^psql:[^ ]* //; s/^NOTICE:  //' | grep -E '^(PASS|FAIL)' || true
  else
    echo "$out" | sed 's/^psql:[^ ]* //; s/^NOTICE:  //' | grep -E '^(PASS|FAIL)|ERROR' || true
    fail=1
  fi
done

total=$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$DB" -tAc "select 1" >/dev/null && echo ok)
[ "$fail" -eq 0 ] && echo "ALL SUITES PASSED" || { echo "SUITE FAILURE"; exit 1; }
