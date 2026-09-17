#!/usr/bin/env node
// One-time contract deploy + mock-middleware registration + admin onboarding
// (README "Getting Started", docs/deliverables.md DL-5.1 prerequisites).
// Besu has no persistent chain volume in docker-compose.yml (D-15): every
// `docker compose down` wipes it back to genesis — so this always redeploys
// fresh contracts rather than trusting a possibly stale
// deployed-addresses.json, then re-registers both contracts with
// mock-middleware (ON CONFLICT UPDATE — no restart needed for the registry
// itself, D-07). mock-middleware's nonce cache *does* need an explicit
// resync after the deploy step, though: NonceTracker caches admin's nonce
// and persists it (so a mid-flight reservation survives a restart) — but
// deploy.ts sends 9 transactions from that same admin key straight to
// chain, bypassing mock-middleware entirely (the one deliberate exception
// to D-06 — see docs/deliverables.md DL-2.x). Left unsynced,
// mock-middleware's cached nonce goes stale and every write after this
// point fails with "nonce has already been used" — a plain container
// restart does NOT fix this, since the stale value is exactly what gets
// reloaded from its persisted nonces table.

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const BESU_RPC_URL = "http://localhost:8545";
const MOCK_MIDDLEWARE_URL = "http://localhost:5001";
const BACKEND_URL = "http://localhost:4000";
const CONTRACTS_DIR = path.join(__dirname, "..", "contracts");
const DEPLOYED_ADDRESSES_PATH = path.join(__dirname, "..", "deployed-addresses.json");

function run(cmd, opts = {}) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilOk(label, check, tries = 30, delayMs = 2000) {
  for (let i = 0; i < tries; i++) {
    try {
      if (await check()) return;
    } catch {
      // not ready yet — retry
    }
    await sleep(delayMs);
  }
  throw new Error(`${label} did not become ready after ${tries} attempts`);
}

async function registerContract(name, address, abi, template) {
  const res = await fetch(`${MOCK_MIDDLEWARE_URL}/admin/contracts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, address, abi, template }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`register ${name} failed: ${json.error ?? res.status}`);
  }
  return json;
}

async function api(path_, body) {
  const res = await fetch(`${BACKEND_URL}${path_}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`POST ${path_} failed: ${json.error ?? res.status}`);
  }
  return json;
}

async function main() {
  console.log("1. Waiting for Besu RPC...");
  await waitUntilOk("Besu RPC", async () => {
    const res = await fetch(BESU_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
    });
    return res.ok;
  });

  console.log("2. Deploying contracts (always fresh)...");
  run("npm run deploy:besu", { cwd: CONTRACTS_DIR });

  console.log("3. Waiting for mock-middleware...");
  await waitUntilOk("mock-middleware", async () => (await fetch(`${MOCK_MIDDLEWARE_URL}/admin/nonce-status`)).ok);

  console.log("4. Resyncing mock-middleware's nonce cache with the deploy's on-chain activity...");
  const resyncRes = await fetch(`${MOCK_MIDDLEWARE_URL}/admin/nonces/resync`, { method: "POST" });
  if (!resyncRes.ok) {
    throw new Error(`nonce resync failed: ${resyncRes.status}`);
  }
  console.log("   nonces:", await resyncRes.json());

  console.log("5. Registering token + identityRegistry with mock-middleware...");
  const deployed = JSON.parse(fs.readFileSync(DEPLOYED_ADDRESSES_PATH, "utf-8"));
  const tokenArtifact = JSON.parse(fs.readFileSync(path.join(CONTRACTS_DIR, "artifacts/contracts/Token.sol/Token.json"), "utf-8"));
  const registryArtifact = JSON.parse(fs.readFileSync(path.join(CONTRACTS_DIR, "artifacts/contracts/IdentityRegistry.sol/IdentityRegistry.json"), "utf-8"));
  await registerContract("token", deployed.token, tokenArtifact.abi, "ERC3643Token");
  await registerContract("identityRegistry", deployed.identityRegistry, registryArtifact.abi);

  console.log("6. Waiting for backend-api...");
  await waitUntilOk("backend-api", async () => (await fetch(`${BACKEND_URL}/transfers`)).ok);

  console.log("7. Onboarding Anson and Beatrice, minting a starting balance...");
  for (const who of ["anson", "beatrice"]) {
    await api("/admin/register-identity", { who });
    await api("/admin/issue-claim", { who });
  }
  await api("/admin/mint", { who: "anson", amount: 1000 });

  console.log("Seed complete — Anson has 1000 COIN, Beatrice is verified with 0 COIN.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
