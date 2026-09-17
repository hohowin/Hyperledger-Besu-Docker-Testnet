# User Manual — Dashboard Reference

> What every tab, button, and field on the dashboard (`http://localhost:3000`) does. For step-by-step scenarios (what to click, in what order, and what it proves), see [docs/playbook.md](playbook.md).

The dashboard has three tabs, always visible in the top nav: **Admin**, **Transfer**, **Explorer**. Only one tab's content is on screen at a time — switching tabs unmounts the others (the Explorer's pending-transfers panel is the one exception: it keeps tracking transfers even while you're not looking at it, see §3).

---

## 1. Admin tab

Everything here talks to `backend-api`, which forwards on to `mock-middleware` (backend-api never touches the chain directly — see `docs/architecture.md`).

### 1.1 Identity cards (Anson, Beatrice)

One card per demo identity. Admin itself has no card — it's the implicit actor behind every button here.

| Element | What it does | API call | Notes |
|---|---|---|---|
| **Register {Name}** button | Registers the wallet address in the on-chain `IdentityRegistry` | `POST /admin/register-identity` | Safe to click repeatedly — the contract itself no-ops if already registered (shows `registered` either way) |
| **Issue Claim** button | Issues the KYC claim topic for that wallet | `POST /admin/issue-claim` | Also idempotent — no-ops if already verified. A wallet must be *registered* before this succeeds |
| **Mint amount** field | The number of COIN to mint on the next click of Mint | — | Plain number input, no API call on its own |
| **Mint** button | Mints the entered amount to that identity | `POST /admin/mint` | Only succeeds if the recipient is *verified* (registered + has the claim). Reveals the "Balance" line once it succeeds |
| **Balance** line | Shows the identity's COIN balance | (comes back in the Mint response) | Only appears after a mint in the *current* browser session — a blank/missing balance line does **not** mean the on-chain balance is 0, it just hasn't been fetched yet |
| **Status line** (below the buttons) | Shows the result of the last action on that card: `registered`, `verified`, `minted`, or an error message | — | Errors here are the raw revert reason from the contract (e.g. `Token: recipient not verified`), not a generic failure |

**Correct order:** Register → Issue Claim → Mint. Minting before the recipient is verified fails with `Token: recipient not verified`.

### 1.2 Upload Contract

Registers a new contract's ABI with `mock-middleware`'s generic gateway — this is how *any* uploaded contract instantly gets a REST surface (`GET/POST /contracts/:name/:method`), not just the two contracts this demo ships with.

| Element | What it does |
|---|---|
| **Name** field | The name you'll call this contract by in the generated REST routes (e.g. `token`) |
| **Address** field | The contract's deployed on-chain address |
| **ABI (JSON array)** field | Paste the contract's ABI as a JSON array (from a Hardhat artifact's `.abi` field, or any standard ABI JSON) |
| **Upload** button | Registers `{name, address, abi}` with `mock-middleware` | `POST /admin/contracts` (proxied through `backend-api` — the browser never talks to `mock-middleware` over REST directly, only via WebSocket, see §3.4) |

Registration is idempotent by name (re-uploading the same name overwrites the address/ABI) and persists across a `mock-middleware` container restart.

### 1.3 Debug: Idempotent Retry

A deliberately exposed internal mechanism, not a normal user action — it exists to let you *see* `mock-middleware`'s exactly-once delivery guarantee working, rather than just trust it.

| Element | What it does |
|---|---|
| **Send Mint (debug)** button | Sends a request to mint 1 COIN to Anson, tagged with a request id generated once when the page loaded |
| **tx: ...** line | Shows the transaction id returned by the last click |

Click it once: a real mint happens, you get a transaction id. Click it again (without reloading the page): you get back the **exact same transaction id**, and no second mint occurs — because the request id (and therefore the `Idempotency-Key` `mock-middleware` sees) hasn't changed. Reloading the page generates a fresh request id, so the next click mints for real again.

---

## 2. Transfer tab

Lets Anson or Beatrice move COIN to each other (or attempt to, to a third, unverified party).

| Element | What it does | Notes |
|---|---|---|
| **Acting as** dropdown | Chooses which identity (Anson or Beatrice) is sending | Switching this also refreshes the Balance line below and auto-picks the other actor as the default recipient |
| **Balance** line | The acting-as identity's current COIN balance | Refetched every time you switch "Acting as" |
| **Send to** dropdown | The recipient: the other actor, or **Admin (unverified)** | Admin is deliberately never onboarded as a token holder — picking it is how you demonstrate the compliance-rejection path, not a mistake |
| **Amount** field | How much COIN to send | Must be a positive integer |
| **Send** button | Executes the transfer | `POST /transfer`. On success: balance updates, a row appears in history. On failure (e.g. unverified recipient): an inline error shows, balance and history are **untouched** — a rejected transfer never appears to have moved funds |
| **Status line** | Shows `Transfer sent` or the revert reason (e.g. `Token: recipient not verified`) | |
| **Transfer history** table | Every *successful* transfer: From / To / Amount / Tx (truncated hash, hover for full) / Timestamp | Failed attempts never appear here — this table is sourced from `backend-api`'s audit log, which is only written after a confirmed on-chain receipt |

---

## 3. Explorer tab

A read-only window into the chain itself — separate from the business-logic layer above. Block/transaction data comes from Besu's raw JSON-RPC via `backend-api`'s Explorer proxy, not through `mock-middleware`'s contract gateway (raw block browsing isn't a contract call).

| Element | What it does | Notes |
|---|---|---|
| **View as** dropdown | Chooses which RPC node (`besu-rpc-anson` or `besu-rpc-beatrice`) to read block/tx data from | Both nodes see the same chain — switching this is how you prove they agree, not how you pick "whose" data you see |
| **Latest block** line | The most recent block number from the selected node | |
| **Pending transactions** panel | Transfers currently in flight, initiated from the Transfer tab | This list is populated the moment you click Send on the Transfer tab and cleared the moment the response comes back — it survives switching to the Explorer tab mid-transfer, because this state is tracked above both tabs, not inside either one |
| **Recent blocks** table | The 10 most recent blocks: Number / Hash / Tx count | Click any row to expand its detail below |
| **Block N** detail card | Lists every transaction hash inside the clicked block, or "No transactions in this block" for an empty one | Click a transaction hash to see its detail |
| **Transaction** detail card | Hash / From / To / Status (`success` or `failed`, from the on-chain receipt) | |
| **Live events** panel | A rolling list of the last 10 on-chain `Transfer` events, pushed in real time | This is the *only* place the browser talks to `mock-middleware` directly — over WebSocket, subscribed by contract template (`ERC3643Token`), never over REST |

---

## Where each tab actually talks to

| Tab | Talks to | Never talks to |
|---|---|---|
| Admin | `backend-api` (REST) | `mock-middleware` or Besu directly |
| Transfer | `backend-api` (REST) | `mock-middleware` or Besu directly |
| Explorer | `backend-api` (REST, for blocks/tx) + `mock-middleware` (WebSocket, for live events only) | `mock-middleware` over REST, Besu directly |

This boundary is deliberate (`docs/architecture.md` §3): the browser never holds a private key and never has a direct line to chain or to the gateway that holds every signing key.
