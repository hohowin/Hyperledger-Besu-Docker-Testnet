import * as dotenv from "dotenv";
import * as path from "path";
import { MockMiddlewareChainService, loadWalletAddressesFromEnv } from "./chain/MockMiddlewareChainService";
import { ComplianceAdminService } from "./services/ComplianceAdminService";
import { TransferService } from "./services/TransferService";
import { ExplorerProxy } from "./services/ExplorerProxy";
import { GatewayAdminService } from "./services/GatewayAdminService";
import { AuditLogRepository } from "./db/AuditLogRepository";
import { createServer } from "./api/server";

dotenv.config({ path: path.join(__dirname, "..", "..", ".env.local") });

const PORT = Number(process.env.PORT ?? 4000);
const MOCK_MIDDLEWARE_URL = process.env.MOCK_MIDDLEWARE_URL ?? "http://localhost:5001";
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, "..", "data", "transfers.db");

// D-06/D-12: mock-middleware is the only chain transport for business
// orchestration; the Explorer proxy is the sole, deliberate exception,
// talking directly to besu-rpc-* for raw block/tx reads only.
const walletAddresses = loadWalletAddressesFromEnv(process.env);
const chain = new MockMiddlewareChainService(MOCK_MIDDLEWARE_URL, walletAddresses);
const gatewayAdmin = new GatewayAdminService(MOCK_MIDDLEWARE_URL, walletAddresses);

const explorer = new ExplorerProxy({
  anson: process.env.BESU_RPC_ANSON_URL ?? "http://besu-rpc-anson:8545",
  beatrice: process.env.BESU_RPC_BEATRICE_URL ?? "http://besu-rpc-beatrice:8545",
});

const auditLog = new AuditLogRepository(DB_PATH);
const compliance = new ComplianceAdminService(chain);
const transferService = new TransferService(chain, auditLog);

const app = createServer({ chain, compliance, transferService, auditLog, explorer, gatewayAdmin });

app.listen(PORT, () => {
  console.log(`backend-api listening on :${PORT}`);
});
