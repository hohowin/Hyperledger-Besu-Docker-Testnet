import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });

const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const ANSON_PRIVATE_KEY = process.env.ANSON_PRIVATE_KEY;
const BEATRICE_PRIVATE_KEY = process.env.BEATRICE_PRIVATE_KEY;
const BESU_RPC_URL = process.env.BESU_RPC_URL ?? "http://localhost:8545";

// Order matters: scripts and tests assume getSigners() = [admin, anson, beatrice, ...].
const besuAccounts = [ADMIN_PRIVATE_KEY, ANSON_PRIVATE_KEY, BEATRICE_PRIVATE_KEY].filter(
  (key): key is string => Boolean(key),
);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    besu: {
      url: BESU_RPC_URL,
      // D-23: zero-gas network, no chainId enforcement needed beyond genesis default
      accounts: besuAccounts,
      gasPrice: 0,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
