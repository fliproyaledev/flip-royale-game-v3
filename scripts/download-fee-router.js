const https = require('https');
const fs = require('fs');

const address = '0x209629aDe72dAE392089A4273648eec4aCd98114';
const url = `https://api.basescan.org/api?module=contract&action=getsourcecode&address=${address}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        const json = JSON.parse(data);
        if (json.status === '1' && json.result[0].SourceCode) {
            let source = json.result[0].SourceCode;

            // Sometimes Basescan returns source wrapped in {{...}}
            if (source.startsWith('{{')) {
                source = source.substring(1, source.length - 1);
                const parsed = JSON.parse(source);

                // Extract all files and combine or pick the main one
                let combined = '';
                for (const [path, contentObj] of Object.entries(parsed.sources)) {
                    combined += `\n// File: ${path}\n${contentObj.content}\n`;
                }
                fs.writeFileSync('contracts/OriginalFeeRouter.sol', combined);
                console.log('Saved multi-part source to contracts/OriginalFeeRouter.sol');
            } else {
                fs.writeFileSync('contracts/OriginalFeeRouter.sol', source);
                console.log('Saved flat source to contracts/OriginalFeeRouter.sol');
            }
        } else {
            console.error('Failed to get source code:', json.message);
        }
    });
}).on('error', (err) => {
    console.error('Error fetching source:', err.message);
});
