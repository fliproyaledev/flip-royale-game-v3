const { ethers } = require('ethers');

const RPC_URL = 'https://mainnet.base.org';
const ROUTER_ADDRESS = '0x209629aDe72dAE392089A4273648eec4aCd98114';
const ABI = [
    'event AttributionUpdated(bytes32 indexed conversionId, address[] wallets, uint256[] attributionWeightBps, uint256 commission, uint256 replyCorpFee, bytes32 attributionHash, uint256[] computedAmounts)'
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(ROUTER_ADDRESS, ABI, provider);

    console.log('Fetching AttributionUpdated events from last 2000 blocks...');
    try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = currentBlock - 2000;
        const events = await contract.queryFilter('AttributionUpdated', fromBlock, 'latest');

        console.log(`Found ${events.length} events.`);
        for (const evt of events) {
            console.log(`\nconversionId: ${evt.args.conversionId}`);
            console.log(`attributionHash: ${evt.args.attributionHash}`);
            console.log(`commission: ${ethers.formatEther(evt.args.commission)}`);
        }
    } catch (e) {
        console.error('Error fetching logs:', e);
    }
}

main().catch(console.error);
