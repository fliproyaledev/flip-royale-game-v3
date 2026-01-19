
const { TOKENS } = require('../lib/tokens');
const { generatePackCards } = require('../lib/game-utils');

console.log("Tokens count:", TOKENS.length);
const unicorns = TOKENS.filter((t: any) => t.about && t.about.toLowerCase().includes('unicorn'));
console.log("Unicorns count:", unicorns.length);

if (unicorns.length > 0) {
    console.log("First unicorn:", unicorns[0]);
} else {
    console.log("Sample token:", TOKENS[0]);
}

try {
    const cards = generatePackCards('unicorn', TOKENS);
    console.log("Generated cards:", cards);
} catch (e: any) {
    console.error("Error generating cards:", e.message);
}
