export type GameUserInfo = {
  socketId: string;
  money: number;
  isParticipated: boolean;
  betMoney: number;
  isDead: boolean;
};

export type SocketInfo = {
  roomId: string;
  nickname: string;
};

export type IncreaseOrDecrease = 'INCREASE' | 'DECREASE';
