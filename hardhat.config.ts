import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      viaIR: true,
    },
  },
  networks: {
    sepolia: {
      url: process.env.RPC_SEPOLIA,
      accounts: [
        process.env.PRIVATE_KEY_ADMIN!,
        process.env.PRIVATE_KEY_USER!,
      ]
    }
  },
  etherscan: {
    apiKey: process.env.API_ETHERSCAN!,
  }
};

export default config;

/**
 * Use forge to verify Vault contract. (MetaMorphoV1_1.initialize selector: e4e1ff01)
 * forge verify-contract \
    --etherscan-api-key XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
    --chain sepolia \
    --constructor-args 0x000000000000000000000000CB42eF3eCd76918407A567f7e28ae3B1d10D8E1A \
    --compiler-version 0.8.28 \
    0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
    ./submodules/metamorpho-v1.1/lib/openzeppelin-contracts/contracts/proxy/beacon/BeaconProxy.sol:BeaconProxy
 */