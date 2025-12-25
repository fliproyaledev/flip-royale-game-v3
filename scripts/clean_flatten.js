
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("Starting flatten process...");

exec("npx hardhat flatten contracts/FlipRoyalePackShop.sol", { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error: ${error.message}`);
        return;
    }

    // Split into lines
    let lines = stdout.split(/\r?\n/);

    // Filter out known garbage lines
    // 1. Lines starting with keys often used by logs like [dotenv
    // 2. Empty lines at the VERY start if any

    const cleanLines = [];
    let foundCode = false;

    for (const line of lines) {
        const timmmed = line.trim();

        // Skip log lines that might appear
        if (timmmed.startsWith("[dotenv") || timmmed.startsWith("Loading hardhat")) {
            continue;
        }

        // Once we hit a pragma or license or comment, we assume code started
        if (timmmed.startsWith("//") || timmmed.startsWith("pragma") || timmmed.startsWith("import")) {
            foundCode = true;
        }

        cleanLines.push(line);
    }

    const finalContent = cleanLines.join("\n");

    const outPath = path.join(__dirname, "../FlipRoyalePackShop_ForVerify.sol");
    fs.writeFileSync(outPath, finalContent, "utf8");

    console.log(`✅ File written to ${outPath} (UTF-8)`);
});
