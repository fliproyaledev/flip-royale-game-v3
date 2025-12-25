
const { ethers } = require("ethers");

async function main() {
    // Constructor Arguments
    const virtualTokenAddress = "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b";
    const treasuryAddress = "0x59749215DA9aedc456B173146c0890Af87F6E6f4";

    const abiCoder = new ethers.AbiCoder();
    const encodedParams = abiCoder.encode(
        ["address", "address"],
        [virtualTokenAddress, treasuryAddress]
    );

    console.log("\n============================================");
    console.log("✅ ABI ENCODED CONSTRUCTOR ARGUMENTS:");
    console.log("============================================");
    console.log(encodedParams); // This will print the long hex string with 0x prefix (maybe)
    console.log("============================================");
    console.log("Copy the string above (remove '0x' if BaseScan asks for it without prefix, but usually it handles both).");
}

main();
