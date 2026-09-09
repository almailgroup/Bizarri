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

4. **Deploy the Edge Functions and their secrets:**

   ```bash
   supabase functions deploy notify-booking
   supabase secrets set RESEND_API_KEY=...          # optional: booking emails
   supabase secrets set NOTIFY_EMAILS=admin@almailgroup.com
   supabase secrets set CALLMEBOT_PHONE=96594040955 # optional: booking WhatsApp alerts
   supabase secrets set CALLMEBOT_APIKEY=...
   supabase secrets set ALLOWED_ORIGINS=https://almailgroup.github.io
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

6. **(Optional) Wire up booking email notifications.** Dashboard → Database →
   Webhooks → *Create*: table `public.bookings`, event **Insert**, type
   **Supabase Edge Function**, function `notify-booking`.

7. **Commit and deploy.** Push the updated `frontend/.env` — it's safe to
   commit, see above — to the branch GitHub Pages builds from. The next
   deploy picks up the new project automatically.

8. **Verify.** Visit the live site: `/offers` and `/news` should load without
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

The site is served at `https://<owner>.github.io/Bizarri/`. The Vite `base`
path (`/Bizarri/`) is set for that URL; `dist/index.html` is also copied to
`dist/404.html` so deep links resolve through client-side routing.

### Using a custom domain

Set the `BASE_PATH` build variable to `/` and add a `CNAME` file to the build
output (or configure the domain under Settings → Pages). Update `base` handling
in [`frontend/vite.config.ts`](frontend/vite.config.ts) accordingly.
