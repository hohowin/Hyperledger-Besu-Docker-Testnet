import { NextFunction, Request, Response, Router } from "express";
import { ContractRegistryServiceLike } from "../services/ContractRegistryService";
import { ContractGatewayService } from "../services/ContractGatewayService";
import { NonceTracker } from "../services/NonceTracker";
import { IdempotencyStore } from "../services/IdempotencyStore";
import { IDENTITIES } from "../identities";
import { toJsonSafe } from "./jsonSafe";

export interface RouterDeps {
  registry: ContractRegistryServiceLike;
  gateway: ContractGatewayService;
  nonces: NonceTracker;
  idempotency: IdempotencyStore;
}

export function createRouter(deps: RouterDeps): Router {
  const router = Router();

  // DL-3.1: ABI upload -> dynamic REST, no gateway code change or redeploy.
  router.post("/admin/contracts", (req: Request, res: Response) => {
    const { name, address, abi, template } = req.body as {
      name?: string;
      address?: string;
      abi?: unknown[];
      template?: string;
    };
    if (!name || !address || !Array.isArray(abi)) {
      res.status(400).json({ error: "name, address, and abi are required" });
      return;
    }
    const entry = deps.registry.register({ name, address, abi, template });
    deps.gateway.watch(name);
    res.status(200).json({ name: entry.name, address: entry.address, template: entry.template });
  });

  // DL-3.3: per-identity nonce, pending queue, last confirmed tx.
  router.get("/admin/nonce-status", (_req: Request, res: Response) => {
    const status: Record<string, { nonce: number; pending: number; lastConfirmedTx: string | null }> = {};
    for (const identity of IDENTITIES) {
      const txs = deps.idempotency.listByIdentity(identity);
      const pending = txs.filter((t) => t.status === "pending");
      const confirmed = txs.filter((t) => t.status === "confirmed");
      const last = confirmed[confirmed.length - 1];
      status[identity] = {
        nonce: deps.nonces.peek(identity),
        pending: pending.length,
        lastConfirmedTx: last ? last.txHash : null,
      };
    }
    res.status(200).json(status);
  });

  router.get("/contracts/:name/:method", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = req.query.params ? (JSON.parse(String(req.query.params)) as unknown[]) : [];
      const output = await deps.gateway.callRead(req.params.name, req.params.method, params);
      res.status(200).json({ output: toJsonSafe(output) });
    } catch (err) {
      next(err);
    }
  });

  router.post("/contracts/:name/:method", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idempotencyKey = req.header("Idempotency-Key");
      if (!idempotencyKey) {
        res.status(400).json({ error: "Idempotency-Key header is required" });
        return;
      }
      const { params, from } = req.body as { params?: unknown[]; from?: string };
      const result = await deps.gateway.callWrite(req.params.name, req.params.method, params ?? [], from ?? "", idempotencyKey);
      res.status(result.status === "already_processed" ? 200 : 202).json(result);
    } catch (err) {
      next(err);
    }
  });

  // Re-reads every identity's nonce straight from chain, discarding the
  // cached/persisted value — needed after contracts/scripts/* sends
  // transactions from the same admin key directly to chain, bypassing this
  // gateway entirely (npm run seed calls this right after every deploy).
  router.post("/admin/nonces/resync", async (_req: Request, res: Response) => {
    const result: Record<string, number> = {};
    for (const identity of IDENTITIES) {
      result[identity] = await deps.nonces.resync(identity);
    }
    res.status(200).json(result);
  });

  // Lets a caller poll settlement of a tx by the hash the write endpoint
  // handed back — the write itself only acks broadcast, not confirmation.
  router.get("/admin/receipts/:id", (req: Request, res: Response) => {
    const record = deps.idempotency.findByTxHash(req.params.id);
    if (!record) {
      res.status(404).json({ error: "unknown transaction" });
      return;
    }
    res.status(200).json({ id: record.txHash, status: record.status, error: record.errorMessage ?? undefined });
  });

  return router;
}
