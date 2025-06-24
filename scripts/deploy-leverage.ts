import "dotenv/config"
import { deployContract, deployUpgradeableContract } from "./utils"
import { parseEther } from "ethers"

async function main() {
  const morphoAddress = process.env.SEPOLIA_MORPHO!
  await deployUpgradeableContract(
    "LeverageEngine", [morphoAddress], true,
  )

  const rytTellerAddress = process.env.SEPOLIA_RYT_TELLER!
  await deployContract(
    "RytOracleAdaptor", [rytTellerAddress, parseEther("100")], true,
  )

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

