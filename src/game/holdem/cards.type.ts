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
