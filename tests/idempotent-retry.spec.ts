import { test, expect } from "@playwright/test";

/// DL-5.2 / D-08: the Admin tab's debug panel resends the exact same
/// Idempotency-Key on a second click — mock-middleware must return the same
/// tx id and must not mint a second time.
test("clicking the idempotent-retry debug button twice mints only once", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Admin" }).click();

  const balanceBefore = await fetchActualBalance(page, "anson");

  const panel = page.getByTestId("idempotent-retry-panel");
  await panel.getByRole("button", { name: "Send Mint (debug)" }).click();
  await expect(panel.getByRole("status")).toHaveText("pending");
  const firstId = await panel.getByTestId("idempotent-retry-id").textContent();

  await panel.getByRole("button", { name: "Send Mint (debug)" }).click();
  await expect(panel.getByRole("status")).toHaveText("already_processed");
  const secondId = await panel.getByTestId("idempotent-retry-id").textContent();

  expect(secondId).toBe(firstId);
  await expect.poll(() => fetchActualBalance(page, "anson")).toBe(balanceBefore + 1);
});

async function fetchActualBalance(page: import("@playwright/test").Page, who: string): Promise<number> {
  const res = await page.request.get(`http://localhost:4000/balance/${who}`);
  const body = (await res.json()) as { balance: number };
  return body.balance;
}
