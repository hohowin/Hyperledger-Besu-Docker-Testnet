import { ethers } from "hardhat";
import { loadDeployedAddresses } from "./utils";

/// `WALLET=<address> AMOUNT=<n> npx hardhat run scripts/mintToken.ts --network besu`
async function main() {
  const wallet = process.env.WALLET;
  const amount = Number(process.env.AMOUNT);

  if (!wallet || !ethers.isAddress(wallet) || !Number.isInteger(amount) || amount <= 0) {
    throw new Error(`Usage: WALLET=<address> AMOUNT=<n> hardhat run mintToken.ts. Got WALLET=${wallet} AMOUNT=${process.env.AMOUNT}`);
  }

  const [admin] = await ethers.getSigners();
  const { token } = loadDeployedAddresses();
  const tokenContract = await ethers.getContractAt("Token", token, admin);

  await (await tokenContract.mint(wallet, amount)).wait();
  console.log(`minted ${amount} COIN to ${wallet}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
