// scripts/deploy-arena-v2.js
// Deploy FlipRoyaleArena V2 to Base Mainnet

const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("═══════════════════════════════════════════════════════");
    console.log("FlipRoyaleArena V2 Deployment");
    console.log("═══════════════════════════════════════════════════════");
    console.log("Deployer:", deployer.address);
    console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

    // Base Mainnet USDC
    const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

    // Treasury (fee wallet)
    const TREASURY = "0x59749215DA9aedc456B173146c0890Af87F6E6f4";

    // Oracle (signer for game resolution)
    const ORACLE = "0xa01f5b388c61b317c489b4d1c9b3792105386b90";

    console.log("\nConfiguration:");
    console.log("├── USDC:", USDC);
    console.log("├── Treasury:", TREASURY);
    console.log("└── Oracle:", ORACLE);

    console.log("\nDeploying...");

    // Deploy
    const ArenaV2 = await hre.ethers.getContractFactory("FlipRoyaleArenaV2");
    const arena = await ArenaV2.deploy(USDC, TREASURY, ORACLE);
    await arena.waitForDeployment();

    const address = await arena.getAddress();

    console.log("\n✅ FlipRoyaleArenaV2 deployed!");
    console.log("Address:", address);

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("NEXT STEPS:");
    console.log("═══════════════════════════════════════════════════════");
    console.log("1. Update .env.local:");
    console.log(`   NEXT_PUBLIC_ARENA_CONTRACT=${address}`);
    console.log("");
    console.log("2. Verify on Basescan:");
    console.log(`   npx hardhat verify --network base ${address} ${USDC} ${TREASURY} ${ORACLE}`);
    console.log("");
    console.log("3. Test:");
    console.log("   - Create room → check getOpenRoomsByMode(1)");
    console.log("   - Cancel room → check refund");
    console.log("   - Join room → check pot filled");
    console.log("═══════════════════════════════════════════════════════");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
