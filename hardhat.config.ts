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
    apiKey: {
      sepolia: process.env.API_ETHERSCAN!,
    }
  }
};

export default config;
