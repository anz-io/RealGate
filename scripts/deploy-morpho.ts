import "dotenv/config"
import { ethers } from "hardhat"
import { IIrm, IMorpho } from "../typechain-types"

import MorphoArtifact from "../submodules/morpho-blue/out/Morpho.sol/Morpho.json"
import AdaptiveCurveIrmArtifact from "../submodules/morpho-blue-irm/out/AdaptiveCurveIrm.sol/AdaptiveCurveIrm.json"

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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

