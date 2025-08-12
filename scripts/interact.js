// npx hardhat console --network sepolia

const [admin, user] = await ethers.getSigners()
const morpho = await ethers.getContractAt("IMorpho", "0x805bAb63e20c26D1EAdEBD62773154Da0506c283")

const MetaMorphoV1_1Factory = require(path.join(
  process.cwd(), 
  "submodules/metamorpho-v1.1/out/MetaMorphoV1_1Factory.sol/MetaMorphoV1_1Factory.json",
))


// Allowed LLTVs: 38.5%, 62.5%, 77.0%, 86.0%, 91.5%, 94.5%, 96.5%, 98.0%
await morpho.enableLltv(ethers.parseEther("0.385"))
await morpho.enableLltv(ethers.parseEther("0.625"))
await morpho.enableLltv(ethers.parseEther("0.770"))
await morpho.enableLltv(ethers.parseEther("0.860"))
await morpho.enableLltv(ethers.parseEther("0.915"))
await morpho.enableLltv(ethers.parseEther("0.945"))
await morpho.enableLltv(ethers.parseEther("0.965"))
await morpho.enableLltv(ethers.parseEther("0.980"))

await morpho.enableLltv(ethers.parseEther("0.8"))
await morpho.enableLltv(ethers.parseEther("0.9"))
await morpho.enableIrm("0x42a2714A2dbC56F524327d957BeA4732E7e16061")

const marketParams = {
  loanToken: "0x8d00c83b6b5da79465b1bfb45bdc01c0de122c36",
  collateralToken: "0xE7d6Fe1Ef7Be71E270a30878CB08F2376e041227",
  oracle: "0x2Fc3dF941De2C397a6dCbDb6519cFC9D9e751D9C",
  irm: "0x42a2714A2dbC56F524327d957BeA4732E7e16061",
  lltv: ethers.parseEther("0.8"),
}
await morpho.createMarket(marketParams)


// Supply & test Leverage
const mockryt = await ethers.getContractAt("IERC20", "0xE7d6Fe1Ef7Be71E270a30878CB08F2376e041227")
const mockusdc = await ethers.getContractAt("IERC20", "0x8d00c83b6b5da79465b1bfb45bdc01c0de122c36")

await mockusdc.connect(user).approve(await morpho.getAddress(), ethers.parseUnits("200000", 6))
await morpho.connect(user).supply(marketParams, ethers.parseUnits("100000", 6), 0, user.address, "0x")
const leverage = await ethers.getContractAt("LeverageEngine", "0x007Cf918234Dd27798350de10A128587613f6ac3")
await morpho.setAuthorization("0x007Cf918234Dd27798350de10A128587613f6ac3", true)

await mockryt.connect(admin).approve(await leverage.getAddress(), ethers.parseUnits("10", 18))
await leverage.openPosition(
  marketParams, ethers.parseUnits("1", 18), ethers.parseUnits("4", 18), 
  ethers.parseUnits("0.05", 18), admin.address, 
  "0x151FFd190FaD2E46c8d67914E01A57B985C72a01",
)


// Create MetaMorpho Vault
const metamorphoFactory = await ethers.getContractAt(
  MetaMorphoV1_1Factory.abi, "0x8032629E63D026c59d2F53c5eFb3eCeed3387fD5"
)
await metamorphoFactory.setVaultCreator(admin.address, true)
await metamorphoFactory.createMetaMorpho(
  admin.address,
  301,    // 5 minutes (for test!)
  "0x8d00c83b6b5da79465b1bfb45bdc01c0de122c36",
  "Test-Metamorpho-Vault-2",
  "TMV-2",
  "0x0000000000000000000000000000000000000000000000000000000000004411",
)
await metamorphoFactory.createMetaMorphoWithConfig(
  admin.address,
  301,    // 5 minutes (for test!)
  "0x8d00c83b6b5da79465b1bfb45bdc01c0de122c36",
  "Test-Metamorpho-Vault-2",
  "TMV-2",
  "0x0000000000000000000000000000000000000000000000000000000000004411",
  admin.address, // curator
  0,    // fee
  admin.address, // fee recipient
  admin.address, // guardian
)


// Vault related
const marketId = "0xcd3ffadb741b4c26fbed0e5ccdace494482da74a7efdbd590f7cd1d8b5964294"

const metamorpho = await ethers.getContractAt(
  "IMetaMorphoV1_1", "0x8cba63520579Bdd3b77de56cF232104aEa533547"
)
await metamorpho.submitCap(marketParams, 1000000000000)

// wait for 1 day ...
await metamorpho.acceptCap(marketParams)
await metamorpho.setSupplyQueue([marketId])

await mockusdc.approve(await metamorpho.getAddress(), 1000000000000)
await metamorpho.deposit(100000000, admin.address)


// deploy mock oracle
const mockOracleFactory = ethers.getContractFactory("MockOracle")
const mockOracle = await mockOracleFactory.deploy()
await mockOracle.setPrice(ethers.parseUnits("1", 18))
/**
 * 1e36 PumpBTC -> 1e18 $PumpBTC -> 120000e18 $USDC -> 120000e24 USDC 
 *   -> 1.2e29 USDC, price = 120000000000e18
 */