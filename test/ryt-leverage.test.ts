import { expect } from "chai"
import { ethers, upgrades } from "hardhat"
import { parseEther, AbiCoder, parseUnits, formatUnits, keccak256 } from "ethers"
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers"

import MorphoArtifact from "../submodules/morpho-blue/out/Morpho.sol/Morpho.json"
import AdaptiveCurveIrmArtifact from "../submodules/morpho-blue-irm/out/AdaptiveCurveIrm.sol/AdaptiveCurveIrm.json"
import OracleMockArtifact from "../submodules/morpho-blue/out/OracleMock.sol/OracleMock.json"
import ERC20MockArtifact from "../submodules/morpho-blue/out/ERC20Mock.sol/ERC20Mock.json"

import { IIrm, IMorpho, IOracle, IERC20, IMockERC20, IMockOracle, MockRytTeller, RYTOracleAdaptor } from "../typechain-types"
import { MarketParamsStruct } from "../typechain-types/contracts/interface/IMorpho.sol/IMorpho"

const GREEN = "\x1b[32m"
const PURPLE = "\x1b[35m"
const BLUE = "\x1b[34m"
const RESET = "\x1b[0m"


function getMarketId(market: MarketParamsStruct): string {
  return keccak256(AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address", "address", "uint256"],
    [market.loanToken, market.collateralToken, market.oracle, market.irm, market.lltv]
  ))
}

async function getVirtualTime(): Promise<string> {
  return `${BLUE}${new Date((await time.latest()) * 1000).toLocaleString()}${RESET}`
}

describe("test the functions", function () {

  async function deployContracts() {
    const [admin, operator, user1, user2, user3] = await ethers.getSigners()

    const morphoFactory = await ethers.getContractFactory(
      MorphoArtifact.abi, MorphoArtifact.bytecode.object
    )
    const adaptiveCurveIrmFactory = await ethers.getContractFactory(
      AdaptiveCurveIrmArtifact.abi, AdaptiveCurveIrmArtifact.bytecode.object
    )
    const morpho = (await morphoFactory.deploy(admin.address)) as IMorpho
    const morphoAddress = await morpho.getAddress()
    const irm = (await adaptiveCurveIrmFactory.deploy(morphoAddress)) as IIrm
    const irmAddress = await irm.getAddress()

    // Deploy mock contracts
    const mockERC20Factory = await ethers.getContractFactory(
      ERC20MockArtifact.abi, ERC20MockArtifact.bytecode.object
    )
    const mockWBTC = (await mockERC20Factory.deploy()) as IMockERC20
    const mockUSDC = (await mockERC20Factory.deploy()) as IMockERC20

    const mockWBTCAddress = await mockWBTC.getAddress()
    const mockUSDCAddress = await mockUSDC.getAddress()

    // Deploy mock RYT Teller
    const mockRytTeller = (await (
      await ethers.getContractFactory("MockRytTeller")
    ).deploy(mockWBTCAddress, mockUSDCAddress)) as MockRytTeller
    const mockRytTellerAddress = await mockRytTeller.getAddress()

    const mockRytOracle = (await (
      await ethers.getContractFactory("RYTOracleAdaptor")
    ).deploy(mockRytTellerAddress, 1n)) as RYTOracleAdaptor
    const mockRytOracleAddress = await mockRytOracle.getAddress()


    return {
      admin, operator, user1, user2, user3,
      morpho, morphoAddress, irm, irmAddress,
      mockWBTC, mockWBTCAddress,
      mockUSDC, mockUSDCAddress,
      mockRytTeller, mockRytTellerAddress,
      mockRytOracle, mockRytOracleAddress,
    }
  }


  it("should deploy the contracts correctly", async function () {
    await loadFixture(deployContracts)
  })


  it("should finish leverage-up on RYT teller", async function () {
    const {
      admin, operator, user1, user2, user3,
      morpho, morphoAddress, irm, irmAddress,
      mockWBTC, mockWBTCAddress,
      mockUSDC, mockUSDCAddress,
      mockRytTeller, mockRytTellerAddress,
      mockRytOracle, mockRytOracleAddress,
    } = await loadFixture(deployContracts)


    // Swap USDC to WBTC through RYT teller
    expect((await mockRytTeller.quoteInvest(
      parseUnits("105000", 6)     // 105000 $USDC
    ))[0]).to.equal(parseUnits("1", 8))   // equals to 1 $WBTC

    await mockUSDC.setBalance(user1.address, parseUnits("1105000", 6))
    await mockUSDC.setBalance(mockRytTellerAddress, parseUnits("1000000", 8))
    await mockWBTC.setBalance(mockRytTellerAddress, parseUnits("100", 8))

    await mockUSDC.connect(user1).approve(mockRytTellerAddress, parseUnits("105000", 6))
    await mockRytTeller.connect(user1).invest(parseUnits("105000", 6), 0)
    expect(await mockWBTC.balanceOf(user1.address)).to.equal(parseUnits("1", 8))


    // Set necessary parameters & create market
    await morpho.enableIrm(irmAddress)
    await morpho.enableLltv(parseEther("0.8"))

    const wbtcUsdcMarket: MarketParamsStruct = {
      loanToken: mockUSDCAddress,
      collateralToken: mockWBTCAddress,
      oracle: mockRytOracleAddress,
      irm: irmAddress,
      lltv: parseEther("0.8"),
    }
    const wbtcUsdcMarketId = getMarketId(wbtcUsdcMarket)
    await morpho.createMarket(wbtcUsdcMarket)

    await mockUSDC.connect(user1).approve(morphoAddress, parseUnits("1000000", 6))
    await morpho.connect(user1).supply(wbtcUsdcMarket, parseUnits("1000000", 6), 0, user1.address, "0x")


    // Deploy LeverageEngine
    const leverageEngineFactory = await ethers.getContractFactory("LeverageEngine")
    const leverageEngine = await upgrades.deployProxy(leverageEngineFactory, [morphoAddress])
    const leverageEngineAddress = await leverageEngine.getAddress()


    // Open position
    await mockWBTC.setBalance(user2.address, parseUnits("1", 8))
    await mockWBTC.connect(user2).approve(leverageEngineAddress, parseUnits("1", 8))
    await morpho.connect(user2).setAuthorization(leverageEngineAddress, true)
    await leverageEngine.connect(user2).openPosition(
      wbtcUsdcMarket,
      parseUnits("1", 8),
      parseEther("4"),
      parseEther("0.02"),
      user2.address,
      mockRytTellerAddress,
    )
    
    console.log(`\n\t ${await getVirtualTime()} Bob open a 4x long position on WBTC-USDC`)
    console.log(`\t\tBob's collateral: ${GREEN}${
      formatUnits((await morpho.position(wbtcUsdcMarketId, user2.address))[2], 8)
    }${RESET} $WBTC`)
    console.log(`\t\tBob's debt: ${PURPLE}${
      formatUnits((await morpho.position(wbtcUsdcMarketId, user2.address))[1], 6 + 6)
    }${RESET} $USDC`)


    // Close position
    const wbtcBalanceBefore = await mockWBTC.balanceOf(user2.address)
    const usdcBalanceBefore = await mockUSDC.balanceOf(user2.address)
    await leverageEngine.connect(user2).closePosition(
      wbtcUsdcMarket,
      0,
      user2.address,
      mockRytTellerAddress,
    )
    console.log(`\n\t ${await getVirtualTime()} Bob close his position on WBTC-USDC`)
    expect(await morpho.position(wbtcUsdcMarketId, user2.address)).to.deep.equal([0, 0, 0])
    console.log(`\t\tBob's $USDC balance: ${PURPLE}+ ${
      formatUnits(await mockUSDC.balanceOf(user2.address) - usdcBalanceBefore, 6)
    }${RESET}`)


  })

})
