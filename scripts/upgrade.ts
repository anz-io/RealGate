import "dotenv/config"
import { upgradeContract } from "./utils"

async function main() {
  await upgradeContract(process.env.SEPOLIA_LEVERAGE_ENGINE!, "LeverageEngine", true)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
