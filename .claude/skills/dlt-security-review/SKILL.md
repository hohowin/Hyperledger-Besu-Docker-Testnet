---
name: dlt-security-review
description: Review DLT/blockchain code — Solidity contracts and any backend code that signs or submits transactions — against a structured taxonomy of known attack patterns across the consensus, smart-contract, network/P2P, key-management, and economic/governance layers. Trigger with "security review the contracts", "audit the smart contracts", "check for DLT attack patterns", "review this for blockchain vulnerabilities", or when reviewing changes to *.sol files, ChainService-shaped modules, or anything that handles a private key.
argument-hint: "[file or directory to review — defaults to contracts/, backend-api/src/chain/, kaleido-mock/src/chain.ts, or equivalent chain-facing code]"
---

# /dlt-security-review

Claude-driven static review — no external tooling (Slither/Mythril) required or invoked. Read the target code and reason against each pattern below; don't just pattern-match keywords. A finding needs a concrete failure scenario (who can trigger it, what state it corrupts or leaks), same bar as `/code-review`.

## Usage

```
/dlt-security-review [path]
```

If no path given: review all Solidity under `contracts/contracts/` (or wherever `*.sol` lives), plus any TypeScript/JS module that holds a private key or calls `.sendTransaction`/a contract's state-changing method (grep for `ethers.Wallet`, `NonceManager`, `PRIVATE_KEY` to find them if not obvious from prior context).

## Attack Taxonomy

For each pattern: mark **Found** (concrete instance in this code), **Mitigated** (pattern is relevant but the code already guards against it — say how), or **N/A** (doesn't apply to this system's actual architecture — say why, don't just assume). An N/A still needs a one-line justification tied to the real design (e.g. "PoW-only, this chain is QBFT" is a justification; "probably fine" is not.

### 1. Consensus layer
- **Majority/51% attack** (PoW) — attacker controls enough hashpower to rewrite history. Check consensus algorithm first; irrelevant to BFT/QBFT/IBFT and most PoS designs.
- **BFT validator collusion / Byzantine threshold** — QBFT/IBFT-style consensus tolerates up to ⌊(n-1)/3⌋ Byzantine validators; below that, liveness or safety breaks. Check validator set size (`genesis.json` / `qbft-config.json` or equivalent) — a validator count of 1 isn't "tolerates 0 Byzantine nodes," it's "any single fault halts the chain," a materially worse failure mode worth calling out explicitly, not glossing over as "meets the BFT threshold."
- **Long-range attack** (PoS) — attacker forks from an old block using since-rotated-out keys. N/A for PoW and most BFT designs; check if relevant for PoS.
- **Nothing-at-stake** (PoS) — validators can equivocate across forks for free. N/A outside PoS.
- **Selfish mining** (PoW) — withhold found blocks to gain unfair advantage. N/A outside PoW.
- **Eclipse attack on a validator/node** — isolate a node's peer connections to feed it a false view of the chain. More dangerous the smaller and less diverse the peer set — a single-validator or few-node private network is not automatically safe from this just because it's permissioned.

### 2. Smart contract layer
- **Reentrancy** — external call before state update lets the callee re-enter and act on stale state. Check every function with an external call (`.call`, `.transfer` to a contract, or calling out to another contract) for state writes happening *after* that call. Solidity's Checks-Effects-Interactions ordering, or an explicit reentrancy guard, are the two standard mitigations — note which (if either) is used.
- **Access control gaps** — a state-changing function missing an owner/role/allowlist check, or checking the wrong thing (e.g. gating on `tx.origin` instead of `msg.sender`, which breaks under a contract-mediated call). Enumerate every `public`/`external` non-view function and confirm each has an explicit, correct authorization check — including ones that look internal-only but aren't marked as such.
- **Integer overflow/underflow** — silent wraparound corrupting balances or counters. Solidity ≥0.8.0 has checked arithmetic by default (mark Mitigated with the compiler version as evidence); flag any `unchecked { }` block as needing its own justification.
- **Front-running / MEV** — a pending transaction's parameters are visible in the mempool before confirmation, letting someone else act first (e.g. sandwich a trade, snipe a claim). Relevant wherever profit depends on transaction ordering; largely moot on a private zero-fee network with no competing public mempool, but say so explicitly rather than skipping it.
- **Oracle manipulation** — a price or data feed the contract trusts can be manipulated (e.g. via a flash-loan-inflated AMM price) to trigger bad contract behavior. N/A if there's no external oracle/price feed dependency.
- **Flash loan attacks** — borrowing a large uncollateralized sum within one transaction to manipulate price, voting power, or collateral ratios. N/A without lending/AMM/governance-by-token-balance in scope.
- **Delegatecall / proxy storage collision** — an upgradeable proxy's storage layout drifting from its implementation contract, or an untrusted `delegatecall` target. N/A without a proxy/upgrade pattern.
- **Denial of service via unbounded loops or external-call reverts** — a function that loops over unbounded on-chain data, or that reverts entirely if one external call in a batch fails, can be permanently jammed. Check any loop bound by contract-controlled state (array length, mapping iteration) for an attacker-growable size.

### 3. Network / P2P layer
- **Sybil attack** — attacker creates many fake identities/nodes to gain disproportionate influence over peer selection or voting. Structurally mitigated on a permissioned network with an allowlisted validator/peer set — confirm the set is actually allowlisted (`--host-allowlist`, static peers, or equivalent), not just "permissioned in spirit."
- **DDoS on RPC/API endpoints** — flooding a node's JSON-RPC or an application's REST API to exhaust resources. Check for rate limiting, and note explicitly if none exists plus what actually bounds the blast radius (e.g. localhost-only binding, no public exposure).
- **Eclipse attack** — see Consensus layer above; also applies to any node whose peer view an application trusts for reads.

### 4. Key management / application layer
- **Private key exposure** — key material in source control, logs, error messages, or API responses. Grep for hardcoded hex strings matching key length, and confirm no error path echoes a raw signer/wallet object back to a caller.
- **Single point of key custody** — one key (or one small set) that, if compromised, grants total control (mint, verify, transfer-restriction bypass, etc.) with no rotation or multi-party mitigation. Not automatically a bug — many demo/PoC systems accept this — but it must be an *explicit, documented* accepted risk, not an implicit gap.
- **ECDSA nonce reuse (signature nonce, not transaction nonce)** — reusing the same `k` value across two ECDSA signatures from the same key leaks the private key via basic algebra. Only relevant to custom/manual signing code; standard library signing (ethers.js, web3.js) generates nonces deterministically per RFC 6979 and is not vulnerable — don't confuse this with transaction nonce management (see below).
- **Transaction nonce mismanagement** — concurrent sends from one signer racing on the same "next nonce" (causing "nonce too low"/"already used" failures), or a nonce reserved during transaction preparation that never gets released when the transaction is never actually broadcast (e.g. a gas-estimation revert), permanently blocking every later send from that signer. Check any code path that submits a transaction on behalf of more than one logical identity from a shared process.
- **Replay attacks** — a valid signed transaction or message being resubmitted, on the same chain or a different one, to trigger the action twice. Standard library transaction signing includes `chainId` by default (mark Mitigated); flag any custom off-chain message signing (e.g. a `personal_sign`-style auth flow) that doesn't include a nonce, expiry, or domain separator.
- **Signature malleability** — a valid ECDSA signature can be transformed into a second, different-looking but still-valid signature for the same message, breaking any logic that uses a signature's hash as a uniqueness key. Standard library signing normalizes `s` to the lower half of the curve order by default — mark Mitigated with that as evidence, unless custom signature-verification logic is present.

### 5. Economic / governance layer
- **Governance takeover via flash-loaned voting power** — borrow tokens, vote, repay, all in one transaction. N/A without on-chain token-weighted governance.
- **Rug pull via centralized admin power** — an admin/owner role that can unilaterally drain funds, mint unlimited supply, or freeze user assets. Not automatically a bug if disclosed — check whether the power is documented as an accepted design tradeoff versus quietly present.
- **Compliance/authorization enforced only off-chain** — a permission or transfer-restriction check that exists only in a backend/API layer and can be bypassed by calling the contract directly. This is the single most important thing to verify for any permissioned-token or compliance-flavored contract: confirm the restriction is enforced *inside* the contract's own state-changing function, not just in whatever frontend or backend happens to call it.

## Output

```markdown
## DLT Security Review: [path reviewed]

### Findings (Found)
| # | Layer | Pattern | File:Line | Failure Scenario | Severity |
|---|-------|---------|-----------|-------------------|----------|

### Mitigated
| # | Layer | Pattern | Mitigation | Evidence |
|---|-------|---------|------------|----------|

### Not Applicable
| # | Layer | Pattern | Why N/A |
|---|-------|---------|---------|

### Verdict
[Summary: any Found items are the actionable output; Mitigated/N/A rows are there so a reader doesn't have to wonder whether a pattern was checked at all.]
```

## Notes

- This taxonomy is deliberately broader than any one codebase needs — a permissioned single-chain demo will have a long N/A list, and that's the correct outcome, not a sign the review was shallow. The value is in forcing an explicit answer for every pattern rather than silently skipping the ones that don't obviously apply.
- Don't stop at the Solidity layer. The key-management and transaction-nonce patterns live in whatever backend process holds signing keys — review that code with equal weight.
- If the codebase has its own documented risk register (e.g. an architecture doc's security section), cross-reference rather than duplicate: point out where a Found item is already tracked there versus genuinely new.
