import { ethers } from "hardhat";
import { loadDeployedAddresses } from "./utils";

/// `FROM=<addr> TO=<addr> AMOUNT=<n> npx hardhat run scripts/transfer.ts --network besu`
/// FROM must match one of the addresses backing the configured besu network
/// accounts (ADMIN/ANSON/BEATRICE_PRIVATE_KEY in .env.local) — this script
/// signs as whichever local signer resolves to that address.
async function main() {
  const from = process.env.FROM;
  const to = process.env.TO;
  const amount = Number(process.env.AMOUNT);

  if (!from || !to || !ethers.isAddress(from) || !ethers.isAddress(to) || !Number.isInteger(amount) || amount <= 0) {
    throw new Error(
      `Usage: FROM=<addr> TO=<addr> AMOUNT=<n> hardhat run transfer.ts. Got FROM=${from} TO=${to} AMOUNT=${process.env.AMOUNT}`,
    );
  }

  const signers = await ethers.getSigners();
  const fromSigner = signers.find((s) => s.address.toLowerCase() === from.toLowerCase());
  if (!fromSigner) {
    throw new Error(`No local signer for ${from} — check the corresponding *_PRIVATE_KEY in .env.local`);
  }

  const { token } = loadDeployedAddresses();
  const tokenContract = await ethers.getContractAt("Token", token, fromSigner);

  const tx = await tokenContract.transfer(to, amount);
  const receipt = await tx.wait();
  console.log(`transferred ${amount} COIN, tx: ${receipt?.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
