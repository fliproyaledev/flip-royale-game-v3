const { ethers } = require('ethers');

const RPC_URL = 'https://mainnet.base.org';
const ROUTER_ADDRESS = '0x209629aDe72dAE392089A4273648eec4aCd98114';
const ABI = [
    'function getDistributionRoute(bytes32 conversionId) external view returns (tuple(address wallet, uint256 attributionWeightBps)[] distributions, uint256 commission, uint256 replyCorpFee, uint256 totalAmount, bytes32 attributionHash, bool distributed, bool distributionStarted, uint256 paidSoFar, uint256 failedSoFar)'
];

const uuid = '1e87c53b-ea1d-4cac-9056-58da9065ce02';

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(ROUTER_ADDRESS, ABI, provider);

    const cleanId = uuid.replace(/-/g, '');
    const bytes32Value = ethers.keccak256(`0x${cleanId}`);

    console.log(`Checking conversion ID: ${uuid}`);
    console.log(`Bytes32: ${bytes32Value}`);

    try {
        const route = await contract.getDistributionRoute(bytes32Value);
        console.log(`\nStored on-chain:`);
        console.log(`- commission: ${ethers.formatEther(route.commission)} VIRTUAL`);
        console.log(`- replyCorpFee: ${ethers.formatEther(route.replyCorpFee)} VIRTUAL`);
        console.log(`- totalAmount: ${ethers.formatEther(route.totalAmount)} VIRTUAL`);
        console.log(`- attributionHash: ${route.attributionHash}`);
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

main().catch(console.error);
