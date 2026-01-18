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

// Filter tokens by their type (about field)
function getCardsByType(tokens: Token[], types: string[]): Token[] {
  return tokens.filter(t => types.includes(t.about));
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

  // Pre-filter tokens by type
  const basicCards = getCardsByType(tokens, BASIC_TYPES);
  const genesisCards = getCardsByType(tokens, [GENESIS_TYPE]);
  const unicornCards = getCardsByType(tokens, [UNICORN_TYPE]);
  const sentientCards = getCardsByType(tokens, ['Sentient']);

  for (let i = 0; i < 5; i++) {
    let pool: Token[];

    switch (packType.toLowerCase()) {
      case 'unicorn':
        pool = unicornCards;
        break;
      case 'genesis':
        pool = genesisCards;
        break;
      case 'sentient':
        pool = sentientCards;
        break;
      case 'rare':
        // 40% basic, 35% genesis, 25% unicorn
        const rareRoll = Math.random() * 100;
        if (rareRoll < 40) pool = basicCards;
        else if (rareRoll < 75) pool = genesisCards;
        else pool = unicornCards;
        break;
      case 'common':
      default:
        // 50% basic, 40% genesis, 10% unicorn
        const commonRoll = Math.random() * 100;
        if (commonRoll < 50) pool = basicCards;
        else if (commonRoll < 90) pool = genesisCards;
        else pool = unicornCards;
        break;
    }

    // Pick random card from pool (fallback to all tokens if pool empty)
    if (pool.length > 0) {
      cards.push(pool[randInt(pool.length)].id);
    } else {
      cards.push(tokens[randInt(tokens.length)].id);
    }
  }

  return cards;
}
