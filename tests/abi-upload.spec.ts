import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/// DL-5.1 / D-07: the Admin tab's Upload Contract form registers a new ABI
/// with mock-middleware (proxied through backend-api) — no gateway code
/// change or redeploy, and the newly registered name is immediately
/// callable, proving the dynamic-dispatch mechanism end to end from the UI.
test("admin uploads a contract ABI and it becomes immediately callable", async ({ page }) => {
  const deployed = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployed-addresses.json"), "utf-8"));
  const artifact = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "contracts", "artifacts", "contracts", "Token.sol", "Token.json"), "utf-8"));

  await page.goto("/");
  await page.getByRole("button", { name: "Admin" }).click();

  const form = page.getByTestId("upload-contract-form");
  await form.getByLabel("Contract name").fill("token-e2e-upload");
  await form.getByLabel("Contract address").fill(deployed.token);
  await form.getByLabel("Contract ABI").fill(JSON.stringify(artifact.abi));
  await form.getByRole("button", { name: "Upload" }).click();

  await expect(form.getByRole("status")).toHaveText("uploaded");

  // Ground truth: the newly registered name is immediately callable via
  // mock-middleware, not just accepted by the form.
  const res = await page.request.get("http://localhost:5001/contracts/token-e2e-upload/name");
  const body = (await res.json()) as { output: string };
  expect(body.output).toBe("Coin");
});
