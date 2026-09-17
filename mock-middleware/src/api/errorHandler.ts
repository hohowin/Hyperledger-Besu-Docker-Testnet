import { NextFunction, Request, Response } from "express";
import { ContractGatewayError } from "../services/ContractGatewayService";

/// A revert or bad request surfaces as a readable 4xx, never a raw RPC error
/// or stack trace — R4/§10: private keys and internals must never leak
/// through a response body. Must be registered last (Express convention).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ContractGatewayError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal server error" });
}
