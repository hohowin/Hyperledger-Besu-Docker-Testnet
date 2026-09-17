import { NextFunction, Request, Response, Router } from "express";
import { ChainServiceLike } from "../chain/ChainService";
import { ComplianceAdminService } from "../services/ComplianceAdminService";
import { TransferService } from "../services/TransferService";
import { ExplorerProxy } from "../services/ExplorerProxy";
import { AuditLogRepositoryLike } from "../db/AuditLogRepository";
import { isIdentity } from "../identities";

export interface RouterDeps {
  chain: ChainServiceLike;
  compliance: ComplianceAdminService;
  transferService: TransferService;
  auditLog: AuditLogRepositoryLike;
  explorer: ExplorerProxy;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/// Thin adapter over the service layer (architecture.md §6): no chain calls,
/// no SQL, no business invariants here — only request validation and
/// shaping the REST surface (US-008, US-011).
export function createRouter(deps: RouterDeps): Router {
  const { compliance, transferService, chain, auditLog, explorer } = deps;
  const router = Router();

  router.post("/admin/register-identity", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { who } = req.body ?? {};
      if (!isIdentity(who)) {
        res.status(400).json({ error: "who must be one of admin/anson/beatrice" });
        return;
      }
      res.json(await compliance.registerIdentity(who));
    } catch (err) {
      next(err);
    }
  });

  router.post("/admin/issue-claim", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { who } = req.body ?? {};
      if (!isIdentity(who)) {
        res.status(400).json({ error: "who must be one of admin/anson/beatrice" });
        return;
      }
      res.json(await compliance.issueClaim(who));
    } catch (err) {
      next(err);
    }
  });

  router.post("/admin/mint", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { who, amount } = req.body ?? {};
      if (!isIdentity(who)) {
        res.status(400).json({ error: "who must be one of admin/anson/beatrice" });
        return;
      }
      if (!isPositiveInteger(amount)) {
        res.status(400).json({ error: "amount must be a positive integer" });
        return;
      }
      res.json(await compliance.mint(who, amount));
    } catch (err) {
      next(err);
    }
  });

  router.post("/transfer", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { from, to, amount } = req.body ?? {};
      if (!isIdentity(from) || !isIdentity(to)) {
        res.status(400).json({ error: "from/to must each be one of admin/anson/beatrice" });
        return;
      }
      if (!isPositiveInteger(amount)) {
        res.status(400).json({ error: "amount must be a positive integer" });
        return;
      }
      res.json(await transferService.transfer(from, to, amount));
    } catch (err) {
      next(err);
    }
  });

  router.get("/balance/:who", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { who } = req.params;
      if (!isIdentity(who)) {
        res.status(400).json({ error: "unknown identity" });
        return;
      }
      const address = chain.getAddress(who);
      const balance: bigint = await chain.token().balanceOf(address);
      res.json({ who, balance: Number(balance) });
    } catch (err) {
      next(err);
    }
  });

  router.get("/transfers", (_req: Request, res: Response) => {
    res.json(auditLog.listTransfers());
  });

  // D-12: read-only raw JSON-RPC proxy, bypassing mock-middleware entirely —
  // block/tx browsing isn't a contract call.
  router.get("/explorer/blocks", async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await explorer.listBlocks(req.query.node));
    } catch (err) {
      next(err);
    }
  });

  router.get("/explorer/blocks/:number", async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await explorer.getBlock(req.query.node, req.params.number));
    } catch (err) {
      next(err);
    }
  });

  router.get("/explorer/tx/:hash", async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await explorer.getTransaction(req.query.node, req.params.hash));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
