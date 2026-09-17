import { expect } from "chai";
import { ethers } from "hardhat";
import type {
  ClaimTopicsRegistry,
  TrustedIssuersRegistry,
  IdentityRegistryStorage,
  IdentityRegistry,
  BasicCompliance,
  Token,
} from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const KYC_TOPIC = 1;

describe("Trimmed T-REX compliance suite", () => {
  let admin: HardhatEthersSigner;
  let anson: HardhatEthersSigner;
  let beatrice: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  let claimTopics: ClaimTopicsRegistry;
  let trustedIssuers: TrustedIssuersRegistry;
  let identityStorage: IdentityRegistryStorage;
  let identityRegistry: IdentityRegistry;
  let compliance: BasicCompliance;
  let token: Token;

  beforeEach(async () => {
    [admin, anson, beatrice, stranger] = await ethers.getSigners();

    const ClaimTopicsRegistryFactory = await ethers.getContractFactory("ClaimTopicsRegistry");
    claimTopics = (await ClaimTopicsRegistryFactory.deploy(admin.address)) as unknown as ClaimTopicsRegistry;

    const TrustedIssuersRegistryFactory = await ethers.getContractFactory("TrustedIssuersRegistry");
    trustedIssuers = (await TrustedIssuersRegistryFactory.deploy(
      admin.address,
    )) as unknown as TrustedIssuersRegistry;

    const IdentityRegistryStorageFactory = await ethers.getContractFactory("IdentityRegistryStorage");
    identityStorage = (await IdentityRegistryStorageFactory.deploy(
      admin.address,
    )) as unknown as IdentityRegistryStorage;

    const IdentityRegistryFactory = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = (await IdentityRegistryFactory.deploy(
      admin.address,
      await identityStorage.getAddress(),
      await claimTopics.getAddress(),
      await trustedIssuers.getAddress(),
    )) as unknown as IdentityRegistry;
    await identityStorage.connect(admin).bindIdentityRegistry(await identityRegistry.getAddress());

    // Admin plays TrustedIssuer for the KYC topic (D-02).
    await trustedIssuers.connect(admin).addTrustedIssuer(admin.address, KYC_TOPIC);

    const BasicComplianceFactory = await ethers.getContractFactory("BasicCompliance");
    compliance = (await BasicComplianceFactory.deploy(admin.address)) as unknown as BasicCompliance;

    const TokenFactory = await ethers.getContractFactory("Token");
    token = (await TokenFactory.deploy(
      admin.address,
      await identityRegistry.getAddress(),
      await compliance.getAddress(),
    )) as unknown as Token;
    await compliance.connect(admin).bindToken(await token.getAddress());
  });

  async function onboard(wallet: HardhatEthersSigner) {
    await identityRegistry.connect(admin).registerIdentity(wallet.address);
    await identityRegistry.connect(admin).issueClaim(wallet.address, KYC_TOPIC);
  }

  it("reports a freshly registered wallet as registered but not yet verified", async () => {
    await identityRegistry.connect(admin).registerIdentity(anson.address);
    expect(await identityRegistry.isRegistered(anson.address)).to.equal(true);
    expect(await identityRegistry.isVerified(anson.address)).to.equal(false);
  });

  it("verifies a wallet only after both registration and claim issuance", async () => {
    await onboard(anson);
    expect(await identityRegistry.isVerified(anson.address)).to.equal(true);
  });

  it("registering the same address twice is a no-op, not a revert (US-003)", async () => {
    await identityRegistry.connect(admin).registerIdentity(anson.address);
    await expect(identityRegistry.connect(admin).registerIdentity(anson.address)).to.not.be.reverted;
  });

  it("rejects issueClaim for an unregistered wallet", async () => {
    await expect(
      identityRegistry.connect(admin).issueClaim(anson.address, KYC_TOPIC),
    ).to.be.revertedWith("IdentityRegistry: wallet not registered");
  });

  it("rejects issueClaim from a caller that is not a trusted issuer for the topic", async () => {
    await identityRegistry.connect(admin).registerIdentity(anson.address);
    await expect(
      identityRegistry.connect(stranger).issueClaim(anson.address, KYC_TOPIC),
    ).to.be.revertedWith("IdentityRegistry: caller not a trusted issuer for topic");
  });

  it("rejects minting to a registered-but-unverified wallet (mint requires verification)", async () => {
    await identityRegistry.connect(admin).registerIdentity(anson.address);
    await expect(token.connect(admin).mint(anson.address, 100)).to.be.revertedWith(
      "Token: recipient not verified",
    );
  });

  it("mints to a verified wallet", async () => {
    await onboard(anson);
    await token.connect(admin).mint(anson.address, 100);
    expect(await token.balanceOf(anson.address)).to.equal(100);
  });

  it("reverts transfer to unverified recipient", async () => {
    await onboard(anson);
    await token.connect(admin).mint(anson.address, 100);
    // Beatrice is never onboarded in this test.
    await expect(token.connect(anson).transfer(beatrice.address, 50)).to.be.revertedWith(
      "Token: recipient not verified",
    );
    expect(await token.balanceOf(anson.address)).to.equal(100);
  });

  it("reverts transfer from an unverified sender", async () => {
    await onboard(anson);
    await token.connect(admin).mint(anson.address, 100);
    // Registered but not claimed — simulates a revoked/incomplete identity.
    await identityRegistry.connect(admin).registerIdentity(stranger.address);
    // Force anson's verification off by removing and re-registering without a claim
    // is not exposed on IdentityRegistry in v1 (no revoke flow, D-20) — instead
    // prove the symmetric guard directly against a registered-but-unverified holder
    // attempting to move tokens it does not have, which must fail on verification
    // before it ever reaches the balance check.
    await expect(token.connect(stranger).transfer(anson.address, 1)).to.be.revertedWith(
      "Token: sender not verified",
    );
  });

  it("succeeds transfer to verified recipient", async () => {
    await onboard(anson);
    await onboard(beatrice);
    await token.connect(admin).mint(anson.address, 100);

    await expect(token.connect(anson).transfer(beatrice.address, 50)).to.not.be.reverted;

    expect(await token.balanceOf(anson.address)).to.equal(50);
    expect(await token.balanceOf(beatrice.address)).to.equal(50);
  });
});
