const { ethers } = require('ethers');

const uuid = '50046daa-ba3b-44e8-ac2b-24b9d9b67cb0';
const target = '0xbed1de86d2c2162acb3dcb6f973175ad278a708329429c2eff4705bfc812a788';

const noHyphen = uuid.replace(/-/g, '');

const tests = {
    "keccak256(uuid string)": ethers.id(uuid),
    "keccak256(uuid no hyphens)": ethers.id(noHyphen),
    "keccak256(uuid hex)": ethers.keccak256(`0x${noHyphen}`),
    "keccak256(left padded uuid)": ethers.keccak256(ethers.zeroPadValue(`0x${noHyphen}`, 32)),
    "keccak256(right padded uuid)": ethers.keccak256(`0x${noHyphen.padEnd(64, '0')}`),
    "sha256(uuid)": ethers.sha256(ethers.toUtf8Bytes(uuid)),
    "sha256(uuid hex)": ethers.sha256(`0x${noHyphen}`)
};

for (const [name, res] of Object.entries(tests)) {
    if (res === target) {
        console.log(`✅ MATCH! ${name} is the correct encoding.`);
        return;
    }
    console.log(`${name}: ${res}`);
}

console.log('No match found.');
