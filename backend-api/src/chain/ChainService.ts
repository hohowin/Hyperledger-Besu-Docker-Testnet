import { ethers } from "ethers";
import { Identity } from "../identities";

/// Narrow surface the service layer depends on, so tests can supply a fake
/// without touching a real HTTP client. D-06 (locked): mock-middleware is
/// the *default and only* chain transport for backend-api — unlike
/// my-besu-net's optional CHAIN_TRANSPORT toggle, there is no direct-ethers
/// implementation of this interface here at all.
export interface ChainServiceLike {
  getAddress(identity: Identity): string;
  identityRegistry(asIdentity?: Identity): ethers.Contract;
  token(asIdentity?: Identity): ethers.Contract;
  resetNonce(identity: Identity): void;
}
