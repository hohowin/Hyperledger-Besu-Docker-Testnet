import { ethers } from "ethers";
import { Identity, IDENTITIES } from "../identities";

export function createSigners(
  provider: ethers.JsonRpcProvider,
  privateKeys: Record<Identity, string>,
): Record<Identity, ethers.Wallet> {
  const signers = {} as Record<Identity, ethers.Wallet>;
  for (const identity of IDENTITIES) {
    signers[identity] = new ethers.Wallet(privateKeys[identity], provider);
  }
  return signers;
}

export function loadPrivateKeysFromEnv(env: NodeJS.ProcessEnv): Record<Identity, string> {
  const keys = {} as Record<Identity, string>;
  for (const identity of IDENTITIES) {
    const envVar = `${identity.toUpperCase()}_PRIVATE_KEY`;
    const value = env[envVar];
    if (!value) {
      throw new Error(`Missing required env var ${envVar}`);
    }
    keys[identity] = value;
  }
  return keys;
}
