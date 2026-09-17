import { DatabaseSync } from "node:sqlite";

export interface ContractRegistration {
  name: string;
  address: string;
  abi: unknown[];
  template: string | null;
}

/// DL-3.1 / D-07: the set of callable contracts can't be hardcoded — upload
/// an ABI, get REST for free. SQLite-persisted so registration survives a
/// `docker compose restart mock-middleware`.
export interface ContractRegistryServiceLike {
  register(entry: { name: string; address: string; abi: unknown[]; template?: string }): ContractRegistration;
  get(name: string): ContractRegistration | undefined;
  list(): ContractRegistration[];
}

interface ContractRow {
  name: string;
  address: string;
  abi: string;
  template: string | null;
}

export class ContractRegistryService implements ContractRegistryServiceLike {
  constructor(private readonly db: DatabaseSync) {}

  register(entry: { name: string; address: string; abi: unknown[]; template?: string }): ContractRegistration {
    const record: ContractRegistration = {
      name: entry.name,
      address: entry.address,
      abi: entry.abi,
      template: entry.template ?? null,
    };
    this.db
      .prepare(
        `INSERT INTO contracts (name, address, abi, template, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET address = excluded.address, abi = excluded.abi, template = excluded.template`,
      )
      .run(record.name, record.address, JSON.stringify(record.abi), record.template, new Date().toISOString());
    return record;
  }

  get(name: string): ContractRegistration | undefined {
    const row = this.db.prepare(`SELECT name, address, abi, template FROM contracts WHERE name = ?`).get(name) as
      | ContractRow
      | undefined;
    if (!row) return undefined;
    return rowToRecord(row);
  }

  list(): ContractRegistration[] {
    const rows = this.db.prepare(`SELECT name, address, abi, template FROM contracts`).all() as unknown as ContractRow[];
    return rows.map(rowToRecord);
  }
}

function rowToRecord(row: ContractRow): ContractRegistration {
  return { name: row.name, address: row.address, abi: JSON.parse(row.abi), template: row.template };
}
