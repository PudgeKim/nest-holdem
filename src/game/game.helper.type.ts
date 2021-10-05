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

// users = 방에 있는 모든 유저들
// participatedUsers = 방에 있고, 참가 버튼을 누른 유저들
export type UsersField = 'users' | 'participatedUsers';
