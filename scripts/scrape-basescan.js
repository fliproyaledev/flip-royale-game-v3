const fs = require('fs');

async function scrape() {
    const url = 'https://basescan.org/address/0x209629aDe72dAE392089A4273648eec4aCd98114#code';
    console.log(`Fetching ${url}...`);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
        });
        const text = await res.text();

        // Search for "editor.setValue('..." or <pre class="js-sourcecopyarea ...
        const match = text.match(/<pre class='js-sourcecopyarea editor' id='editor1' style='margin-top: 5px;'>(.*?)<\/pre>/s);
        if (match && match[1]) {
            const rawCode = match[1]
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"');
            fs.writeFileSync('contracts/ScrapedFeeRouter.sol', rawCode);
            console.log('Successfully scraped Source Code to contracts/ScrapedFeeRouter.sol');
        } else {
            console.log('Could not find source code block in HTML. It might be unverified or behind Cloudflare.');
            // Let's just dump the first 1000 chars of text to see what happened
            fs.writeFileSync('basescan_dump.html', text);
            console.log('Dumped HTML to basescan_dump.html');
        }
    } catch (e) {
        console.error('Error fetching:', e.message);
    }
}
scrape();
