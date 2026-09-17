import { test, expect } from "@playwright/test";

/// DL-5.2 step 5 / US-011 rejection path: sending to an address that was
/// never onboarded reverts on-chain, and the UI must surface a readable
/// error without ever appearing to move funds. "Admin" is used as the
/// never-verified recipient (see TransferDashboard.tsx) — it is a real,
/// currently-unverified identity in this fixed 3-identity demo (D-02), not
/// a fabricated address, so this proves the actual contract-level guarantee
/// (D-01) end to end rather than a UI-only stub.
test("transfer to a never-verified identity is rejected without moving funds", async ({ page }) => {
  await page.goto("/");

  // Ensure Anson is onboarded and funded, independent of test order.
  await page.getByRole("button", { name: "Admin" }).click();
  const ansonCard = page.getByTestId("admin-card-anson");
  await ansonCard.getByRole("button", { name: "Register Anson" }).click();
  await expect(ansonCard.getByRole("status")).toHaveText("registered");
  await ansonCard.getByRole("button", { name: "Issue Claim" }).click();
  await expect(ansonCard.getByRole("status")).toHaveText("verified");
  await ansonCard.getByRole("spinbutton", { name: "Mint amount for Anson" }).fill("5");
  await ansonCard.getByRole("button", { name: "Mint" }).click();
  await expect(ansonCard.getByRole("status")).toHaveText("minted");

  await page.getByRole("button", { name: "Transfer" }).click();
  await page.getByLabel("Acting as").selectOption("anson");

  const balanceText = await page.locator(".balance").textContent();
  const balanceBefore = Number(balanceText?.match(/Balance:\s*(\d+)/)?.[1]);
  expect(Number.isInteger(balanceBefore)).toBe(true);

  const historyRowsBefore = await page.locator("table tbody tr").count();

  await page.getByLabel("Send to").selectOption("admin");
  await page.getByLabel("Transfer amount").fill("1");
  await page.getByRole("button", { name: "Send" }).click();

  const status = page.getByRole("status");
  await expect(status).toContainText("not verified");

  // Balances and history must be untouched by a rejected transfer.
  await expect(page.locator(".balance")).toHaveText(`Balance: ${balanceBefore} COIN`);
  await expect(page.locator("table tbody tr")).toHaveCount(historyRowsBefore);
});
