export type Card = {
  symbol: string;
  num: number; // A는 14
};

export enum CardRank {
  HighCard,
  OnePair,
  TwoPair,
  Triple,
  Straight,
  Flush,
  FullHouse,
  FourCard,
  StraightFlush,
  RoyalStraightFlush,
}

export type CardRankType =
  | 'HighCard'
  | 'OnePair'
  | 'TwoPair'
  | 'Triple'
  | 'Straight'
  | 'Flush'
  | 'FullHouse'
  | 'FourCard'
  | 'StraightFlush'
  | 'RoyalStraightFlush';

export type CardsRankInfo = {
  rank: CardRank; // 원페어인지, 투페어인지 등을 숫자로 나타냄 (비교를 위해서)
  rankType: CardRankType; // 원페어인지, 투페어인지...

  // 2, 9 투페어라면 firstRank=9, secondRank=9, thirdRank=2, fourthRank=2 (더 높은 숫자가 우선순위)
  // 3이 3장이고 5가 2장인 풀하우스라면 firstRank 부터 thirdRank까지는 3, fourthRank, fifthRank=5 (3장짜리가 우선순위)
  // 스트레이트, 플러시 등도 10 스트레이트라면 firstRank=10, secondRank=9 ... fifthRank=6
  subRank: {
    firstRank: number;
    secondRank: number;
    thirdRank: number;
    fourthRank: number;
    fifthRank: number;
  };
};

export type CardsWithRank = {
  cards: Card[];
  rank: CardRank;
};

// 필드와 플레이어카드를 합쳐서 가장 높은 족보를 얻어냄
export function getHighestCards(playerCards: Card[]): CardsWithRank {
  const allCombinations: CardsWithRank[] = [];
  makeAllCombinations(playerCards, [], allCombinations, 0, 0);
  const highestCards: CardsWithRank =
    getHighestCardsWithRankFromCombinations(allCombinations);

  return highestCards;
}

// 7장의 카드로 가능한 모든 5장을 만들어냄
// allCards = playerCards.allCards
// tmpCards = 조합을 새로 만들기 위해 필요한 임시 배열
// result = 모든 조합들이 들어가는 배열
export function makeAllCombinations(
  allCards: Card[],
  tmpCards: Card[],
  result: CardsWithRank[],
  lv: number,
  startIdx: number,
) {
  if (lv == 5) {
    // copy를 안해주면 같은 포인터를 가리키기 때문에 tmpCards는 결국 빈 배열이 됨
    const copied = Object.assign([], tmpCards);
    const cardsWithRank = getCardsWithRank(copied);
    result.push(cardsWithRank);
  }

  for (let i = startIdx; i < 7; i += 1) {
    tmpCards.push(allCards[i]);
    makeAllCombinations(allCards, tmpCards, result, lv + 1, i + 1);
    tmpCards.pop();
  }
}

// 위에서 구한 result에 들어있는 것들 중 가장 높은 족보인걸 가져옴
export function getHighestCardsWithRankFromCombinations(
  cardsWithRankArr: CardsWithRank[],
): CardsWithRank {
  const sortedCards = cardsWithRankArr.sort((a, b) => {
    // 우선 rank별로 비교해봄
    // 예를 들어 fullHouse와 onePair라면 fullHouse가 무조건 높기 때문에 바로 return함
    if (a.rank > b.rank) return 1;
    if (a.rank < b.rank) return -1;

    // rank가 같다면 더 높은 숫자를 가지고 있는걸 알아냄
    // 카드들은 이미 오름차순 정렬되어 있음
    for (let i = 4; i > -1; i -= 1) {
      if (a.cards[i].num == b.cards[i].num) continue;

      if (a.cards[i].num > b.cards[i].num) return 1;
      else return -1;
    }
    return 0;
  });

  return sortedCards[sortedCards.length - 1];
}

function getCardsWithRank(cards: Card[]): CardsWithRank {
  if (cards.length != 5) {
    throw new Error('getCardRank error: length of the cards is not 5');
  }

  // 아래 족보 검사 함수들은 오름차순 정렬이 되어있다고 가정하고 만들어진 함수들임
  cards.sort((a, b) => a.num - b.num);

  let rank;

  if (isRoyalStraightFlush(cards)) rank = CardRank.RoyalStraightFlush;
  else if (isStraightFlush(cards)) rank = CardRank.StraightFlush;
  else if (isFourCard(cards)) rank = CardRank.FourCard;
  else if (isFullHouse(cards)) rank = CardRank.FullHouse;
  else if (isFlush(cards)) rank = CardRank.Flush;
  else if (isStraight(cards)) rank = CardRank.StraightFlush;
  else if (isTriple(cards)) rank = CardRank.Triple;
  else if (isTwoPair(cards)) rank = CardRank.TwoPair;
  else if (isOnePair(cards)) rank = CardRank.OnePair;
  else rank = CardRank.HighCard;

  const cardsWithRank: CardsWithRank = {
    cards: cards,
    rank: rank,
  };

  return cardsWithRank;
}

function isRoyalStraightFlush(cards: readonly Card[]): boolean {
  if (cards[0].num != 10) {
    return false;
  }

  for (let i = 0; i < 4; i++) {
    if (
      cards[i].symbol != cards[i + 1].symbol ||
      cards[i].num + 1 != cards[i + 1].num
    ) {
      return false;
    }
  }

  return true;
}

function isStraightFlush(cards: readonly Card[]): boolean {
  // A로 시작하는 경우
  if (cards[0].num == 14) {
    // A로 시작하니까 다음 카드는 2여야함
    if (cards[0].symbol != cards[1].symbol || cards[1].num != 2) {
      return false;
    }

    // 2부터 시작해서 검사
    for (let i = 1; i < 4; i += 1) {
      if (
        cards[i].symbol != cards[i + 1].symbol ||
        cards[i].num + 1 != cards[i + 1].num
      ) {
        return false;
      }
    }

    return true;
  } else {
    for (let i = 0; i < 4; i += 1) {
      if (
        cards[i].symbol != cards[i + 1].symbol ||
        cards[i].num + 1 != cards[i + 1].num
      ) {
        return false;
      }
    }

    return true;
  }
}

function isFourCard(cards: readonly Card[]): boolean {
  // 1번째부터 4번째까지 포카드인 경우
  if (
    cards[0].num == cards[1].num &&
    cards[1].num == cards[2].num &&
    cards[2].num == cards[3].num
  ) {
    return true;
  }

  // 2번째부터 5번째까지 포카드인 경우
  if (
    cards[1].num == cards[2].num &&
    cards[2].num == cards[3].num &&
    cards[3].num == cards[4].num
  ) {
    return true;
  }

  return false;
}

function isFullHouse(cards: readonly Card[]): boolean {
  // 1번째부터 3번째까지 트리플인 경우
  if (
    cards[0].num == cards[1].num &&
    cards[1].num == cards[2].num &&
    cards[3].num == cards[4].num
  ) {
    return true;
  }

  // 3번째부터 5번째까지 트리플인 경우
  if (
    cards[0].num == cards[1].num &&
    cards[2].num == cards[3].num &&
    cards[3].num == cards[4].num
  ) {
    return true;
  }

  return false;
}

function isFlush(cards: readonly Card[]): boolean {
  for (let i = 0; i < 4; i++) {
    if (cards[i].symbol != cards[i + 1].symbol) {
      return false;
    }
  }

  return true;
}

function isStraight(cards: readonly Card[]): boolean {
  for (let i = 0; i < 4; i++) {
    if (cards[i].num != cards[i + 1].num) {
      return false;
    }
  }
  return true;
}

function isTriple(cards: readonly Card[]): boolean {
  // 1번째부터 3번째까지 트리플인 경우
  if (cards[0].num == cards[1].num && cards[1].num == cards[2].num) {
    return true;
  }

  // 2번째부터 4번째까지 트리플인 경우
  if (cards[1].num == cards[2].num && cards[2].num == cards[3].num) {
    return true;
  }

  // 3번째부터 5번째까지 트리플인 경우
  if (cards[2].num == cards[3].num && cards[3].num == cards[4].num) {
    return true;
  }

  return false;
}

function isTwoPair(cards: readonly Card[]): boolean {
  // 1번째부터 4번째까지 투페어인 경우
  if (cards[0].num == cards[1].num && cards[2].num == cards[3].num) {
    return true;
  }

  // 2번째부터 5번째까지 투페어인 경우
  if (cards[1].num == cards[2].num && cards[3].num == cards[4].num) {
    return true;
  }

  return false;
}

function isOnePair(cards: readonly Card[]): boolean {
  for (let i = 0; i < 4; i++) {
    if (cards[i].num == cards[i + 1].num) {
      return true;
    }
  }

  return false;
}
