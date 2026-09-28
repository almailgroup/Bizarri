# Bizarri

A premium private chalet website for **Bizarri** by Almail Group (Kuwait) — a
bilingual (English / Arabic) marketing site with an online booking request
flow and a photo gallery.

Built with React 19, [TanStack Router](https://tanstack.com/router),
[Tailwind CSS v4](https://tailwindcss.com), and [Supabase](https://supabase.com).
It ships as a fully static single-page app and is deployed to **GitHub Pages**.

## Repository structure

The repo is split into two top-level folders so it's obvious what runs in the
browser and what runs on Supabase:

```
frontend/    The React app. Everything here ends up in the static bundle
             GitHub Pages serves — see frontend/src/, or run `bun run dev`.
backend/
  supabase/  Schema, RLS policies, booking logic, and Edge Functions. Applied
             to Supabase directly; none of it ships to the browser. Nested
             under backend/ rather than renamed, because the Supabase CLI
             requires the folder itself to be called `supabase`.
```

Nothing else at the repo root is part of the app: `.github/` holds the deploy
workflow.

## Tech stack

| Area        | Choice                                             |
| ----------- | -------------------------------------------------- |
| Framework   | React 19 + TanStack Router (file-based routing)    |
| Build tool  | Vite 7                                             |
| Styling     | Tailwind CSS v4 + shadcn/ui (Radix) components      |
| Data / auth | Supabase Postgres + Auth, with RLS on every table  |
| Hosting     | GitHub Pages (static)                              |

## Local development

Requires [Bun](https://bun.sh) (or Node 20+ with npm).

```bash
cd frontend
bun install
bun run dev      # start the dev server
bun run build    # production build → frontend/dist/
bun run preview  # preview the production build locally
bun run lint     # eslint
```

Supabase credentials live in `frontend/.env` (`VITE_SUPABASE_*`). These are the
**public** publishable/anon keys and are safe to commit — data access is
protected by Supabase Row Level Security, not by keeping the key secret.

The backend (schema, RLS, booking logic, Edge Functions) lives in
[`backend/supabase/`](backend/supabase/README.md), which documents the design
and how to deploy it. **The booking, offers, news and admin pages need those
migrations applied to a real Supabase project to work** — without that, the
rest of the site still renders, but those pages show a "could not load" error
instead of data. `backend/supabase/tests/run.sh` exercises the SQL against a
throwaway Postgres, no live project needed.

## Switching to a new Supabase project

Use this whenever the site needs to point at a different Supabase account or
project — a fresh account, a new org, or the current project was deleted.

1. **Create the project.** [supabase.com/dashboard](https://supabase.com/dashboard)
   → New project. Note its **Project URL**, **anon/publishable key**, and
   **project ref** (Settings → API and Settings → General).

2. **Point the app at it.** Edit `frontend/.env`:

   ```bash
   VITE_SUPABASE_URL="https://<new-project-ref>.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="<new anon/publishable key>"
   VITE_SUPABASE_PROJECT_ID="<new-project-ref>"

   # Non-VITE_ mirrors, used by the SSR fallback path in
   # frontend/src/integrations/supabase/client.ts — keep these in sync
   SUPABASE_URL="https://<new-project-ref>.supabase.co"
   SUPABASE_PUBLISHABLE_KEY="<new anon/publishable key>"
   SUPABASE_PROJECT_ID="<new-project-ref>"
   ```

3. **Apply the schema.** Requires the
   [Supabase CLI](https://supabase.com/docs/guides/cli) and the project's
   database password (Settings → Database):

   ```bash
   cd backend
   supabase login
   supabase link --project-ref <new-project-ref>
   supabase db push
   ```

   **Without the CLI:** `backend/supabase/bundle.sh > schema.sql` concatenates
   the migrations into one script to paste into the Supabase SQL editor
   (Dashboard → SQL Editor → New query → Run). It is idempotent, so running it
   twice is harmless. This also creates the private `civil-ids` storage bucket
   and its policies.

4. **Deploy the Edge Functions and their secrets:**

   ```bash
   supabase functions deploy notify-booking
   supabase functions deploy send-email-code
   supabase secrets set RESEND_API_KEY=...          # REQUIRED: one-time codes
   supabase secrets set NOTIFY_EMAILS=admin@almailgroup.com
   supabase secrets set CALLMEBOT_PHONE=96594040955 # optional: booking WhatsApp alerts
   supabase secrets set CALLMEBOT_APIKEY=...
   supabase secrets set ALLOWED_ORIGINS=https://bizarri.com,https://www.bizarri.com
   ```

   **`RESEND_API_KEY` is not optional any more.** A guest must confirm their
   email with a mailed code before a booking goes through, so without the key
   nobody can book. If mail is not set up yet, turn the gate off:

   ```sql
   update public.settings set value = 'false'::jsonb
    where key = 'require_email_verification';
   ```

   Both `NOTIFY_EMAILS` and the `CALLMEBOT_*` pair are just fallbacks — day
   to day, recipients for both channels are managed from the admin panel's
   Site Settings tab, no redeploy needed. See
   [`backend/supabase/README.md`](backend/supabase/README.md#adding-a-whatsapp-number)
   for how to get a CallMeBot API key.

5. **Create the admin account.** Dashboard → Authentication → Users → *Add
   user* (email + password). Then, in the SQL editor, grant it admin rights —
   there is deliberately no API path that does this, so it has to be run by
   hand:

   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'the-admin-email@example.com';
   ```

   Without this step, signing in works but the dashboard reports no access —
   that's the intended behavior, not a bug: being authenticated and being an
   admin are checked separately.

6. **Check the storage bucket.** Dashboard → Storage should list a private
   `civil-ids` bucket, created by step 3. Guests upload their Civil ID there
   at checkout; only admins can read it, through a signed URL.

7. **(Optional) Wire up booking email notifications.** Dashboard → Database →
   Webhooks → *Create*: table `public.bookings`, event **Insert**, type
   **Supabase Edge Function**, function `notify-booking`.

8. **Commit and deploy.** Push the updated `frontend/.env` — it's safe to
   commit, see above — to the branch GitHub Pages builds from. The next
   deploy picks up the new project automatically.

9. **Verify.** Visit the live site: `/offers` and `/news` should load without
   errors, `/booking` should show an availability calendar, and `/admin`
   should let the account from step 5 sign in and reach the dashboard.

Full design notes (why the schema looks the way it does, what each RLS policy
allows) are in [`backend/supabase/README.md`](backend/supabase/README.md).

## Deployment (GitHub Pages)

Deployment is automated via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
On every push it builds `frontend/` and publishes `frontend/dist/` to GitHub
Pages.

One-time setup in the repository:

1. Go to **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.

3. Under **Custom domain**, enter `bizarri.com` and tick **Enforce HTTPS**
   once the certificate has been issued.

The site is served at `https://bizarri.com/`, and the language is the **last**
segment of every URL: `https://bizarri.com/booking/en`,
`https://bizarri.com/booking/ar`, with the homepage at `/en` and `/ar`. The
bare domain redirects to whichever language the visitor last used, or the one
their browser asks for. Two older shapes still work rather than 404: `/booking`
(before languages) and `/en/booking` (the prefix, which shipped briefly).

The build writes a real `index.html` for every page in both languages, not just
one at the root. Without those files GitHub Pages would answer `/booking/en`
with `404.html`: the page renders, because the router takes over, but the HTTP
status is 404 and search engines drop it. `404.html` remains the fallback for
anything else, and `frontend/public/CNAME` carries the domain into every deploy
so the Pages setting is not lost.

`https://<owner>.github.io/Bizarri/` redirects to the domain; GitHub does that
itself once a custom domain is set.

### Serving from a sub-path again

The Vite `base` defaults to `/`. To go back to a project page, set the
`BASE_PATH` build variable in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) to `/Bizarri/`,
delete `frontend/public/CNAME`, and change the absolute URLs in
`frontend/index.html`, `frontend/public/sitemap.xml` and
`frontend/public/robots.txt` back. Getting `base` wrong is what a blank page
looks like: the HTML loads, every asset URL 404s, and no JavaScript runs.

### Adding a language

1. Add it to `Lang`, `LANGS` and `langFromPath` in
   [`frontend/src/lib/i18n.tsx`](frontend/src/lib/i18n.tsx), and give every
   entry in the dictionary a translation.
2. Add it to `LANGS` in [`frontend/vite.config.ts`](frontend/vite.config.ts) so
   the build writes its pages.
3. Regenerate `frontend/public/sitemap.xml` and add its `Disallow: /admin/<lang>`
   line to `robots.txt`.

The routes themselves need no change: the language is the `$lang` parameter at
the end of each one.

### Adding a page

Name it `<slug>.$lang.tsx` in `frontend/src/routes/`, and give it
`beforeLoad: requireLang` so a URL ending in something that is not a language
404s. The build picks it up for both languages automatically —
`vite.config.ts` reads the route directory rather than keeping its own list.
Add it to the sitemap by hand.
