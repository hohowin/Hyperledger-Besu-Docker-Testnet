import { ethers } from "ethers";
import { Identity } from "../identities";

/// Narrow surface the service layer depends on, so tests can supply a fake
/// without touching a real HTTP client. D-06 (locked): mock-middleware is
/// the *only* chain transport for backend-api — no direct-ethers
/// implementation of this interface exists at all, no toggle to bypass it.
export interface ChainServiceLike {
  getAddress(identity: Identity): string;
  identityRegistry(asIdentity?: Identity): ethers.Contract;
  token(asIdentity?: Identity): ethers.Contract;
  resetNonce(identity: Identity): void;
}
