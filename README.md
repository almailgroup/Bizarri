# Bizarri

A premium private chalet website for **Bizarri** by Almail Group (Kuwait) — a
bilingual (English / Arabic) marketing site with an online booking request flow,
photo gallery, and an "Almail AI" concierge chat powered by Supabase Edge
Functions.

Built with React 19, [TanStack Router](https://tanstack.com/router),
[Tailwind CSS v4](https://tailwindcss.com), and [Supabase](https://supabase.com).
It ships as a fully static single-page app and is deployed to **GitHub Pages**.

## Tech stack

| Area        | Choice                                             |
| ----------- | -------------------------------------------------- |
| Framework   | React 19 + TanStack Router (file-based routing)    |
| Build tool  | Vite 7                                             |
| Styling     | Tailwind CSS v4 + shadcn/ui (Radix) components     |
| Data / auth | Supabase (browser client, public anon key)         |
| AI features | Supabase Edge Functions (`chat`, `generate-image`) |
| Hosting     | GitHub Pages (static)                              |

## Local development

Requires [Bun](https://bun.sh) (or Node 20+ with npm).

```bash
bun install
bun run dev      # start the dev server
bun run build    # production build → dist/
bun run preview  # preview the production build locally
bun run lint     # eslint
```

Supabase credentials live in `.env` (`VITE_SUPABASE_*`). These are the **public**
publishable/anon keys and are safe to commit — data access is protected by
Supabase Row Level Security. The Edge Functions in `supabase/functions/` are
deployed separately via the Supabase CLI and are not part of the static build.

## Deployment (GitHub Pages)

Deployment is automated via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
On every push it builds the SPA and publishes `dist/` to GitHub Pages.

One-time setup in the repository:

1. Go to **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.

The site is served at `https://<owner>.github.io/Bizarri/`. The Vite `base`
path (`/Bizarri/`) is set for that URL; `dist/index.html` is also copied to
`dist/404.html` so deep links resolve through client-side routing.

### Using a custom domain

Set the `BASE_PATH` build variable to `/` and add a `CNAME` file to the build
output (or configure the domain under Settings → Pages). Update `base` handling
in [`vite.config.ts`](vite.config.ts) accordingly.
