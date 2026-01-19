import { Token } from './tokens'

export function randInt(max: number) {
  return Math.floor(Math.random() * max)
}

export function makeRandom5(tokens: Token[]): string[] {
  if (!tokens || tokens.length === 0) return []
  return Array.from({ length: 5 }, () => tokens[randInt(tokens.length)].id)
}

// Card type constants
const BASIC_TYPES = ['Sentient', 'Pegasus', 'Firstborn'];
const GENESIS_TYPE = 'Genesis';
const UNICORN_TYPE = 'Unicorn';

// Filter tokens by their type (about field) - Case insensitive
function getCardsByType(tokens: Token[], types: string[]): Token[] {
  const lowerTypes = types.map(t => t.toLowerCase());
  return tokens.filter(t => t.about && lowerTypes.includes(t.about.toLowerCase().trim()));
}

/**
 * Generate cards based on pack type with specific drop rates:
 * - Unicorn Pack: 100% Unicorn cards
 * - Genesis Pack: 100% Genesis cards
 * - Sentient Pack: 100% Sentient cards
 * - Common Pack: 50% Basic (Sentient/Pegasus/Firstborn), 40% Genesis, 10% Unicorn
 * - Rare Pack: 40% Basic, 35% Genesis, 25% Unicorn
 */
export function generatePackCards(packType: string, tokens: Token[]): string[] {
  if (!tokens || tokens.length === 0) return [];

  const cards: string[] = [];
  const pType = packType.toLowerCase().trim();

  // Helper for safer filtering
  const filterBy = (keywords: string[]) =>
    tokens.filter(t => t.about && keywords.some(k => t.about.toLowerCase().includes(k.toLowerCase())));

  // Pre-calculate pools
  const unicornCards = filterBy(['unicorn']);
  const genesisCards = filterBy(['genesis']);
  const sentientCards = filterBy(['sentient']);
  const basicCards = filterBy(['sentient', 'pegasus', 'firstborn']); // Basic includes Sentient

  // Debug log to ensure pools are populated
  console.log(`[PackGen] Type: ${pType} | Pools -> Unicorn: ${unicornCards.length}, Genesis: ${genesisCards.length}, Sentient: ${sentientCards.length}, Basic: ${basicCards.length}, Total: ${tokens.length}`);

  for (let i = 0; i < 5; i++) {
    let pool: Token[] = [];

    // STRICT TYPE SELECTION
    if (pType.includes('unicorn')) {
      pool = unicornCards;
      if (pool.length === 0) throw new Error(`CRITICAL: No Unicorn cards found in database! Cannot open Unicorn Pack.`);
    }
    else if (pType.includes('genesis')) {
      pool = genesisCards;
      if (pool.length === 0) throw new Error(`CRITICAL: No Genesis cards found in database! Cannot open Genesis Pack.`);
    }
    else if (pType.includes('sentient')) {
      pool = sentientCards;
      if (pool.length === 0) throw new Error(`CRITICAL: No Sentient cards found in database! Cannot open Sentient Pack.`);
    }
    else if (pType.includes('rare')) {
      // Rare Pack Logic: 40% Basic, 35% Genesis, 25% Unicorn
      const roll = Math.random() * 100;
      if (roll < 40) pool = basicCards;
      else if (roll < 75) pool = genesisCards;
      else pool = unicornCards;
    }
    else {
      // Common/Default Logic: 50% Basic, 40% Genesis, 10% Unicorn
      const roll = Math.random() * 100;
      if (roll < 50) pool = basicCards;
      else if (roll < 90) pool = genesisCards;
      else pool = unicornCards;
    }

    // Final Safety Check
    if (pool.length === 0) {
      // If pool is empty (e.g. in Common/Rare calculation), fallback to Basic or All, but log warning
      console.warn(`[PackGen] Empty pool selected for ${pType} (likely due to missing probability tier). Fallback to random.`);
      pool = tokens;
    }

    // Pick a random card from the determined pool
    const selected = pool[randInt(pool.length)];
    if (selected) {
      cards.push(selected.id);
    }
  }

  return cards;
}
