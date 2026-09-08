# Integration tests

Playwright scripts that drive the built site against a mocked Supabase (route
interception, not a live project) to check things a type checker can't:
booking rules, RLS-shaped auth behavior in the UI, timezone-sensitive date
rendering, and the specific bugs listed in each file's assertions.

## Running

```bash
cd frontend
bun run build
bun run preview --port 4173 &     # serves the build at :4173
npx playwright install chromium   # first time only
bun run test:integration
```

If Playwright can't find a browser, point it at one explicitly:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium bun run test:integration
```

- `be-test.mjs` — the app calls the right RPCs with the right arguments, no
  price is ever sent from the client, and the old hardcoded admin password is
  absent from the built bundle.
- `fixes.mjs` — regression coverage for confirmation-screen date rendering,
  the calendar's fetch-window horizon, and the guest booking lookup panel.
- `authtest.mjs` — signing out (and a different user signing in) clears
  cached admin data; a non-admin is refused rather than shown a cached
  dashboard.

These need `frontend/dist` built and served; they don't touch a real Supabase
project. The database-level test suite lives in
[`backend/supabase/tests/`](../../backend/supabase/tests/run.sh) instead.
