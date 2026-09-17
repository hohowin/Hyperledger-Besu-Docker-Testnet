# Besu Configuration Reference

> A complete reference of Hyperledger Besu's configuration surface: where each kind of setting lives, what every parameter expects, and what's appropriate for a production deployment versus this repo's localhost-only PoC. This repo pins `hyperledger/besu:26.8.1` (`docker-compose.yml`) — flag names and defaults below are accurate for that version; always cross-check against `docker run --rm hyperledger/besu:26.8.1 --help` (or the specific flag's `--help`) before relying on a value for a real deployment, since CLI defaults do shift between Besu releases.
>
> Source: [Hyperledger Besu documentation](https://besu.hyperledger.org) (CLI options and QBFT genesis reference pages), cross-checked against this repo's actual `docker-compose.yml` and `network-config/genesis.json`.

---

## 1. Where Besu gets configured

Besu reads configuration from three places, in this precedence order (highest wins):

1. **CLI flags** — passed directly on the command line (or, in Docker, as the container's `command:` array). This is what this repo uses exclusively — see `docker-compose.yml`.
2. **Environment variables** — every CLI flag has an equivalent `BESU_<FLAG_NAME_UPPERCASE_WITH_UNDERSCORES>` environment variable (e.g. `--rpc-http-enabled` ↔ `BESU_RPC_HTTP_ENABLED`). Not used anywhere in this repo, but a valid alternative to a long `command:` list.
3. **`--config-file` (TOML)** — a single file holding key = value pairs for any flag, referenced via `--config-file=/path/to/config.toml`. Not used in this repo (all config is inline CLI flags in `docker-compose.yml`), but the standard approach for a real deployment where you want config under version control separately from the container command.

Two more configuration surfaces exist **outside** the CLI/TOML/env system entirely:

- **`genesis.json`** (`--genesis-file`) — chain-level parameters fixed at network creation: chain ID, consensus algorithm and its parameters, initial account balances, gas limit, and (for QBFT/IBFT2) the validator set. Covered in §3 below. This is **not** something you can change after the chain has started — changing it means starting a new chain from block 0.
- **`static-nodes.json`** — no CLI flag; Besu auto-discovers this file if it's present in the node's `--data-path` directory. A JSON array of enode URLs this node should always try to connect to on startup. This repo uses it (`network-config/static-nodes.json`) to statically peer all 4 validators without relying on discovery.

### What this repo actually sets

Every Besu container in `docker-compose.yml` sets the same baseline; validators additionally set `--node-private-key-file`, and the RPC nodes additionally publish a host port and enable WebSocket:

| Flag | Value in this repo | Why |
|---|---|---|
| `--data-path` | `/data/db` | Writable state directory inside the container's own layer — no volume mount, so it's wiped on `docker compose down -v` (D-15) |
| `--genesis-file` | `/data/genesis.json` | The shared 4-validator QBFT genesis (read-only mount) |
| `--node-private-key-file` | `/data/key` (validators only) | See `docs/FAQ.md` — this is what actually makes a node a validator, not the container name |
| `--min-gas-price` | `0` | Zero-gas network (D-23) — no native currency needed to transact |
| `--host-allowlist` | `*` | Accepts JSON-RPC `Host` headers from anywhere — acceptable only because bound to localhost/Docker-internal network (D-17, R6); see §5 |
| `--p2p-host` | `0.0.0.0` | Listen on all interfaces inside the container (the container itself is still only reachable via the Docker bridge network unless a port is published) |
| `--p2p-port` | `30303` | Besu's default — unchanged |
| `--rpc-http-enabled` | set | HTTP JSON-RPC on, needed by `mock-middleware`/`backend-api`'s Explorer proxy and by the Admin CLI scripts |
| `--rpc-http-host` | `0.0.0.0` | Same reasoning as `--p2p-host` |
| `--rpc-http-cors-origins` | `*` | Permissive CORS — same accepted-risk reasoning as `--host-allowlist` |
| `--rpc-ws-enabled` | set (RPC nodes only) | WebSocket JSON-RPC — `mock-middleware` uses this to subscribe to on-chain events (D-10) |
| `--rpc-ws-host` | `0.0.0.0` | RPC nodes only |
| `ports:` (compose-level, not a Besu flag) | `8545:8545` / `8555:8545` (RPC nodes only) | Publishes the RPC nodes' JSON-RPC to the host for local `curl`/browser access; validators have no published ports at all |

Everything else in the reference below is **left at Besu's default** in this repo.

---

## 2. Genesis file — general parameters

These live in `genesis.json` at the top level and under `config`, and apply regardless of consensus algorithm.

| Parameter | Type | This repo's value | Description |
|---|---|---|---|
| `config.chainId` | integer | `20260916` | Unique network identifier, included in every transaction's signature (EIP-155) to prevent replay across chains |
| `config.berlinBlock` | integer | `0` | Block height at which the Berlin hard fork's rules activate — `0` means "active from genesis" |
| `nonce` | hex string | `"0x0"` | Genesis block nonce (PoW artifact, unused under QBFT but still a required field) |
| `timestamp` | hex string | `"0x58ee40ba"` | Genesis block timestamp |
| `gasLimit` | hex string | `"0x1fffffffffffff"` | Maximum gas per block at genesis (this repo sets it near the practical maximum, since `min-gas-price=0` means gas cost isn't a real constraint anyway) |
| `difficulty` | hex string | `"0x1"` | Required to be exactly `0x1` for QBFT (not used for actual difficulty adjustment under BFT consensus) |
| `coinbase` | address | `"0x00...00"` | Genesis block's beneficiary address — irrelevant under QBFT, where each block's actual proposer is the beneficiary |
| `alloc` | object | `{}` (empty) | Pre-funded accounts at genesis, as `{"0xaddress": {"balance": "0x..."}}`. Empty here because `min-gas-price=0` means no account needs a starting balance to transact |
| `extraData` | RLP-encoded hex | 4 validator addresses | Consensus-specific payload — see §3 for what it encodes under QBFT |

## 3. Genesis file — QBFT-specific parameters (`config.qbft`)

This repo uses QBFT (not IBFT2 or Clique). All QBFT-specific settings live under `config.qbft` in `genesis.json`.

| Parameter | Type | Default | This repo's value | Description |
|---|---|---|---|---|
| `blockperiodseconds` | integer | `1` | `2` | Minimum time between blocks — the chain will produce a block at least this often even with zero transactions (see `docs/FAQ.md`'s "why does the block count keep going up" answer) |
| `epochlength` | integer | `30000` | `30000` (unchanged) | Number of blocks after which all pending validator-set votes are reset |
| `requesttimeoutseconds` | integer | `1` | `4` | How long a round waits before timing out and triggering a round-change to the next proposer — set higher than the default here to tolerate slower CI/local-machine block production without spurious round-changes |
| `emptyblockperiodseconds` | integer | `0` | *(not set — default)* | When set above `blockperiodseconds`, delays empty blocks specifically while still producing blocks promptly once a transaction is pending |
| `pertxgaslimit` | hex/decimal | `16777216` (2^24) | *(not set — default)* | Per-transaction gas cap, independent of the block gas limit; `0` disables it |
| `blockreward` | hex/decimal | `0` | *(not set — default)* | Wei paid to the block proposer per block — must be identical across every node's genesis or the chain forks |
| `validatorcontractaddress` | address | — | *(not set)* | Only used for the "contract-based validator selection" QBFT mode, where validator membership is read from a smart contract instead of `extraData`/votes. This repo uses the simpler block-header/vote-based mode |
| `startblock` | integer | — | *(not set)* | Only relevant when migrating an existing IBFT 2.0 chain to QBFT |
| `miningbeneficiary` | address | — | *(not set)* | Overrides who receives `blockreward` (defaults to the proposing validator) |
| `gossipedHistoryLimit` | integer | `1000` | *(not set — default)* | Number of prior QBFT consensus messages retained for gossip |
| `messageQueueLimit` | integer | `1000` | *(not set — default)* | Consensus message queue capacity |
| `duplicateMessageLimit` | integer | `100` | *(not set — default)* | Retransmission threshold — official guidance is roughly 2–3× the validator count, so `100` is already generous for this repo's 4 validators |
| `futureMessagesLimit` | integer | `1000` | *(not set — default)* | Buffer size for consensus messages about future block heights |
| `futureMessagesMaxDistance` | integer | `10` | *(not set — default)* | How many blocks ahead a future message may be buffered |

**`extraData` under QBFT** is an RLP-encoded structure containing, in order: 32 bytes of vanity data, the validator address list, any pending validator votes, the round number, and (after the block is sealed) the validators' committed seals. This repo's `extraData` was generated once by `besu operator generate-blockchain-config` at network-creation time (Phase 1, M1.1) and encodes exactly the 4 validator addresses whose private keys live under `network-config/validator-keys/`.

**Two more genesis fields QBFT requires specific values for:**

| Field | Required value | Why |
|---|---|---|
| `difficulty` | `0x1` | Fixed constant — QBFT doesn't use PoW difficulty |
| `mixHash` | `0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365` | An Istanbul-BFT-family identification marker (this repo's genesis doesn't set it explicitly, so Besu applies this default internally for QBFT chains) |

---

## 4. Full CLI reference by category

Every flag below is a `--flag-name value` on the command line (or `BESU_FLAG_NAME=value` as an environment variable — see §1). Booleans are passed as bare flags to enable (e.g. `--rpc-http-enabled`) unless a value is shown.

### 4.1 Node identity & data storage

| Flag | Value | Default | Description |
|---|---|---|---|
| `--data-path` | path | installation dir | Directory Besu stores its database and (if present) reads `static-nodes.json` / `permissions_config.toml` from |
| `--genesis-file` | path | — | Path to the genesis JSON file |
| `--node-private-key-file` | path | auto-generated | The node's P2P/consensus identity key. **This is the flag that determines validator membership** (§1) |
| `--identity` | string | — | A human-readable client name string, shown to peers |
| `--data-storage-format` | `BONSAI` \| `FOREST` | `BONSAI` | Internal state storage format — Bonsai is faster and the modern default; Forest is the older, simpler format |
| `--key-value-storage` | `rocksdb` \| `memory` | `rocksdb` | Underlying KV store — `memory` is for ephemeral/testing use only, never for anything you want to survive a restart |
| `--bonsai-historical-block-limit` | integer | `512` | How many past blocks Bonsai can reconstruct historical state for |
| `--bonsai-limit-trie-logs-enabled` | boolean | `true` | Whether to cap the number of retained Bonsai trie logs |
| `--bonsai-trie-logs-pruning-window-size` | integer | `30000` | How many trie logs get pruned per pruning pass |
| `--bonsai-parallel-tx-processing-enabled` | boolean | `true` | Parallelizes transaction processing under Bonsai |
| `--cache-last-blocks` | integer | `0` | Number of recent full blocks to keep cached in memory |
| `--cache-last-block-headers` | integer | `0` | Number of recent block headers to keep cached |
| `--cache-last-block-headers-preload-enabled` | boolean | `false` | Preloads the header cache at startup instead of lazily |
| `--genesis-state-hash-cache-enabled` | boolean | `false` | Speeds up startup by trusting a cached genesis state hash instead of recomputing it |
| `--profile` | `MINIMALIST_STAKER` \| `STAKER` \| `ENTERPRISE` \| `PERFORMANCE` \| ... | — | Applies a bundle of pre-tuned defaults for a named use case, instead of setting each flag individually |
| `--kzg-trusted-setup` | path | built-in | Trusted setup file for KZG commitments (blob transactions / EIP-4844) |
| `--print-paths-and-exit` | flag | — | Prints resolved data/config paths and exits, without starting the node |

### 4.2 Network / P2P

| Flag | Value | Default | Description |
|---|---|---|---|
| `--network` | `mainnet` \| `sepolia` \| `ephemery` \| ... | `mainnet` | Selects a predefined public network's genesis + bootnodes (irrelevant for a private/permissioned network like this one, which uses `--genesis-file` instead) |
| `--network-id` | integer | matches `--network` | The P2P network identifier peers must match to connect |
| `--p2p-enabled` | boolean | `true` | Master switch for all P2P networking — disabling it isolates the node completely |
| `--p2p-host` | IP | `127.0.0.1` | Advertised P2P host address |
| `--p2p-interface` | IP | `0.0.0.0` | Local network interface to bind P2P to |
| `--p2p-port` | port | `30303` | TCP port for P2P connections |
| `--p2p-discovery-port` | port | same as `--p2p-port` | UDP port for peer discovery |
| `--p2p-host-ipv6` / `--p2p-interface-ipv6` / `--p2p-port-ipv6` / `--p2p-discovery-port-ipv6` / `--p2p-ipv6-outbound-enabled` | — | — | IPv6 equivalents of the above |
| `--p2p-tx-feecap` | wei | unlimited | Maximum transaction fee this node will accept/relay from peers |
| `--bootnodes` | comma-separated enode URLs | network-specific | Initial peers to bootstrap discovery from |
| `--discovery-enabled` | boolean | `true` | Enables the Kademlia-style peer discovery protocol |
| `--discovery-mode` | `V4` \| `V5` \| `BOTH` | `V4` | Which discovery protocol version to run |
| `--discovery-dns-url` | enrtree URL | — | DNS-based node list for discovery |
| `--max-peers` | integer | `25` | Maximum simultaneous P2P connections |
| `--remote-connections-limit-enabled` | boolean | `true` | Whether to cap *inbound* connections separately from `--max-peers` |
| `--remote-connections-max-percentage` | 0–100 | `60` | What fraction of `--max-peers` may be inbound/remote-initiated |
| `--random-peer-priority-enabled` | boolean | `false` | Randomizes which peers get priority, instead of always favoring the longest-connected |
| `--banned-node-ids` | comma-separated node IDs | — | Peers to never connect to |
| `--net-restrict` | comma-separated CIDR ranges | — | Restricts P2P connections to only the listed subnets |
| `--nat-method` | `UPNP` \| `UPNPP2PONLY` \| `DOCKER` \| `AUTO` \| `NONE` | `AUTO` | How Besu advertises itself through NAT/firewalls |
| `--host-allowlist` | comma-separated hostnames, or `*` | `localhost,127.0.0.1` | Which `Host` header values JSON-RPC/metrics endpoints will accept — **this repo sets it to `*`**, an accepted MVP risk only because everything is localhost/Docker-internal (§5) |

### 4.3 Synchronization

| Flag | Value | Default | Description |
|---|---|---|---|
| `--sync-mode` | `FULL` \| `SNAP` \| `CHECKPOINT` | network-specific | How a new node catches up to the current chain head |
| `--checkpoint` | `blockHash:blockNumber:totalDifficulty` | — | A trusted checkpoint to sync from instead of genesis |
| `--required-block` | `blockNumber=blockHash` | — | Requires peers to agree on a specific block, rejecting peers on a different fork |

### 4.4 JSON-RPC (HTTP)

| Flag | Value | Default | Description |
|---|---|---|---|
| `--rpc-http-enabled` | boolean | `false` | Master switch for the HTTP JSON-RPC service — **this repo enables it on every node** |
| `--rpc-http-host` | IP | `127.0.0.1` | Listen address |
| `--rpc-http-port` | port | `8545` | Listen port |
| `--rpc-http-api` | comma-separated API groups | `ETH,NET,WEB3` | Which JSON-RPC namespaces are exposed (e.g. add `ADMIN`, `DEBUG`, `TXPOOL`, `QBFT` as needed) |
| `--rpc-http-cors-origins` | comma-separated origins, or `*` | — | CORS allowlist — **this repo sets `*`**, same accepted-risk reasoning as `--host-allowlist` |
| `--rpc-http-max-active-connections` | integer | `80` | Connection limit |
| `--rpc-http-max-request-content-length` | bytes | `5242880` (5 MiB) | Maximum request body size |
| `--rpc-http-max-batch-size` | integer | `1024` | Maximum requests per JSON-RPC batch call |
| `--rpc-http-authentication-enabled` | boolean | `false` | Requires JWT or username/password auth for HTTP RPC |
| `--rpc-http-authentication-credentials-file` | path | — | Username/password credentials file |
| `--rpc-http-authentication-jwt-algorithm` | `RS256`\|`RS384`\|`RS512`\|`ES256`\|`ES384`\|`ES512` | `RS256` | JWT signing algorithm |
| `--rpc-http-authentication-jwt-public-key-file` | path | — | Public key to verify JWTs against |
| `--rpc-http-api-methods-no-auth` | comma-separated method names | — | Methods exempted from auth even when it's enabled |
| `--rpc-http-tls-enabled` | boolean | `false` | Enables TLS for HTTP RPC |
| `--rpc-http-tls-keystore-file` / `--rpc-http-tls-keystore-password-file` | path | — | TLS server certificate keystore |
| `--rpc-http-tls-protocol` | comma-separated protocols | JDK default TLS protocols | Allowed TLS protocol versions |
| `--rpc-http-tls-cipher-suite` | comma-separated ciphers | — | Allowed cipher suites |
| `--rpc-http-tls-client-auth-enabled` | boolean | `false` | Requires client certificates (mTLS) |
| `--rpc-http-tls-known-clients-file` | path | — | Allowlist of client certificates when using self-signed certs |
| `--rpc-http-tls-ca-clients-enabled` | boolean | `false` | Accepts any client certificate signed by a trusted CA |
| `--rpc-http-tls-truststore-file` / `--rpc-http-tls-truststore-password-file` | path | — | CA truststore for verifying client certs |

### 4.5 JSON-RPC (WebSocket)

| Flag | Value | Default | Description |
|---|---|---|---|
| `--rpc-ws-enabled` | boolean | `false` | Master switch — **this repo enables it on the two RPC nodes only** |
| `--rpc-ws-host` | IP | `127.0.0.1` | Listen address |
| `--rpc-ws-port` | port | `8546` | Listen port |
| `--rpc-ws-api` | comma-separated API groups | `ETH,NET,WEB3` | Namespaces exposed over WebSocket |
| `--rpc-ws-max-active-connections` | integer | `80` | Connection limit |
| `--rpc-ws-max-frame-size` | bytes | `32768` | Maximum WebSocket frame size |
| `--rpc-ws-authentication-enabled` | boolean | `false` | Requires auth for WS connections |
| `--rpc-ws-authentication-credentials-file` | path | — | Username/password file |
| `--rpc-ws-authentication-jwt-algorithm` | see HTTP equivalent | `RS256` | JWT algorithm |
| `--rpc-ws-authentication-jwt-public-key-file` | path | — | JWT verification key |
| `--rpc-ws-api-methods-no-auth` | comma-separated methods | — | Methods exempted from auth |

### 4.6 JSON-RPC — general (applies to both HTTP and WS)

| Flag | Value | Default | Description |
|---|---|---|---|
| `--rpc-gas-cap` | wei | `100000000` | Gas limit for simulation-only calls (`eth_call`, `eth_estimateGas`) |
| `--rpc-tx-feecap` | wei | `1000000000000000000` (1 ETH-equivalent) | Maximum fee `eth_sendRawTransaction` will accept before rejecting the transaction outright |
| `--rpc-max-active-filters` | integer | `1000` | Maximum concurrently open filters (`eth_newFilter` etc.) |
| `--rpc-filter-timeout-seconds` | seconds | `120` | How long an unpolled filter stays alive before expiring |
| `--rpc-max-logs-range` | blocks | `5000` | Maximum block range `eth_getLogs` may query in one call |
| `--rpc-max-trace-filter-range` | blocks | `1000` | Maximum block range for `trace_filter` |
| `--json-pretty-print-enabled` | boolean | `false` | Pretty-prints JSON-RPC responses (debugging convenience, adds overhead) |
| `--revert-reason-enabled` | boolean | `false` | Includes the revert reason string in receipts and `eth_call`/`eth_estimateGas` error responses — **this repo relies on this behavior implicitly** (it's how `mock-middleware`'s `extractRevertReason()` gets a readable message), though Besu returns revert data by default on `eth_call` regardless of this flag; this flag specifically affects whether it's *also* stored in the transaction receipt |
| `--api-gas-price-blocks` | integer | `100` | How many recent blocks `eth_gasPrice` samples from |
| `--api-gas-price-percentile` | decimal | `50.0` | Which percentile of sampled gas prices `eth_gasPrice` returns |
| `--api-gas-price-max` | wei | `500000000000` | Ceiling on the value `eth_gasPrice` will ever return |

### 4.7 GraphQL

| Flag | Value | Default | Description |
|---|---|---|---|
| `--graphql-http-enabled` | boolean | `false` | Master switch — not used anywhere in this repo |
| `--graphql-http-host` / `--graphql-http-port` | IP / port | `127.0.0.1` / `8547` | Listen address |
| `--graphql-http-cors-origins` | comma-separated origins | — | CORS allowlist |
| `--graphql-tls-enabled` / `--graphql-mtls-enabled` | boolean | `false` | TLS / mutual-TLS for GraphQL |
| `--graphql-tls-keystore-file` / `--graphql-tls-keystore-password-file` | path | — | Server certificate |
| `--graphql-tls-truststore-file` / `--graphql-tls-truststore-password-file` | path | — | Client-cert truststore |

### 4.8 Engine API (consensus-client interface — not relevant to a QBFT/BFT chain)

| Flag | Value | Default | Description |
|---|---|---|---|
| `--engine-rpc-enabled` | boolean | `false` | Only relevant for post-Merge PoS chains talking to a separate consensus client — not applicable here |
| `--engine-rpc-port` | port | `8551` | Listen port |
| `--engine-host-allowlist` | comma-separated hostnames | — | Host allowlist specific to the Engine API |
| `--engine-jwt-secret` | path | — | Shared secret file for authenticating the consensus client |
| `--engine-jwt-disabled` | boolean | `false` | Disables Engine API auth (never do this outside of local testing) |

### 4.9 Metrics

| Flag | Value | Default | Description |
|---|---|---|---|
| `--metrics-enabled` | boolean | `false` | Master switch — not used in this repo |
| `--metrics-host` / `--metrics-port` | IP / port | `127.0.0.1` / `9545` | Where Prometheus scrapes from |
| `--metrics-category` | comma-separated categories | all | Which metric categories to expose |
| `--metrics-protocol` | `PROMETHEUS` \| `OPENTELEMETRY` \| `NONE` | `PROMETHEUS` | Export protocol |
| `--metrics-push-enabled` | boolean | `false` | Push instead of pull, via a Prometheus Push Gateway |
| `--metrics-push-host` / `--metrics-push-port` | IP / port | `127.0.0.1` / `9001` | Push Gateway address |
| `--metrics-push-interval` | seconds | `15` | Push frequency |
| `--metrics-push-prometheus-job` | string | `besu-client` | Job name reported to the Push Gateway |

### 4.10 Logging & output

| Flag | Value | Default | Description |
|---|---|---|---|
| `--logging` | `OFF`\|`FATAL`\|`ERROR`\|`WARN`\|`INFO`\|`DEBUG`\|`TRACE`\|`ALL` | `INFO` | Log verbosity |
| `--color-enabled` | boolean | `true` | ANSI color in console output |

### 4.11 Mining / block production

| Flag | Value | Default | Description |
|---|---|---|---|
| `--min-gas-price` | wei | `1000` | Minimum gas price this node will include in a block — **this repo sets `0`** (D-23, zero-gas network) |
| `--min-priority-fee` | wei | `0` | Minimum EIP-1559 priority fee accepted |
| `--miner-extra-data` | 32-byte hex | `0x` | Arbitrary data embedded in blocks this node proposes |
| `--block-txs-selection-max-time` | milliseconds | `5000` | Maximum time spent selecting transactions for a new block before sealing it anyway |
| `--estimate-gas-tolerance-ratio` | decimal | `0.015` | Tolerance band used internally by `eth_estimateGas`'s binary search |

### 4.12 Blob transactions (EIP-4844)

| Flag | Value | Default | Description |
|---|---|---|---|
| `--max-blobs-per-transaction` | integer | `6` | Per-transaction blob cap |
| `--max-blobs-per-block` | integer | hard-fork dependent | Per-block blob cap |

Not relevant to this repo — the Berlin-fork genesis predates blob transactions entirely.

### 4.13 Pruning & historical data

| Flag | Value | Default | Description |
|---|---|---|---|
| `--receipt-compaction-enabled` | boolean | `true` | Compacts stored receipts to save disk |
| `--history-expiry-prune` | boolean | `false` | **Deprecated.** Online pruning of old historical block data |
| `--era1-data-uri` | URI/path | `https://mainnet.era1.nimbus.team/` | Source for importing pre-Merge history via the ERA1 format |
| `--era1-import-prepipeline-enabled` | boolean | `false` | Enables ERA1 import at startup |
| `--era1-import-prepipeline-concurrency` | integer | `1` | Parallelism for ERA1 import |

Not relevant to a fresh private chain like this repo's.

### 4.14 Chain analysis / internals

| Flag | Value | Default | Description |
|---|---|---|---|
| `--auto-log-bloom-caching-enabled` | boolean | `true` | Precomputes log-bloom filters for faster `eth_getLogs` |
| `--reorg-logging-threshold` | integer | `6` | Minimum reorg depth that gets logged |

### 4.15 Ethstats reporting

| Flag | Value | Default | Description |
|---|---|---|---|
| `--ethstats` | URL | — | Reports node stats to an Ethstats dashboard server |
| `--ethstats-contact` | email | — | Contact address shown on the dashboard |
| `--ethstats-cacert-file` | path | — | CA cert for the Ethstats server |
| `--ethstats-report-interval` | seconds | `5` | Reporting frequency |

### 4.16 Plugins

| Flag | Value | Default | Description |
|---|---|---|---|
| `--plugins` | comma-separated plugin names | — | Plugins to load |
| `--plugin-continue-on-error` | boolean | `false` | Continue startup even if a plugin fails to register |
| `--plugins-verification-mode` | `NONE` \| `FULL` | `NONE` | Whether plugin signatures/integrity are verified |
| `--plugin-block-txs-selection-max-time` | 0–100 (%) | `50` | Cap on how much of `--block-txs-selection-max-time` a plugin's transaction-selection hook may consume |

### 4.17 Permissioning *(not covered by the fetched reference page — verify against your Besu version)*

Besu supports two permissioning models, either or both simultaneously: local config-file-based, and onchain smart-contract-based.

| Flag (approximate — verify with `--help`) | Purpose |
|---|---|
| `--permissions-nodes-config-file-enabled` / `--permissions-nodes-config-file` | Restricts which nodes may P2P-connect, via a local `permissions_config.toml` allowlist |
| `--permissions-accounts-config-file-enabled` / `--permissions-accounts-config-file` | Restricts which accounts may submit transactions, via the same local file |
| `--permissions-nodes-contract-enabled` / `--permissions-nodes-contract-address` | Same idea, but membership is read from an onchain smart contract instead of a local file |
| `--permissions-accounts-contract-enabled` / `--permissions-accounts-contract-address` | Onchain account allowlisting |

This repo uses **none of these** — any local caller can act as any identity (D-17, R6, explicitly accepted for a localhost-only PoC). See §5 for what a production network should turn on instead.

### 4.18 Transaction pool *(not covered by the fetched reference page — verify against your Besu version)*

| Flag (approximate — verify with `--help`) | Purpose |
|---|---|
| `--tx-pool` | Selects the pool implementation (`legacy` or `sequenced`) |
| `--tx-pool-max-size` | Maximum number of pending transactions held in the pool |
| `--tx-pool-limit-by-account-percentage` | Caps how much of the pool a single account may occupy |
| `--tx-pool-retention-hours` | How long an unmined transaction stays in the pool before eviction |
| `--tx-pool-price-bump` | Minimum percentage price increase required to replace an existing pending transaction (replace-by-fee) |

This repo's zero-gas, low-throughput demo workload never approaches default pool limits, so none of these are set.

---

## 5. Production hardening — what this repo deliberately skips, and what to set instead

This project is an explicit, disclaimed localhost-only PoC (see README's Compliance Notes, and `docs/plan.md` D-17/R6). If you were taking this topology toward a real deployment, here's the mapping from "accepted risk here" to "what to configure instead":

| This repo's setting | Accepted risk | Production alternative |
|---|---|---|
| `--host-allowlist=*` | Any `Host` header is accepted by JSON-RPC/metrics — an open door if ever exposed beyond localhost | Set to the exact hostnames/IPs that should be allowed, never `*` |
| `--rpc-http-cors-origins=*` | Any web origin can call the RPC API from a browser | Set to your frontend's exact origin(s) |
| No `--rpc-http-authentication-enabled` | Any caller who can reach the port has full RPC access | Enable JWT or credentials-file authentication; put a real authN/authZ layer in front regardless (this repo's entire `backend-api`/`mock-middleware` split exists specifically because *nothing* here does real auth — see `docs/architecture.md` §10) |
| No TLS anywhere (`--rpc-http-tls-enabled` unset, etc.) | All RPC traffic is plaintext | Enable TLS on every RPC/GraphQL/metrics listener that could ever leave a trusted network boundary |
| No `--permissions-*` flags | Any node can peer in, any account can transact | For a permissioned consortium chain, enable node permissioning (allowlist which nodes may even connect) and account permissioning (allowlist which accounts may submit transactions) — this is the P2P/mempool-level analog of what this project's `IdentityRegistry` contract already enforces at the application level |
| No persistent Besu volume (D-15) | Chain resets to genesis on every `docker compose down -v` | Mount `--data-path` to a real persistent volume; never do this for a chain meant to survive a restart |
| `alloc: {}`, no pre-funded accounts | Fine only because `--min-gas-price=0` | A real network with non-zero gas needs `alloc` to pre-fund whichever accounts must pay for their first transaction |
| Validator keys committed to git (`network-config/validator-keys/`) | Fine only because these are throwaway demo keys for a network with no real value, never reachable outside localhost | Real validator keys must never touch version control — use a secrets manager or HSM, and rotate immediately if one is ever exposed |
| 4 validators (`f=1` fault tolerance) | Tolerates exactly 1 simultaneous validator failure (D-04) | Production BFT networks typically run enough validators that losing several at once (maintenance, correlated failure, a bad deploy) still leaves `f` intact — `n=3f+1` scales the same way at any size |
| No metrics (`--metrics-enabled` unset) | No operational visibility beyond container logs | Enable Prometheus metrics on every node in a real deployment — you cannot safely operate a validator set you can't observe |

None of the above is a gap to "fix" in this repo specifically — it's a deliberately scoped local learning project (D-18, D-26), and every item above is either already called out in `docs/plan.md`'s risk register or was an explicit, locked design decision. This table exists so the localhost-only shortcuts are traceable to their production equivalent, not left implicit.
