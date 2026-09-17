import { ethers } from "hardhat";
import { KYC_TOPIC, saveDeployedAddresses } from "./utils";

/// Deploys the trimmed T-REX suite and wires the cross-contract bindings
/// deploy-time only: IdentityRegistryStorage <-> IdentityRegistry,
/// BasicCompliance <-> Token, and Admin as the KYC trusted issuer (D-02).
async function main() {
  const [admin] = await ethers.getSigners();
  console.log(`Deploying as Admin: ${admin.address}`);

  const ClaimTopicsRegistry = await ethers.getContractFactory("ClaimTopicsRegistry");
  const claimTopicsRegistry = await ClaimTopicsRegistry.deploy(admin.address);
  await claimTopicsRegistry.waitForDeployment();

  const TrustedIssuersRegistry = await ethers.getContractFactory("TrustedIssuersRegistry");
  const trustedIssuersRegistry = await TrustedIssuersRegistry.deploy(admin.address);
  await trustedIssuersRegistry.waitForDeployment();

  const IdentityRegistryStorage = await ethers.getContractFactory("IdentityRegistryStorage");
  const identityRegistryStorage = await IdentityRegistryStorage.deploy(admin.address);
  await identityRegistryStorage.waitForDeployment();

  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const identityRegistry = await IdentityRegistry.deploy(
    admin.address,
    await identityRegistryStorage.getAddress(),
    await claimTopicsRegistry.getAddress(),
    await trustedIssuersRegistry.getAddress(),
  );
  await identityRegistry.waitForDeployment();

  await (await identityRegistryStorage.bindIdentityRegistry(await identityRegistry.getAddress())).wait();
  await (await trustedIssuersRegistry.addTrustedIssuer(admin.address, KYC_TOPIC)).wait();

  const BasicCompliance = await ethers.getContractFactory("BasicCompliance");
  const compliance = await BasicCompliance.deploy(admin.address);
  await compliance.waitForDeployment();

  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy(
    admin.address,
    await identityRegistry.getAddress(),
    await compliance.getAddress(),
  );
  await token.waitForDeployment();

  await (await compliance.bindToken(await token.getAddress())).wait();

  const addresses = {
    claimTopicsRegistry: await claimTopicsRegistry.getAddress(),
    trustedIssuersRegistry: await trustedIssuersRegistry.getAddress(),
    identityRegistryStorage: await identityRegistryStorage.getAddress(),
    identityRegistry: await identityRegistry.getAddress(),
    compliance: await compliance.getAddress(),
    token: await token.getAddress(),
  };

  saveDeployedAddresses(addresses);
  console.log("Deployed:", addresses);
  console.log(`Token name: ${await token.name()}, symbol: ${await token.symbol()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
