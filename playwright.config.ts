import { defineConfig, devices } from "@playwright/test";

/// D-21: 6 specs against the full running stack. Does NOT auto-start docker
/// compose or the frontend dev server — the whole 9-container stack must
/// already be up (see docs/deliverables.md DL-5.4 "How to try it"), since
/// the E2E suite proves the already-running stack works, not that it can be
/// started.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  // All specs mutate the same real chain state through the same fixed
  // identities (mock-middleware owns one nonce sequence per identity) —
  // running spec files in parallel workers races on that nonce. Force full
  // serialization instead of just within-file.
  workers: 1,
  retries: 0,
  reporter: "html",
  // Every admin/transfer action waits for a real Besu block to confirm the
  // underlying transaction before the API responds — plain DOM-interaction
  // timeouts are too tight for that.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    // The containerized frontend (docker-compose.yml, nginx serving the
    // production build), matching docs/deliverables.md's documented flow
    // (docker compose up -d && npm run seed && npx playwright test), not
    // the :5173 Vite dev server used during local iteration.
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
