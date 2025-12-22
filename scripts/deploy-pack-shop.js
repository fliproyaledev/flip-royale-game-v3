const hre = require("hardhat");

async function main() {
    console.log("Deploying FlipRoyalePackShop...");

    // VIRTUAL token adresi (Base Mainnet)
    // https://basescan.org/token/0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b
    const VIRTUAL_TOKEN = "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b";

    // Treasury adresi - platformun gelir cüzdanı
    // ⚠️ BUNU KENDİ CÜZDAN ADRESİNLE DEĞİŞTİR!
    const TREASURY = process.env.TREASURY_ADDRESS || "0xYOUR_TREASURY_ADDRESS";

    if (TREASURY === "0xYOUR_TREASURY_ADDRESS") {
        throw new Error("Please set TREASURY_ADDRESS in .env file!");
    }

    const FlipRoyalePackShop = await hre.ethers.getContractFactory("FlipRoyalePackShop");
    const shop = await FlipRoyalePackShop.deploy(VIRTUAL_TOKEN, TREASURY);

    await shop.waitForDeployment();
    const address = await shop.getAddress();

    console.log("✅ FlipRoyalePackShop deployed to:", address);
    console.log("   VIRTUAL Token:", VIRTUAL_TOKEN);
    console.log("   Treasury:", TREASURY);

    // Verify on Basescan
    console.log("\n⏳ Waiting for block confirmations...");
    await new Promise(r => setTimeout(r, 30000)); // 30 saniye bekle

    console.log("📝 Verifying contract on Basescan...");
    try {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: [VIRTUAL_TOKEN, TREASURY],
        });
        console.log("✅ Contract verified!");
    } catch (e) {
        console.log("⚠️ Verification failed:", e.message);
    }

    console.log("\n📋 Next steps:");
    console.log("1. Add contract address to .env: PACK_SHOP_CONTRACT=" + address);
    console.log("2. Update frontend to use contract for purchases");
    console.log("3. Users need to approve VIRTUAL token spending");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
