import { Card, CardSymbol } from './cards.type';

function makeDeck(): Card[] {
  const deck: Card[] = [];
  const symbols: CardSymbol[] = ['spade', 'heart', 'diamond', 'clover'];
  for (let i = 2; i < 15; i += 1) {
    for (const symbol of symbols) {
      const newCard: Card = {
        symbol: symbol,
        num: i,
      };
      deck.push(newCard);
    }
  }
  return deck;
}

export function initDeck(): Card[] {
  const deck = makeDeck();
  return deck.sort(() => Math.random() - Math.random());
}
