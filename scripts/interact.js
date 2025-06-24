// npx hardhat console --network sepolia

const morpho = await ethers.getContractAt("IMorpho", "0xAaD9adfd84028a5c713a8cBB885f08E526149f3C")

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

const [admin, user] = await ethers.getSigners()
await morpho.connect(user).supply(marketParams, ethers.parseUnits("100000", 6), 0, user.address, "0x")

const leverage = await ethers.getContractAt("LeverageEngine", "0x3F2d0a2CFc50A41337D069DCb9eB3637aF44d63f")
await morpho.setAuthorization("0x3F2d0a2CFc50A41337D069DCb9eB3637aF44d63f", true)

await leverage.openPosition(
  marketParams, ethers.parseUnits("1", 18), ethers.parseUnits("4", 18), 
  ethers.parseUnits("0.05", 18), admin.address, 
  "0x151FFd190FaD2E46c8d67914E01A57B985C72a01",
)
