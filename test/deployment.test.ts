import { expect } from "chai"
import { ethers, upgrades } from "hardhat"
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers"

import MorphoArtifact from "../submodules/morpho-blue/out/Morpho.sol/Morpho.json"
import AdaptiveCurveIrmArtifact from "../submodules/morpho-blue-irm/out/AdaptiveCurveIrm.sol/AdaptiveCurveIrm.json"

import { IIrm, IMorpho } from "../typechain-types"

describe("test the functions", function () {

  async function deployContracts() {

    const [admin, operator, user1, user2] = await ethers.getSigners()

    const MorphoFactory = await ethers.getContractFactory(
      MorphoArtifact.abi, MorphoArtifact.bytecode.object
    )
    const AdaptiveCurveIrmFactory = await ethers.getContractFactory(
      AdaptiveCurveIrmArtifact.abi, AdaptiveCurveIrmArtifact.bytecode.object
    )

    const morpho = (await MorphoFactory.deploy(admin.address)) as IMorpho
    const morphoAddress = await morpho.getAddress()

    const irm = (await AdaptiveCurveIrmFactory.deploy(morphoAddress)) as IIrm
    const irmAddress = await irm.getAddress()

    return {
      admin, operator, user1, user2,
      morpho, morphoAddress, irm, irmAddress,
    }
  }

  it("should deploy the contract correctly", async function () {
    await loadFixture(deployContracts)
  })


  it("should finish user journey", async function () {
    const {
      admin, operator, user1, user2,
      morpho, morphoAddress, irm, irmAddress,
    } = await loadFixture(deployContracts)

    console.log(
      "admin", admin.address,
      "operator", operator.address,
      "user1", user1.address,
      "user2", user2.address,
      "morpho", morphoAddress,
      "irm", irmAddress,
    )
  })

})
