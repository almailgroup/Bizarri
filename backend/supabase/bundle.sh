#!/usr/bin/env bash
# Concatenate the migrations into one script for the Supabase SQL editor.
#
#   backend/supabase/bundle.sh          > schema.sql   # one file
#   backend/supabase/bundle.sh --split                 # numbered parts
#
# For when the CLI is not an option (no local clone, no terminal). The result
# is equivalent to `supabase db push` on a fresh project: the migrations are
# idempotent, so re-running it is safe.
#
# --split writes schema-parts/NN-<name>.sql instead, one per migration, in the
# order they must be run. schema.sql is 2,300 lines, and pasting it whole into
# the dashboard's editor can silently truncate — which surfaces as a syntax
# error partway down a statement that is perfectly valid in the file, because
# the rest of it never arrived. Each part is small enough to paste in one go,
# and each is idempotent on its own, so a part that has already been run can
# be run again.
set -euo pipefail
cd "$(dirname "$0")"

if [ "${1:-}" = "--split" ]; then
  out=schema-parts
  rm -rf "$out"
  mkdir -p "$out"
  n=0
  for f in migrations/*.sql; do
    n=$((n + 1))
    # 20260906090000_core_schema.sql -> 01-core_schema.sql
    name=$(basename "$f" .sql | sed 's/^[0-9]*_//')
    dest=$(printf '%s/%02d-%s.sql' "$out" "$n" "$name")
    {
      printf -- '-- ============================================================================\n'
      printf -- '-- Part %d of %d: %s\n' "$n" "$(ls migrations/*.sql | wc -l | tr -d ' ')" "$name"
      printf -- '--\n'
      printf -- '-- Paste this whole file into the Supabase SQL editor and Run, then move on\n'
      printf -- '-- to the next part. Run them in order; each one is safe to run twice.\n'
      printf -- '-- ============================================================================\n\n'
      cat "$f"
    } > "$dest"
    printf '%s (%s lines)\n' "$dest" "$(wc -l < "$dest" | tr -d ' ')"
  done
  exit 0
fi

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
