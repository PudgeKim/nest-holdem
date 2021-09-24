import { Card, CardRank, CardRankType, CardsRankInfo } from './cards.type';

export class PlayerCards {
  private allCards: Card[] = []; // player가 가지고 있는 카드2장과 최종필드 5장해서 7장까지
  private finalCards: Card[] = []; // 가장 족보가 높은 패 5장
  private rankInfo: CardsRankInfo;

  constructor(card1: Card, card2: Card) {
    // 처음 받는 카드 2장
    this.allCards.push(card1);
    this.allCards.push(card2);
    this.rankInfo = this.initRankInfo(card1, card2);
  }

  private initRankInfo(card1: Card, card2: Card): CardsRankInfo {
    let rankType: CardRankType = 'HighCard';
    let rank: CardRank = CardRank.HighCard;
    let firstRank = 0;
    let secondRank = 0;

    if (this.isPocket(card1, card2)) {
      rankType = 'OnePair';
      rank = CardRank.OnePair;
      firstRank = card1.num;
      secondRank = card2.num;
    }

    const rankInfo: CardsRankInfo = {
      rank: rank,
      rankType: rankType,
      subRank: {
        firstRank: firstRank,
        secondRank: secondRank,
        thirdRank: 0,
        fourthRank: 0,
        fifthRank: 0,
      },
    };

    return rankInfo;
  }

  private isPocket(card1: Card, card2: Card): boolean {
    // 시작 패가 포켓인지 아닌지
    if (card1.num == card2.num) {
      return true;
    } else {
      return false;
    }
  }

  addCard(...cards: Card[]) {
    for (const card of cards) {
      this.allCards.push(card);
    }
  }

  setRankInfo(rankInfo: CardsRankInfo) {
    const rankType = rankInfo.rankType;

    if (rankInfo.rank < 1 || rankInfo.rank > 10) {
      throw new Error('rank range error: range of the rank is wrong');
    }

    const rank = rankInfo.rank;

    // subRank의 firstRank부터 fifthRank까지 검사하는데
    // 범위가 이상한게 있는지 검사 (모든 rank는 2~14) (A=14)
    for (const seq in rankInfo.subRank) {
      if (rankInfo.subRank[seq] < 2 || rankInfo.subRank[seq] > 14) {
        throw new Error(
          `'rank range error: value of the subRank.${seq} is out of range'`,
        );
      }
    }

    // 나중에 PlayerCards간에 비교를 위해 subRank를 정렬해둠
    const sortedSubRank = this.sortSubRank(rankInfo);

    this.rankInfo = {
      rank: rank,
      rankType: rankType,
      subRank: {
        firstRank: sortedSubRank[4],
        secondRank: sortedSubRank[3],
        thirdRank: sortedSubRank[2],
        fourthRank: sortedSubRank[1],
        fifthRank: sortedSubRank[0],
      },
    };
  }

  private sortSubRank(rankInfo: CardsRankInfo): number[] {
    const nums: number[] = [];
    const subRank = rankInfo.subRank;

    for (const seqKey in subRank) {
      nums.push(subRank[seqKey]);
    }

    const sorted: number[] = nums.sort((a, b) => a - b);
    return sorted;
  }

  getAllCards(): Card[] {
    const copied = Object.assign({}, this.allCards);
    return copied;
  }

  getFinalCards(): Card[] {
    const copied = Object.assign({}, this.finalCards);
    return copied;
  }

  getRankInfo(): CardsRankInfo {
    const copied = JSON.parse(JSON.stringify(this.rankInfo)); // deep copy
    return copied;
  }
}

export function comparePlayerCards(p1: PlayerCards, p2: PlayerCards) {
  const p1Rank = p1.getRankInfo().rank;
  const p2Rank = p2.getRankInfo().rank;

  if (p1Rank > p2Rank) {
    return 1;
  }

  if (p1Rank < p2Rank) {
    return -1;
  }

  // rank가 같은 경우
  const p1SubRank = p1.getRankInfo().subRank;
  const p2SubRank = p2.getRankInfo().subRank;

  // 두 플레이어들의 카드를 하나씩 비교해봄
  for (const seqKey in p1SubRank) {
    if (p1SubRank[seqKey] == p2SubRank[seqKey]) continue;

    if (p1SubRank[seqKey] > p2SubRank[seqKey]) return 1;
    else return -1;
  }

  return 0; // 무승부
}
