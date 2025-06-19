import { expect } from "chai"
import { parseEther, AbiCoder, parseUnits, formatUnits, keccak256, formatEther } from "ethers"
import { ethers } from "hardhat"
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers"

import MorphoArtifact from "../submodules/morpho-blue/out/Morpho.sol/Morpho.json"
import AdaptiveCurveIrmArtifact from "../submodules/morpho-blue-irm/out/AdaptiveCurveIrm.sol/AdaptiveCurveIrm.json"
import OracleMockArtifact from "../submodules/morpho-blue/out/OracleMock.sol/OracleMock.json"
import ERC20MockArtifact from "../submodules/morpho-blue/out/ERC20Mock.sol/ERC20Mock.json"

import { IIrm, IMorpho, IMockERC20, IMockOracle } from "../typechain-types"
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

    // Deploy morpho contracts
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
    const mockOracleFactory = await ethers.getContractFactory(
      OracleMockArtifact.abi, OracleMockArtifact.bytecode.object
    )
    const mockOracle = (await mockOracleFactory.deploy()) as IMockOracle

    const mockERC20Factory = await ethers.getContractFactory(
      ERC20MockArtifact.abi, ERC20MockArtifact.bytecode.object
    )
    const mockWBTC = (await mockERC20Factory.deploy()) as IMockERC20
    const mockUSDC = (await mockERC20Factory.deploy()) as IMockERC20

    const mockOracleAddress = await mockOracle.getAddress()
    const mockWBTCAddress = await mockWBTC.getAddress()
    const mockUSDCAddress = await mockUSDC.getAddress()

    return {
      admin, operator, user1, user2, user3,
      morpho, morphoAddress, irm, irmAddress,
      mockOracle, mockOracleAddress,
      mockWBTC, mockWBTCAddress,
      mockUSDC, mockUSDCAddress,
    }
  }


  it("should deploy the contracts correctly", async function () {
    await loadFixture(deployContracts)
  })


  it("should finish morpho functions correctly", async function () {
    const {
      admin, operator, user1, user2, user3,
      morpho, morphoAddress, irm, irmAddress,
      mockOracle, mockOracleAddress,
      mockWBTC, mockWBTCAddress,
      mockUSDC, mockUSDCAddress,
    } = await loadFixture(deployContracts)


    // Set necessary parameters & create market
    await morpho.enableIrm(irmAddress)
    await morpho.enableLltv(parseEther("0.8"))

    const wbtcUsdcMarket: MarketParamsStruct = {
      loanToken: mockUSDCAddress,
      collateralToken: mockWBTCAddress,
      oracle: mockOracleAddress,
      irm: irmAddress,
      lltv: parseEther("0.8"),
    }
    const wbtcUsdcMarketId = getMarketId(wbtcUsdcMarket)
    await morpho.createMarket(wbtcUsdcMarket)


    // Set balances, set price
    await mockWBTC.setBalance(user1.address, parseUnits("500", 8))
    await mockWBTC.setBalance(user2.address, parseUnits("500", 8))
    await mockUSDC.setBalance(user1.address, parseUnits("2000000", 6))
    await mockUSDC.setBalance(user2.address, parseUnits("2000000", 6))
    await mockUSDC.setBalance(user3.address, parseUnits("2000000", 6))
    await mockOracle.setPrice(parseUnits("1000", 36))    // 1 unit(1e-8) WBTC -> 1000 unit(1e-6) USDC

    console.log(`\n\t ${await getVirtualTime()} Initial balances:`)
    console.log(`\t\tAlice $USDC Balance: ${GREEN}${formatUnits(await mockUSDC.balanceOf(user1.address), 6)
      }${RESET}`)
    console.log(`\t\tCarol $USDC Balance: ${GREEN}${formatUnits(await mockUSDC.balanceOf(user2.address), 6)
      }${RESET}`)
    console.log(`\t\tAlice $WBTC Balance: ${GREEN}${formatUnits(await mockWBTC.balanceOf(user1.address), 8)
      }${RESET}`)
    console.log(`\t\tCarol $WBTC Balance: ${GREEN}${formatUnits(await mockWBTC.balanceOf(user2.address), 8)
      }${RESET}`)


    // Supply & Withdraw
    await mockUSDC.connect(user1).approve(morphoAddress, parseUnits("2000000", 6))
    await morpho.connect(user1).supply(
      wbtcUsdcMarket,
      parseUnits("600000", 6),
      0,
      user1.address,
      "0x"
    )
    await morpho.connect(user1).withdraw(
      wbtcUsdcMarket,
      parseUnits("100000", 6),
      0,
      user1.address,
      user1.address,
    )
    expect((await morpho.position(wbtcUsdcMarketId, user1.address))[0])
      .equal(parseUnits("500000", 6) * 1000000n)    // Should be 4000000 USDC shares
    console.log(`\n\t ${await getVirtualTime()} Supply & Withdraw:`)
    console.log(`\t\tAlice supply ${GREEN}${
      formatUnits((await morpho.market(wbtcUsdcMarketId))[0], 6)
    }${RESET} $USDC`)

    
    // SupplyCollateral & Borrow
    await mockWBTC.connect(user2).approve(morphoAddress, parseUnits("500", 8))
    await morpho.connect(user2).supplyCollateral(
      wbtcUsdcMarket,
      parseUnits("6", 8),   // 6 $WBTC -> 600000 $USDC -> can borrow 480000 $USDC
      user2.address,
      "0x"
    )
    await morpho.connect(user2).borrow(
      wbtcUsdcMarket,
      parseUnits("400000", 6),
      0,
      user2.address,
      user2.address,
    )
    console.log(`\n\t ${await getVirtualTime()} SupplyCollateral & Borrow:`)
    console.log(`\t\tCarol supplied ${GREEN}${
      formatUnits((await morpho.position(wbtcUsdcMarketId, user2.address))[2], 8)
    }${RESET} $WBTC, borrowed ${PURPLE}${
      formatUnits((await morpho.market(wbtcUsdcMarketId))[2], 6)
    }${RESET} $USDC`)

    const utilization = (await morpho.market(wbtcUsdcMarketId))[2] * 10n ** 18n 
      / (await morpho.market(wbtcUsdcMarketId))[0]
    console.log(`\t\tMarket Utilization: ${GREEN}${formatEther(utilization)}${RESET}`)

    await expect(morpho.connect(user2).borrow(
      wbtcUsdcMarket,
      parseUnits("100000", 6),    // 480000 is the cap, so this should revert
      0,
      user2.address,
      user2.address,
    )).to.be.revertedWith("insufficient collateral")


    // Time passes 100 days
    await time.increase(86400 * 100)
    await morpho.accrueInterest(wbtcUsdcMarket)

    const marketStateResult = await morpho.market(wbtcUsdcMarketId)
    const marketState = {
      totalSupplyAssets: marketStateResult[0],
      totalSupplyShares: marketStateResult[1],
      totalBorrowAssets: marketStateResult[2],
      totalBorrowShares: marketStateResult[3],
      lastUpdate: marketStateResult[4],
      fee: marketStateResult[5],
    }
    const borrowRateSecond = await irm.borrowRateView(wbtcUsdcMarket, marketState)
    const borrowRateAnnual = formatEther(borrowRateSecond * 365n * 86400n * 100n)

    console.log(`\n\t ${await getVirtualTime()} 100 days after:`)
    console.log(`\t\tAnnual Borrow Rate: ${GREEN}${Number(borrowRateAnnual).toFixed(2)}%${RESET}`)
    console.log(`\t\tCarol's debt (market's total debt): ${PURPLE}${
      formatUnits((await morpho.market(wbtcUsdcMarketId))[2], 6)
    }${RESET} $USDC`)


    // Price dump 20%, liquidate Carol
    await mockOracle.setPrice(parseUnits("800", 36))  // 1 unit(1e-8) WBTC -> 800 unit(1e-6) USDC
    await mockUSDC.connect(user3).approve(morphoAddress, parseUnits("2000000", 6))
    const orignalUsdcBalance = await mockUSDC.balanceOf(user3.address)
    await morpho.connect(user3).liquidate(
      wbtcUsdcMarket,
      user2.address,
      0,
      parseUnits("400000", 6 + 6),
      "0x",
    )
    console.log(`\n\t ${await getVirtualTime()} Price dump 20%, liquidate Carol:`)
    console.log(`\t\tCarol's remaining colleteral: ${GREEN}${
      formatUnits((await morpho.position(wbtcUsdcMarketId, user2.address))[2], 8)
    }${RESET} $WBTC`)
    console.log(`\t\tCarol's remaining debt: ${PURPLE}${
      formatUnits((await morpho.position(wbtcUsdcMarketId, user2.address))[1], 6 + 6)
    }${RESET} Shares`)

    console.log(`\t\tDavid(Liquidator) received ${GREEN}${
      formatUnits(await mockWBTC.balanceOf(user3.address), 8)
    }${RESET} $WBTC`)
    console.log(`\t\tDavid(Liquidator) spent ${PURPLE}${
      formatUnits(orignalUsdcBalance - (await mockUSDC.balanceOf(user3.address)), 6)
    }${RESET} $USDC`)

    const netProfit = (await mockWBTC.balanceOf(user3.address)) * (await mockOracle.price()) / 10n ** 36n
      - (orignalUsdcBalance - await mockUSDC.balanceOf(user3.address))
    console.log(`\t\tDavid(Liquidator)'s net profit: ${GREEN}${formatUnits(netProfit, 6)}${RESET} $USDC`)
    
  })

})
