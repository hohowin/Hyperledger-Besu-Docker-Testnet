import { DatabaseSync } from "node:sqlite";

export type TxStatus = "pending" | "confirmed" | "error";

export interface TxRecord {
  key: string;
  identity: string;
  contractName: string;
  method: string;
  params: unknown[];
  nonce: number;
  txHash: string;
  status: TxStatus;
  errorMessage: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

interface TxRow {
  key: string;
  identity: string;
  contract_name: string;
  method: string;
  params_json: string;
  nonce: number;
  tx_hash: string;
  status: TxStatus;
  error_message: string | null;
  created_at: string;
  confirmed_at: string | null;
}

/// D-08: duplicate `Idempotency-Key` writes return the original receipt,
/// never resubmit. Dedup is by client-supplied key, not by hashing
/// (contract, method, params, from) — two legitimately identical consecutive
/// transfers must not be silently dropped (architecture.md §6).
export class IdempotencyStore {
  constructor(private readonly db: DatabaseSync) {}

  find(key: string): TxRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM idempotency_keys WHERE key = ?`).get(key) as TxRow | undefined;
    return row ? rowToRecord(row) : undefined;
  }

  /// Lets a caller poll settlement by the tx hash it was handed back at
  /// submission time (backend-api's MockMiddlewareChainService.wait()) — the
  /// write endpoint's response is a fast ack, not a receipt (architecture.md
  /// §4: "202 + async settlement").
  findByTxHash(txHash: string): TxRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM idempotency_keys WHERE tx_hash = ?`).get(txHash) as TxRow | undefined;
    return row ? rowToRecord(row) : undefined;
  }

  record(entry: Omit<TxRecord, "createdAt" | "confirmedAt" | "errorMessage"> & { errorMessage?: string | null }): void {
    this.db
      .prepare(
        `INSERT INTO idempotency_keys (key, identity, contract_name, method, params_json, nonce, tx_hash, status, error_message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.key,
        entry.identity,
        entry.contractName,
        entry.method,
        JSON.stringify(entry.params),
        entry.nonce,
        entry.txHash,
        entry.status,
        entry.errorMessage ?? null,
        new Date().toISOString(),
      );
  }

  updateStatus(key: string, status: TxStatus, errorMessage?: string): void {
    this.db
      .prepare(`UPDATE idempotency_keys SET status = ?, error_message = ?, confirmed_at = ? WHERE key = ?`)
      .run(status, errorMessage ?? null, status === "confirmed" ? new Date().toISOString() : null, key);
  }

  listByIdentity(identity: string): TxRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM idempotency_keys WHERE identity = ? ORDER BY nonce ASC`)
      .all(identity) as unknown as TxRow[];
    return rows.map(rowToRecord);
  }
}

function rowToRecord(row: TxRow): TxRecord {
  return {
    key: row.key,
    identity: row.identity,
    contractName: row.contract_name,
    method: row.method,
    params: JSON.parse(row.params_json),
    nonce: row.nonce,
    txHash: row.tx_hash,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
  };
}
