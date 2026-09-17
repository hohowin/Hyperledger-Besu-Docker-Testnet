import { test, expect } from "@playwright/test";

/// DL-5.3 / D-11: the Explorer tab reads from either RPC node independently
/// via backend-api's proxy. Switching "View as" must keep reporting a
/// consistent chain — both nodes agree within a small margin (not
/// sub-block-period exact, since real wall-clock time passes between the
/// two reads in a UI test — the chain keeps producing blocks every 2s).
test("Explorer tab browses blocks/tx and agrees across both RPC nodes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explorer" }).click();

  await expect(page.getByLabel("View as")).toHaveValue("anson");
  await expect(page.getByTestId("explorer-latest-block")).toBeVisible();
  const ansonText = await page.getByTestId("explorer-latest-block").textContent();
  const ansonBlock = Number(ansonText?.match(/Latest block:\s*(\d+)/)?.[1]);
  expect(Number.isInteger(ansonBlock)).toBe(true);

  // Click a recent block, then a transaction inside it (if any).
  await page.locator('[data-testid="block-list"] tbody tr').first().click();
  await expect(page.getByTestId("block-detail")).toBeVisible();

  const txRows = page.locator('[data-testid="block-detail"] table tbody tr');
  if ((await txRows.count()) > 0) {
    await txRows.first().click();
    await expect(page.getByTestId("tx-detail")).toContainText("Status:");
  }

  await page.getByLabel("View as").selectOption("beatrice");
  await expect
    .poll(async () => {
      const text = await page.getByTestId("explorer-latest-block").textContent();
      const beatriceBlock = Number(text?.match(/Latest block:\s*(\d+)/)?.[1]);
      return Math.abs(beatriceBlock - ansonBlock) <= 5;
    })
    .toBe(true);
});
