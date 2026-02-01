/**
 * FlipRoyaleArena Deployment Script
 * 
 * Usage:
 * npx hardhat run scripts/deploy-arena.js --network base
 * 
 * Environment Variables:
 * - PRIVATE_KEY: Deployer wallet private key
 * - TREASURY_ADDRESS: Team wallet for 5% fees
 * - ORACLE_ADDRESS: Oracle signer wallet
 */

const hre = require("hardhat");

async function main() {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("           FlipRoyaleArena Deployment Script");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Base chain USDC (6 decimals)
    const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

    // Get addresses from environment
    const treasuryAddress = process.env.TREASURY_ADDRESS;
    const oracleAddress = process.env.ORACLE_ADDRESS;

    if (!treasuryAddress || !oracleAddress) {
        console.error("❌ Missing environment variables!");
        console.error("   TREASURY_ADDRESS:", treasuryAddress || "NOT SET");
        console.error("   ORACLE_ADDRESS:", oracleAddress || "NOT SET");
        process.exit(1);
    }

    console.log("\n📋 Deployment Configuration:");
    console.log("   Network:", hre.network.name);
    console.log("   USDC Address:", USDC_ADDRESS);
    console.log("   Treasury:", treasuryAddress);
    console.log("   Oracle:", oracleAddress);

    // Get deployer
    const [deployer] = await hre.ethers.getSigners();
    console.log("   Deployer:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("   Balance:", hre.ethers.formatEther(balance), "ETH");

    // Deploy contract
    console.log("\n🚀 Deploying FlipRoyaleArena...");

    const FlipRoyaleArena = await hre.ethers.getContractFactory("FlipRoyaleArena");
    const arena = await FlipRoyaleArena.deploy(
        USDC_ADDRESS,
        treasuryAddress,
        oracleAddress
    );

    await arena.waitForDeployment();
    const arenaAddress = await arena.getAddress();

    console.log("\n✅ FlipRoyaleArena deployed!");
    console.log("   Contract Address:", arenaAddress);

    // Verify tier stakes
    console.log("\n📊 Tier Stakes (USDC with 6 decimals):");
    const [bronze, silver, gold, diamond] = await arena.getAllTierStakes();
    console.log("   Bronze:  $", (Number(bronze) / 1e6).toFixed(2));
    console.log("   Silver:  $", (Number(silver) / 1e6).toFixed(2));
    console.log("   Gold:    $", (Number(gold) / 1e6).toFixed(2));
    console.log("   Diamond: $", (Number(diamond) / 1e6).toFixed(2));

    console.log("\n💰 Fee Structure:");
    console.log("   Winner:    90%");
    console.log("   Team:      5%");
    console.log("   ReplyCorp: 5% (accumulated)");

    // Verify on Basescan (if mainnet)
    if (hre.network.name === "base") {
        console.log("\n🔍 Verifying on Basescan...");
        try {
            await hre.run("verify:verify", {
                address: arenaAddress,
                constructorArguments: [
                    USDC_ADDRESS,
                    treasuryAddress,
                    oracleAddress
                ],
            });
            console.log("✅ Contract verified on Basescan!");
        } catch (e) {
            console.log("⚠️ Verification failed:", e.message);
        }
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("                    Deployment Complete!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n📝 Next Steps:");
    console.log("   1. Add contract address to .env: ARENA_CONTRACT=", arenaAddress);
    console.log("   2. Update frontend to integrate with contract");
    console.log("   3. Set up Oracle service for game resolution");
    console.log("\n");

    return arenaAddress;
}

main()
    .then((address) => {
        console.log("Contract deployed at:", address);
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
