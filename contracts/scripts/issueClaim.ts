import { ethers } from "hardhat";
import { KYC_TOPIC, loadDeployedAddresses } from "./utils";

/// `WALLET=<address> npx hardhat run scripts/issueClaim.ts --network besu`
/// Issues the KYC claim as Admin, who is the registered TrustedIssuer for it (D-02).
async function main() {
  const wallet = process.env.WALLET;
  if (!wallet || !ethers.isAddress(wallet)) {
    throw new Error(`Usage: WALLET=<address> hardhat run issueClaim.ts. Got WALLET=${wallet}`);
  }

  const [admin] = await ethers.getSigners();
  const { identityRegistry } = loadDeployedAddresses();
  const registry = await ethers.getContractAt("IdentityRegistry", identityRegistry, admin);

  await (await registry.issueClaim(wallet, KYC_TOPIC)).wait();
  console.log(`claim issued: ${wallet}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
