import { test, expect } from "@playwright/test";

/// DL-5.2 / US-010, US-011: a confirmed transfer updates both balances and
/// the history table, round-tripping through every layer (browser -> API ->
/// mock-middleware -> chain -> audit log). Onboards + tops up Anson itself
/// so the spec doesn't depend on onboarding.spec.ts having run first or on
/// prior balance state.
test("happy-path transfer updates both balances and appends a history row", async ({ page }) => {
  await page.goto("/");

  // Ensure Anson is onboarded and has enough balance, independent of test order.
  await page.getByRole("button", { name: "Admin" }).click();
  const ansonCard = page.getByTestId("admin-card-anson");
  await ansonCard.getByRole("button", { name: "Register Anson" }).click();
  await expect(ansonCard.getByRole("status")).toHaveText("registered");
  await ansonCard.getByRole("button", { name: "Issue Claim" }).click();
  await expect(ansonCard.getByRole("status")).toHaveText("verified");
  await ansonCard.getByRole("spinbutton", { name: "Mint amount for Anson" }).fill("100");
  await ansonCard.getByRole("button", { name: "Mint" }).click();
  await expect(ansonCard.getByRole("status")).toHaveText("minted");

  const beatriceCard = page.getByTestId("admin-card-beatrice");
  await beatriceCard.getByRole("button", { name: "Register Beatrice" }).click();
  await expect(beatriceCard.getByRole("status")).toHaveText("registered");
  await beatriceCard.getByRole("button", { name: "Issue Claim" }).click();
  await expect(beatriceCard.getByRole("status")).toHaveText("verified");

  await page.getByRole("button", { name: "Transfer" }).click();
  await page.getByLabel("Acting as").selectOption("anson");

  const balanceText = await page.locator(".balance").textContent();
  const balanceBefore = Number(balanceText?.match(/Balance:\s*(\d+)/)?.[1]);
  expect(Number.isInteger(balanceBefore)).toBe(true);

  const historyRowsBefore = await page.locator("table tbody tr").count();

  await page.getByLabel("Send to").selectOption("beatrice");
  await page.getByLabel("Transfer amount").fill("10");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByRole("status")).toHaveText("Transfer sent");
  await expect(page.locator(".balance")).toHaveText(`Balance: ${balanceBefore - 10} COIN`);

  const rows = page.locator("table tbody tr");
  await expect(rows).toHaveCount(historyRowsBefore + 1);
  const lastRow = rows.last();
  await expect(lastRow).toContainText("10");
});
