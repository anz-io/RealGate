const { ethers, parseEther, keccak256 } = require("ethers");

async function main() {
  const encoder = ethers.AbiCoder.defaultAbiCoder();
  const marketParams = encoder.encode(
    ["address", "address", "address", "address", "uint256"],
    [
      "0x8d00c83b6b5da79465b1bfb45bdc01c0de122c36", // loan token
      "0xE7d6Fe1Ef7Be71E270a30878CB08F2376e041227", // collateral token
      "0x2Fc3dF941De2C397a6dCbDb6519cFC9D9e751D9C", // oracle
      "0x42a2714A2dbC56F524327d957BeA4732E7e16061", // irm
      parseEther("0.8"),   // lltv
    ]
  )

  console.log("Market Params: ", marketParams)
  console.log("Market Id: ", keccak256(Buffer.from(marketParams.slice(2), "hex")))
}

main()