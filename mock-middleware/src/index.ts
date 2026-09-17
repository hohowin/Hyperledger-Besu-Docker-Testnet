import * as dotenv from "dotenv";
import * as path from "path";
import { ethers } from "ethers";
import { openDatabase } from "./db/db";
import { ContractRegistryService } from "./services/ContractRegistryService";
import { IdempotencyStore } from "./services/IdempotencyStore";
import { NonceTracker } from "./services/NonceTracker";
import { EventSubscriptionService } from "./services/EventSubscriptionService";
import { ContractGatewayService } from "./services/ContractGatewayService";
import { createSigners, loadPrivateKeysFromEnv } from "./chain/provider";
import { IDENTITIES } from "./identities";
import { createServer } from "./api/server";
import { attachWebSocketServer } from "./ws/wsServer";

dotenv.config({ path: path.join(__dirname, "..", "..", ".env.local") });

const PORT = Number(process.env.PORT ?? 5001);
const RPC_URL = process.env.BESU_RPC_URL ?? "http://localhost:8545";
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, "..", "mock-middleware.db");

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signers = createSigners(provider, loadPrivateKeysFromEnv(process.env));

  const db = openDatabase(DB_PATH);
  const registry = new ContractRegistryService(db);
  const idempotency = new IdempotencyStore(db);
  const nonces = new NonceTracker(db, async (identity) => {
    const address = signers[identity as keyof typeof signers].address;
    return provider.getTransactionCount(address, "pending");
  });
  await nonces.init(IDENTITIES);

  const events = new EventSubscriptionService();
  const gateway = new ContractGatewayService(registry, idempotency, nonces, provider, signers, events);

  // Re-attach event listeners for any contracts already registered from a prior run.
  for (const entry of registry.list()) {
    gateway.watch(entry.name);
  }

  const app = createServer({ registry, gateway, nonces, idempotency });
  const httpServer = app.listen(PORT, () => {
    console.log(`mock-middleware listening on :${PORT}`);
  });
  attachWebSocketServer(httpServer, events);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
