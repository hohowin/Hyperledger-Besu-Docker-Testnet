import { ethers } from "hardhat";
import { loadDeployedAddresses } from "./utils";

/// `WALLET=<address> npx hardhat run scripts/registerIdentity.ts --network besu`
/// (Hardhat 2.x's `run` task does not support `--` positional passthrough to scripts.)
async function main() {
  const wallet = process.env.WALLET;
  if (!wallet || !ethers.isAddress(wallet)) {
    throw new Error(`Usage: WALLET=<address> hardhat run registerIdentity.ts. Got WALLET=${wallet}`);
  }

  const [admin] = await ethers.getSigners();
  const { identityRegistry } = loadDeployedAddresses();
  const registry = await ethers.getContractAt("IdentityRegistry", identityRegistry, admin);

  await (await registry.registerIdentity(wallet)).wait();
  console.log(`registered: ${wallet}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
