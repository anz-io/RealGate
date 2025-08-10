import "dotenv/config"
import { ethers } from "hardhat"
import { IMetaMorphoV1_1Factory } from "../typechain-types"

import MetaMorphoV1_1Factory from "../submodules/metamorpho-v1.1/out/MetaMorphoV1_1Factory.sol/MetaMorphoV1_1Factory.json"

async function main() {
  const metamorphoFactoryFactory = await ethers.getContractFactory(
    MetaMorphoV1_1Factory.abi, MetaMorphoV1_1Factory.bytecode.object
  )
  const metamorphoFactory = (
    await metamorphoFactoryFactory.deploy(process.env.SEPOLIA_MORPHO!)
  ) as IMetaMorphoV1_1Factory
  const metamorphoFactoryAddress = await metamorphoFactory.getAddress()

  console.log(`MetaMorphoV1_1Factory deployed at ${metamorphoFactoryAddress}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

