import * as fs from "fs";
import * as path from "path";

export const KYC_TOPIC = 1;

export const DEPLOYED_ADDRESSES_PATH = path.join(__dirname, "..", "..", "deployed-addresses.json");

export interface DeployedAddresses {
  claimTopicsRegistry: string;
  trustedIssuersRegistry: string;
  identityRegistryStorage: string;
  identityRegistry: string;
  compliance: string;
  token: string;
}

export function loadDeployedAddresses(): DeployedAddresses {
  if (!fs.existsSync(DEPLOYED_ADDRESSES_PATH)) {
    throw new Error(
      `deployed-addresses.json not found at ${DEPLOYED_ADDRESSES_PATH} — run scripts/deploy.ts first`,
    );
  }
  return JSON.parse(fs.readFileSync(DEPLOYED_ADDRESSES_PATH, "utf-8"));
}

export function saveDeployedAddresses(addresses: DeployedAddresses): void {
  fs.writeFileSync(DEPLOYED_ADDRESSES_PATH, JSON.stringify(addresses, null, 2) + "\n");
}
