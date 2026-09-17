import { test, expect } from "@playwright/test";

/// DL-5.1 / US-009: Admin onboards both demo identities through the
/// dashboard alone, no CLI. Idempotent by design (US-003) — safe to run
/// against a stack that already has Anson/Beatrice onboarded from a prior
/// run, since register/issueClaim are no-ops on an already-onboarded wallet
/// and this spec only asserts on the balance delta from its own mint.
test("admin onboards Anson and Beatrice via register -> issue claim -> mint", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Admin" }).click();

  for (const name of ["Anson", "Beatrice"] as const) {
    const card = page.getByTestId(`admin-card-${name.toLowerCase()}`);

    await card.getByRole("button", { name: `Register ${name}` }).click();
    await expect(card.getByRole("status")).toHaveText("registered");

    await card.getByRole("button", { name: "Issue Claim" }).click();
    await expect(card.getByRole("status")).toHaveText("verified");

    // Ground truth from the backend, not the AdminPanel's local state — the
    // panel never fetches an identity's balance on load (only after a mint
    // response in *this* session), so a null local balance does not mean
    // the on-chain balance is 0: this chain persists across every prior
    // test run and manual walkthrough.
    const balanceBefore = await fetchActualBalance(page, name.toLowerCase());
    await card.getByRole("spinbutton", { name: `Mint amount for ${name}` }).fill("1");
    await card.getByRole("button", { name: "Mint" }).click();
    await expect(card.getByRole("status")).toHaveText("minted");
    await expect.poll(() => readBalance(card)).toBe(balanceBefore + 1);
  }
});

async function readBalance(card: import("@playwright/test").Locator): Promise<number | null> {
  // AdminPanel only renders .balance after the first successful mint —
  // .count() resolves immediately with 0 rather than waiting/retrying for
  // an element that may never appear, unlike .textContent()'s auto-wait.
  const balanceLocator = card.locator(".balance");
  if ((await balanceLocator.count()) === 0) return null;
  const text = await balanceLocator.textContent();
  const match = text?.match(/Balance:\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

async function fetchActualBalance(page: import("@playwright/test").Page, who: string): Promise<number> {
  const res = await page.request.get(`http://localhost:4000/balance/${who}`);
  const body = (await res.json()) as { balance: number };
  return body.balance;
}
