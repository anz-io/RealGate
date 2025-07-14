const { ethers, parseEther, keccak256 } = require("ethers");

async function main() {
  const encoder = ethers.AbiCoder.defaultAbiCoder();
  const marketParams = encoder.encode(
    ["address", "address", "address", "address", "uint256"],
    [
      "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // loan token
      "0x03b54A6e9a984069379fae1a4fC4dBAE93B3bCCD", // collateral token
      "0x1Dc2444b54945064c131145cD6b8701e3454C63a", // oracle
      "0xe675A2161D4a6E2de2eeD70ac98EEBf257FBF0B0", // irm
      parseEther("0.915"),   // lltv
    ]
  )

  console.log("Market Params: ", marketParams)
  console.log("Market Id: ", keccak256(Buffer.from(marketParams.slice(2), "hex")))
}

main()