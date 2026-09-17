import { DatabaseSync } from "node:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";

export interface TransferRecord {
  from: string;
  to: string;
  amount: number;
  txHash: string;
  timestamp: string;
}

export interface AuditLogRepositoryLike {
  recordTransfer(record: TransferRecord): void;
  listTransfers(): TransferRecord[];
}

/// The only module that knows the SQLite schema. Single-table, no ORM —
/// direct queries are simple enough for one flat log (architecture.md §9,
/// §6: keeps persistence details out of the API layer and TransferService).
/// node:sqlite (`DatabaseSync`) rather than better-sqlite3 — avoids a
/// native-compile dependency (node-gyp + a C++ toolchain) for a
/// single-table demo log.
export class AuditLogRepository implements AuditLogRepositoryLike {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        "from" TEXT NOT NULL,
        "to" TEXT NOT NULL,
        amount INTEGER NOT NULL,
        txHash TEXT NOT NULL,
        timestamp TEXT NOT NULL
      )
    `);
  }

  recordTransfer(record: TransferRecord): void {
    this.db
      .prepare(`INSERT INTO transfers ("from", "to", amount, txHash, timestamp) VALUES (?, ?, ?, ?, ?)`)
      .run(record.from, record.to, record.amount, record.txHash, record.timestamp);
  }

  listTransfers(): TransferRecord[] {
    return this.db
      .prepare(`SELECT "from", "to", amount, txHash, timestamp FROM transfers ORDER BY id ASC`)
      .all() as unknown as TransferRecord[];
  }
}
