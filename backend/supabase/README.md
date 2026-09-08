# Bizarri backend

Everything the chalet is run from lives in Postgres: inventory, availability,
pricing, booking requests, news and site settings. The browser holds no
operational state — an admin blocking a date on their phone is immediately true
for a guest on another device.

## Design in one page

**The browser is never trusted with money or availability.** Guests have no
INSERT permission on `bookings`. They call `request_booking()`, which:

1. checks the stay meets the minimum length,
2. re-checks the range is free (not past, not blocked, not already accepted),
3. **re-derives the price from the database** and ignores whatever the client
   thought it was,
4. generates the `BZR-XXXXXX` reference and forces `status = 'pending'`.

The client mirrors the pricing rules in `frontend/src/lib/booking.ts` purely so the
calendar can show a live total without a round-trip. If the two ever disagree,
the database wins.

**Two accepted stays physically cannot overlap.** Not "the code checks" — a
Postgres exclusion constraint:

```sql
exclude using gist (chalet_id with =, daterange(start_date, end_date, '[]') with &&)
  where (status = 'accepted')
```

Pending requests *may* overlap, which is what makes a waiting list possible:
several guests can ask for the same week and the admin picks one. Accepting a
request that would clash fails with a message naming the booking that holds it.

**Admin access is server-side.** `is_admin()` tests membership of the `admins`
table, and every admin RLS policy calls it. Signing in is necessary but not
sufficient. Membership is granted out-of-band — there is deliberately no API
path that adds an admin.

### Pricing

| Case | Result |
|---|---|
| Exact Sun–Sat (7 days) | `rates.full_week` |
| Exact Sun–Wed (4 days) | `rates.weekday` |
| Exact Thu–Sat (3 days) | `rates.weekend` |
| Any other range | sum of per-day rates (Sun–Wed `daily_weekday`, Thu–Sat `daily_weekend`) |
| **Any custom day price in range** | per-day sum, overrides all of the above |

A custom price always wins, so an override is never masked by a flat package
rate.

## Files

This directory is `backend/supabase/` in the repo — the Supabase CLI requires
the folder to be named `supabase`, so it's nested one level under `backend/`
rather than renamed. Run CLI commands from `backend/`, or pass
`--workdir backend` from the repo root.

```
backend/supabase/
  migrations/
    20260906090000_core_schema.sql    tables, constraints, triggers
    20260906090100_booking_logic.sql  pricing + booking functions
    20260906090200_rls.sql            RLS policies, grants, audit trigger
    20260906090300_seed.sql           chalets, default rates, settings
    20260907120000_booking_guards.sql readable validation errors
  functions/
    _shared/http.ts                   CORS headers, shared by notify-booking
    notify-booking/                   email on new booking request
  tests/
    run.sh                            applies migrations to a scratch DB and runs the suites
```

## Deploying

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli) and the
database password (Dashboard → Settings → Database).

```bash
cd backend
supabase login
supabase link --project-ref <your-project-ref>
supabase db push                 # applies supabase/migrations/
supabase functions deploy notify-booking
```

Switching to a different Supabase project (new account, new org, a fresh
project) means re-running `supabase link` with the new project's ref and
updating `frontend/.env` — see the root [README](../../README.md#switching-to-a-new-supabase-project)
for the full checklist.

Then, **once**, in the SQL editor — replace the email with the real admin
account, which must already exist under Authentication → Users:

```sql
insert into public.admins (user_id, email)
select id, email from auth.users where email = 'admin@almailgroup.com';
```

Without this the dashboard signs in and then reports no access, which is the
intended behaviour rather than a bug.

### Function secrets

```bash
supabase secrets set RESEND_API_KEY=...         # optional: booking emails
supabase secrets set NOTIFY_EMAILS=sales@bizarri.com
supabase secrets set ALLOWED_ORIGINS=https://almailgroup.github.io
```

Without `RESEND_API_KEY`, `notify-booking` logs and returns success — a missing
key must never make booking look broken. `ALLOWED_ORIGINS` scopes which
origins its CORS response allows; it defaults to the production site and
local dev if unset.

### Booking notifications

Dashboard → Database → Webhooks → *Create*:

- Table `public.bookings`, event **Insert**
- Type **Supabase Edge Function**, function `notify-booking`

## Running the tests

48 assertions covering pricing, availability, every RLS boundary, the booking
RPC, double-booking prevention and the audit trail.

```bash
backend/supabase/tests/run.sh                # local cluster on :55432
PGPORT=5432 backend/supabase/tests/run.sh    # or your own
```

The runner applies the migrations to a throwaway database owned by a
**non-superuser** role. This matters: a superuser owner bypasses RLS entirely
and would make every policy test pass regardless of whether the policies work.

## Notes for later

- `settings` is public-readable by design (contact details, social links).
  Never put secrets in it.
- `rates` is global rather than per-chalet. Per-chalet pricing means adding a
  `chalet_id` column and a lookup in `quote_stay()`.
