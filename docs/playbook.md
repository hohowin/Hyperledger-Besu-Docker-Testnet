# Playbook — Scenario Walkthroughs

> Step-by-step: what to click, in what order, and what it proves. For a plain reference of what each button/field does, see [docs/user-manual.md](user-manual.md). Assumes the stack is up and `npm run seed` has already run (see README "Running the Demo, Step by Step") — Anson starts with 1000 COIN, Beatrice with 0, both verified.

Each scenario names the tab, the exact clicks, what you should see, and — under **Why this matters** — what guarantee it's actually demonstrating underneath the UI.

---

## Scenario 1 — Onboard an identity from scratch

Proves: the register → claim → mint sequence, and that it's safe to repeat.

1. **Admin tab.** Find Beatrice's card.
2. Click **Register Beatrice**. Status line shows `registered`.
3. Click **Issue Claim**. Status line shows `verified`.
4. Type `100` in the amount field, click **Mint**. Status line shows `minted`, and a **Balance: 100 COIN** line appears.
5. Click **Register Beatrice** again. Status line still shows `registered` — no error, no duplicate transaction.

**Why this matters:** step 5 proves US-003's idempotency guarantee — registering an already-registered wallet is a contract-level no-op, not a revert. This is why the seed script and the demo scripts can be re-run safely without manual cleanup.

---

## Scenario 2 — Happy-path transfer

Proves: a compliant transfer moves funds and leaves an audit trail.

1. **Transfer tab.** Confirm "Acting as: Anson" and note the Balance line.
2. Confirm "Send to: Beatrice" is selected (it's the default).
3. Type an amount (e.g. `25`) and click **Send**.
4. Status line shows `Transfer sent`. Balance drops by the sent amount. A new row appears at the bottom of the history table with a real transaction hash.

**Why this matters:** the balance and history only update *after* the transaction is confirmed on-chain (`TransferService` awaits the receipt before writing the audit row) — what you see is real settlement, not an optimistic UI guess.

---

## Scenario 3 — Compliance rejection

Proves: the on-chain compliance check is the real authorization boundary, not a UI-layer suggestion.

1. **Transfer tab**, acting as Anson (or Beatrice).
2. Change "Send to" to **Admin (unverified)**.
3. Type any amount, click **Send**.
4. Status line turns red: `Token: recipient not verified`. Balance and history table are **unchanged**.

**Why this matters:** Admin is a real, currently-unverified identity in this demo — this isn't a fabricated error state. The `Token._update` contract hook reverts the transfer regardless of who calls it or how, which is why `backend-api` can't bypass this check even if it tried (see `docs/architecture.md` §10, "Hard boundary").

---

## Scenario 4 — Prove exactly-once delivery (idempotent retry)

Proves: retrying the same write never double-executes it, even though the button looks like an ordinary mint button.

1. **Admin tab**, scroll to **Debug: Idempotent Retry**.
2. Note Anson's current balance (check the Admin card above, or the Transfer tab).
3. Click **Send Mint (debug)**. A `tx: 0x...` line appears with status `pending`.
4. Click **Send Mint (debug)** again (same page, don't reload).
5. The `tx: 0x...` line shows the **identical hash** as step 3, and the status now reads `already_processed`.
6. Check Anson's balance again — it only went up by 1, not 2.

**Why this matters:** this is `mock-middleware`'s `Idempotency-Key` deduplication (D-08) made visible. Both clicks used the same request id generated once when the page loaded, so `mock-middleware` recognized the second POST as a retry of the first and returned the cached receipt instead of resubmitting. Reload the page (a fresh request id is generated) and the next click will mint again for real.

---

## Scenario 5 — Upload a new contract ABI

Proves: `mock-middleware`'s generic ABI gateway works for *any* contract, not just the two this demo ships with.

You'll need a contract's address and ABI. The easiest source is the Token contract already deployed by `npm run seed` — read it from `deployed-addresses.json` (repo root) for the address, and `contracts/artifacts/contracts/Token.sol/Token.json`'s `abi` field for the ABI.

1. **Admin tab**, scroll to **Upload Contract**.
2. Fill **Name** with something new, e.g. `token-copy`.
3. Fill **Address** with the Token contract's address from `deployed-addresses.json`.
4. Paste the ABI JSON array into the **ABI** field.
5. Click **Upload**. Status line shows `uploaded`.
6. Verify it's live: `curl http://localhost:5001/contracts/token-copy/name` from a terminal returns `{"output":"Coin"}`.

**Why this matters:** step 6 is the actual proof — a brand-new name became a working, dynamically-dispatched REST route the instant it was registered, no code change or redeploy (D-07). The frontend form is a thin wrapper; the mechanism is entirely in `mock-middleware`'s `ContractRegistryService`.

---

## Scenario 6 — Watch a transfer settle live

Proves: the pending-transfers panel and the WebSocket event feed both reflect real chain activity, and the pending panel survives switching tabs.

1. **Explorer tab** first — check **Live events** panel; it should say `Waiting for events…` (or show recent activity if others are using the demo).
2. Switch to **Transfer tab**. Start a transfer (any valid amount, acting as Anson to Beatrice) and click **Send** — but don't wait for it to finish, switch tabs immediately.
3. Switch back to **Explorer tab** quickly. You may catch the **Pending transactions** panel showing your transfer in flight before it clears.
4. Check **Live events** — within a couple of seconds, a `Transfer` entry appears with a block number.

**Why this matters:** the pending list is tracked in state lifted above both tabs (`PendingTransfersProvider` in `App.tsx`), which is why it doesn't reset when you switch away from Transfer — this mirrors DL-5.3's requirement that the pending panel reflects real in-flight state, not just whatever tab happens to be open. The Live events entry is pushed over `mock-middleware`'s WebSocket the moment the `Transfer` event is mined — it's the same mechanism Scenario 5's dynamically-registered contracts would also emit events through, filtered by contract template rather than a hardcoded address.

---

## Scenario 7 — Compare the two RPC nodes

Proves: `besu-rpc-anson` and `besu-rpc-beatrice` are independent nodes that agree on chain state, not two views of the same process.

1. **Explorer tab.** Confirm "View as: Anson", note the **Latest block** number.
2. Click a row in **Recent blocks** to open its detail — note the block hash shown in the table.
3. Switch **View as** to **Beatrice**.
4. Compare: the latest block number should be close (both nodes are producing/receiving the same chain, roughly 2s per block — Beatrice's number may be a few blocks ahead if some time passed). Find the same block number in Beatrice's list and confirm the hash matches what you saw under Anson.

**Why this matters:** this is the practical version of Phase 1's fault-tolerance proof — two independently peered, non-validating full nodes reporting identical chain state confirms the "2 RPC nodes, one per investor" topology (D-03) actually works, not just that two containers happen to be running.

---

## Quick reference — which scenario tests which guarantee

| Guarantee | Scenario |
|---|---|
| Idempotent onboarding (US-003) | 1 |
| Compliant transfer settles for real | 2 |
| On-chain compliance is the real boundary | 3 |
| Exactly-once delivery (D-08) | 4 |
| Generic ABI gateway (D-07) | 5 |
| Live event relay + pending-state tracking (D-10) | 6 |
| Two-RPC-node consistency (D-03) | 7 |
