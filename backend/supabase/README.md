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
| **Overlaps a special occasion** | the occasion's flat price, plus per-day rates for days outside the window |
| **Any custom day price in range** | per-day sum, overrides all of the above |

Precedence runs most-specific first: custom day prices, then special
occasions, then an exact package, then per-day defaults. A custom price always
wins, so an override is never masked by a flat rate.

**Special occasions** (`special_occasions`) are premium windows — Eid and the
like, typically a Thu–Sat — priced at a flat 900 by default instead of the 350
weekend rate. Admins add them from the dashboard's Special Occasions tab; no
migration needed for next year's Eid. Two *active* windows may not cover the
same day, enforced by an exclusion constraint, so a day never has two prices.

### Checkout requirements

`request_booking()` refuses a request that does not carry both:

- `p_civil_id_path` — the object path of an image the guest already uploaded to
  the private `civil-ids` bucket, and
- `p_terms_accepted` — recorded on the row as `terms_accepted_at`.

Both are enforced in the function, not just the form: the form is not the
security boundary. The bucket grants anon INSERT only — no select, update or
delete — so an uploaded ID cannot be read back, overwritten or enumerated by
another visitor. Admins read it through a short-lived signed URL.

### Confirming the email address

A guest must enter a six-digit code mailed to the address they typed before
`request_booking()` will accept it. A mistyped address used to fail silently:
the booking went through, the confirmation bounced, and nobody noticed until
the guest rang.

The shape matters more than it looks:

- `start_email_verification()` mints the code and **returns the plaintext**, so
  it is granted to `service_role` and nothing else. The `send-email-code` Edge
  Function is its only caller. If the browser could call it, verifying an
  address you do not own would be one request.
- Only a salted SHA-256 of the code is stored. It expires in 10 minutes, caps
  at 5 guesses and 5 codes an hour per address.
- `verify_email_code()` **returns false** for a wrong code rather than raising.
  Raising would roll back the attempts increment made in the same statement,
  so the guess counter would never advance and the cap would never fire.

**This puts email delivery on the critical path of every booking.** Without
`RESEND_API_KEY` no code can be sent and no booking can complete. The switch
is the `require_email_verification` setting:

```sql
update public.settings set value = 'false'::jsonb
 where key = 'require_email_verification';
```

It defaults to `true`, including on a fresh database, so a site that has not
been configured is strict rather than quietly open.

### Finding a booking again

Two paths, and they are not equally safe:

- `lookup_booking()` — reference **and** email. The reference is the secret.
- `lookup_booking_by_phone()` — the phone number alone, **with no second
  factor**. Anyone who knows a number can see whether it has a stay booked,
  when, and for how much.

The second is a deliberate choice by the site owner, not an oversight. The
per-number throttle (20 lookups an hour) slows repeated hits on one victim; it
does not make the data private and nothing in the function can. Do not widen
the columns it returns without revisiting that trade.

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
    20260908100000_audit_edits.sql    audit field edits, settings, chalets
    20260921090000_occasions_and_checkout.sql
                                      special occasions, Civil ID + terms gate,
                                      civil-ids storage bucket and its policies
    20260928090000_email_verification_and_phone_lookup.sql
                                      one-time email codes, the gate in front of
                                      request_booking, lookup by phone
  functions/
    _shared/http.ts                   CORS headers, shared by both functions
    notify-booking/                   emails the team and the guest, WhatsApp
    send-email-code/                  mails the one-time code
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
supabase functions deploy send-email-code
```

### Deploying the functions without the CLI

The dashboard's function editor takes one file, and these import a shared
module. `functions/bundle.sh` inlines it, writing a self-contained
`functions/<name>/paste.ts` for each. Paste that into
**Edge Functions → Deploy a new function → Via editor**, named exactly
`notify-booking` and `send-email-code` (the names are in the site's code and in
the webhook).

Regenerate them after changing a function or `_shared/http.ts`; `supabase
functions deploy` ignores them and uses the real sources.

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
supabase secrets set RESEND_API_KEY=...         # REQUIRED: one-time codes
supabase secrets set NOTIFY_EMAILS=admin@almailgroup.com
supabase secrets set CALLMEBOT_PHONE=96594040955   # optional: booking WhatsApp alerts
supabase secrets set CALLMEBOT_APIKEY=...
supabase secrets set ALLOWED_ORIGINS=https://bizarri.com,https://www.bizarri.com
```

`RESEND_API_KEY` is no longer optional. `notify-booking` still treats it as
optional — a failed notification must never make a booking that already
succeeded look broken — but `send-email-code` cannot mint a code without it,
and the form then tells the guest to use WhatsApp rather than asking for a code
that will never arrive. Either set the key or turn `require_email_verification`
off. The CallMeBot pair stays optional: without both, WhatsApp is skipped and
email still goes out. `ALLOWED_ORIGINS` scopes
which origins its CORS response allows; it defaults to the production site
and local dev if unset.

`NOTIFY_EMAILS` and the `CALLMEBOT_*` pair are each a **fallback** — the
primary source is the `notify_emails` / `notify_whatsapp` rows in
`public.settings`, editable from the admin panel's Site Settings tab without
a redeploy. The secrets only matter until an admin sets those, or if the
settings row is ever empty.

#### Adding a WhatsApp number

[CallMeBot](https://www.callmebot.com/blog/free-api-whatsapp-messages/) is a
free, unofficial service — no account, but no uptime guarantee either; it
only sends to the one number that generated a given API key, so each
recipient does their own one-time opt-in:

1. Save `+34 644 59 71 07` as a contact on the phone that should receive alerts.
2. From that phone, send it a WhatsApp message: `I allow callmebot to send me messages`.
3. It replies with an API key.
4. Enter that phone number and key in the admin panel's Site Settings →
   WhatsApp notifications, or as the `CALLMEBOT_PHONE` / `CALLMEBOT_APIKEY`
   secrets above for a single default recipient.

Repeat for every number that should get a WhatsApp alert — a shared key
cannot message a different number.

### Booking notifications

Dashboard → Database → Webhooks → *Create*:

- Table `public.bookings`, event **Insert**
- Type **Supabase Edge Function**, function `notify-booking`

## Running the tests

111 assertions covering pricing (packages, custom days, special occasions),
availability, every RLS boundary, the booking RPC, the Civil ID and terms
gate, the email code and the gate it puts in front of booking, lookup by
phone and its throttle, double-booking prevention and the audit trail.

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
