import { DatabaseSync } from "node:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";

/// Three tables cover the module split in architecture.md §3: `contracts`
/// (ContractRegistryService), `idempotency_keys` (IdempotencyStore — also
/// doubles as the per-identity tx log NonceTracker's status queries read
/// from), and `nonces` (NonceTracker's own reserved-nonce counters). No ORM
/// — direct queries, same convention as backend-api's AuditLogRepository.
export function openDatabase(dbPath: string): DatabaseSync {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS contracts (
      name TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      abi TEXT NOT NULL,
      template TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      identity TEXT NOT NULL,
      contract_name TEXT NOT NULL,
      method TEXT NOT NULL,
      params_json TEXT NOT NULL,
      nonce INTEGER NOT NULL,
      tx_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL,
      confirmed_at TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS nonces (
      identity TEXT PRIMARY KEY,
      next_nonce INTEGER NOT NULL
    )
  `);

  return db;
}
