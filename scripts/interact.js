// npx hardhat console --network sepolia

const [admin, user] = await ethers.getSigners()

const morpho = await ethers.getContractAt("IMorpho", "0xAaD9adfd84028a5c713a8cBB885f08E526149f3C")

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
await morpho.enableIrm("0x8f4eD64c82a765cB295B3bB041Ffd0186b498f0B")

const marketParams = {
  loanToken: "0x8d00c83b6b5da79465b1bfb45bdc01c0de122c36",
  collateralToken: "0xE7d6Fe1Ef7Be71E270a30878CB08F2376e041227",
  oracle: "0x2Fc3dF941De2C397a6dCbDb6519cFC9D9e751D9C",
  irm: "0x8f4eD64c82a765cB295B3bB041Ffd0186b498f0B",
  lltv: ethers.parseEther("0.8"),
}
await morpho.createMarket(marketParams)

await morpho.connect(user).supply(marketParams, ethers.parseUnits("100000", 6), 0, user.address, "0x")
const leverage = await ethers.getContractAt("LeverageEngine", "0x3F2d0a2CFc50A41337D069DCb9eB3637aF44d63f")
await morpho.setAuthorization("0x3F2d0a2CFc50A41337D069DCb9eB3637aF44d63f", true)

await leverage.openPosition(
  marketParams, ethers.parseUnits("1", 18), ethers.parseUnits("4", 18), 
  ethers.parseUnits("0.05", 18), admin.address, 
  "0x151FFd190FaD2E46c8d67914E01A57B985C72a01",
)


const metamorphoFactory = await ethers.getContractAt(
  "IMetaMorphoV1_1Factory", "0xcA8FDc36B5FFA6e9E45dCA90f5feD895ccF5820F"
)
await metamorphoFactory.createMetaMorpho(
  admin.address,
  86401,    // 1 day ~ 2 weeks
  "0x8d00c83b6b5da79465b1bfb45bdc01c0de122c36",
  "Test-Metamorpho-Vault",
  "TMV",
  "0x0000000000000000000000000000000000000000000000000000000000004411",
)

const marketId = "0xcd3ffadb741b4c26fbed0e5ccdace494482da74a7efdbd590f7cd1d8b5964294"

const metamorpho = await ethers.getContractAt(
  "IMetaMorphoV1_1", "0x8cba63520579Bdd3b77de56cF232104aEa533547"
)
await metamorpho.submitCap(marketParams, 1000000000000)

// wait for 1 day ...
await metamorpho.acceptCap(marketParams)
await metamorpho.setSupplyQueue([marketId])

const mockusdc = await ethers.getContractAt("IERC20", "0x8d00c83b6b5da79465b1bfb45bdc01c0de122c36")
await mockusdc.approve(await metamorpho.getAddress(), 1000000000000)
await metamorpho.deposit(100000000, admin.address)
