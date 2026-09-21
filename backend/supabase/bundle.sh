#!/usr/bin/env bash
# Concatenate the migrations into one script for the Supabase SQL editor.
#
#   backend/supabase/bundle.sh > schema.sql
#
# For when the CLI is not an option (no local clone, no terminal). The result
# is equivalent to `supabase db push` on a fresh project: the migrations are
# idempotent, so re-running it is safe.
set -euo pipefail
cd "$(dirname "$0")"

cat <<'HEADER'
-- ============================================================================
-- Bizarri Chalet — complete schema.
--
-- Paste into the Supabase SQL editor (Dashboard -> SQL Editor -> New query)
-- and Run. Generated from backend/supabase/migrations by bundle.sh; edit the
-- migrations, not this file.
--
-- Afterwards, still by hand:
--   1. Authentication -> Users -> Add user (the admin's email + password)
--   2. insert into public.admins (user_id, email)
--      select id, email from auth.users where email = '<that email>';
-- ============================================================================

HEADER

for f in migrations/*.sql; do
  printf -- '-- ===== %s %s\n\n' "$f" "$(printf '=%.0s' $(seq 1 $((60 - ${#f}))))"
  cat "$f"
  printf '\n'
done
