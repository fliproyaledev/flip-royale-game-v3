const { ethers } = require('ethers');

const RPC_URL = 'https://mainnet.base.org';
const ROUTER_ADDRESS = '0x209629aDe72dAE392089A4273648eec4aCd98114';
const ABI = [
    'function getDistributionRoute(bytes32 conversionId) external view returns (tuple(address wallet, uint256 attributionWeightBps)[] distributions, uint256 commission, uint256 replyCorpFee, uint256 totalAmount, bytes32 attributionHash, bool distributed, bool distributionStarted, uint256 paidSoFar, uint256 failedSoFar)'
];

const uuid = '50046daa-ba3b-44e8-ac2b-24b9d9b67cb0';

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(ROUTER_ADDRESS, ABI, provider);

    const variants = {};
    const noHyphen = uuid.replace(/-/g, ''); // 32 chars long

    // 1. Left padded hex
    variants['Left-padded Hex'] = ethers.zeroPadValue(`0x${noHyphen}`, 32);

    // 2. Right padded hex (padEnd with zeros to 64 chars + '0x')
    variants['Right-padded Hex'] = `0x${noHyphen.padEnd(64, '0')}`;

    // 3. ASCII string (no hyphens) as bytes
    variants['ASCII String (no hyphens)'] = ethers.hexlify(ethers.toUtf8Bytes(noHyphen));

    // 4. keccak256 with hyphens
    variants['Keccak256 (with hyphens)'] = ethers.id(uuid);

    // 5. keccak256 without hyphens
    variants['Keccak256 (no hyphens)'] = ethers.id(noHyphen);

    for (const [name, bytes32Value] of Object.entries(variants)) {
        console.log(`Testing [${name}]: ${bytes32Value}`);
        try {
            const route = await contract.getDistributionRoute(bytes32Value);
            if (route.totalAmount > 0n || route.attributionHash !== ethers.ZeroHash) {
                console.log(`\n✅ MATCH FOUND! The correct encoding is: ${name}`);
                console.log(`Bytes32: ${bytes32Value}`);
                console.log(`totalAmount: ${route.totalAmount.toString()}`);
                console.log(`attributionHash: ${route.attributionHash}`);
                return;
            }
        } catch (e) {
            console.log(`Error on ${name}: ${e.message}`);
        }
    }
    console.log('\n❌ None of the variants worked. Attribution data might not be written yet, or the format is something else.');
}

main().catch(console.error);
