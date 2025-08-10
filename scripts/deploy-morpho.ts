import "dotenv/config"
import { ethers } from "hardhat"
import { IIrm, IMetaMorphoV1_1Factory, IMorpho } from "../typechain-types"

import MorphoArtifact from "../submodules/morpho-blue/out/Morpho.sol/Morpho.json"
import AdaptiveCurveIrmArtifact from "../submodules/morpho-blue-irm/out/AdaptiveCurveIrm.sol/AdaptiveCurveIrm.json"
import MetaMorphoV1_1Factory from "../submodules/metamorpho-v1.1/out/MetaMorphoV1_1Factory.sol/MetaMorphoV1_1Factory.json"

async function main() {
  const [admin] = await ethers.getSigners()

  const adaptiveCurveIrmFactory = await ethers.getContractFactory(
    AdaptiveCurveIrmArtifact.abi, AdaptiveCurveIrmArtifact.bytecode.object
  )
  const morphoFactory = await ethers.getContractFactory(
    MorphoArtifact.abi, MorphoArtifact.bytecode.object
  )
  const morpho = (await morphoFactory.deploy(admin.address)) as IMorpho
  const morphoAddress = await morpho.getAddress()
  const irm = (await adaptiveCurveIrmFactory.deploy(morphoAddress)) as IIrm
  const irmAddress = await irm.getAddress()

  console.log(`Morpho deployed at ${morphoAddress}`)
  console.log(`IRM deployed at ${irmAddress}`)

  const metamorphoFactoryFactory = await ethers.getContractFactory(
    MetaMorphoV1_1Factory.abi, MetaMorphoV1_1Factory.bytecode.object
  )
  const metamorphoFactory = (
    await metamorphoFactoryFactory.deploy(morphoAddress)
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

