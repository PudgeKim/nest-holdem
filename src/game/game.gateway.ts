import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'ws';
import { Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RedisService } from 'nestjs-redis';
import { UserRepo } from 'src/users/users.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/user.entity';
import { initDeck } from './holdem/deck';
import { Card } from './holdem/cards.type';
import {
  GameUserInfo,
  IncreaseOrDecrease,
  SocketInfo,
  UsersField,
} from './game.helper.type';

@WebSocketGateway({ namespace: 'holdem-room', cors: true })
export class GameGateway
  implements OnGatewayConnection, OnGatewayInit, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('MessageGateway');
  redisClient: any;
  constructor(
    @InjectRepository(UserRepo)
    private userRepository: UserRepo,
    private readonly redisService: RedisService,
  ) {
    this.redisClient = redisService.getClient();
  }

  @SubscribeMessage('joinRoom')
  public async joinRoom(
    @MessageBody('roomId') roomId: string,
    @MessageBody('nickname') nickname: string,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    // room별로 관리하기 위해
    await client.join(roomId);

    // handleDisconnection에서 어떤 socketId가 어떤 room에서 끊어졌는지 확인해야되기 때문
    const socketInfo = {
      roomId: roomId,
      nickname: nickname,
    };
    const socketInfoString = JSON.stringify(socketInfo);
    await this.redisClient.hset('sockets', client.id, socketInfoString);

    const user = await this.userRepository.findOne({ nickname });
    const userInfo: GameUserInfo = {
      socketId: client.id,
      money: user.money,
      isParticipated: false,
      betMoney: 0,
      isDead: false,
    };

    await this.saveUserInfoToRedis(roomId, nickname, userInfo);

    // users는 /를 구분자로 이루어진 string   ex) batman/spiderman/catman
    const users: string = await this.addUser(roomId, nickname, 'users');

    const allUsers: PublicUser[] = await this.getUsersInfo(users);
    const hostNickname: string = await this.redisClient.hget(roomId, 'host');
    const usersInfo = {
      host: hostNickname,
      allUsers: allUsers,
    };
    console.log('joinRoom event check: ', usersInfo); ////////////
    // to send all users in the room
    this.server.in(roomId).emit('getUsersInfo', usersInfo);
  }

  @SubscribeMessage('participateGame')
  public async participateGame(
    @MessageBody('roomId') roomId: string,
    @MessageBody('nickname') nickname: string,
    @ConnectedSocket() client: Socket,
  ) {
    const userInfo: GameUserInfo = await this.getUserInfoFromRedis(
      roomId,
      nickname,
    );
    userInfo.isParticipated = true;
    this.saveUserInfoToRedis(roomId, nickname, userInfo);

    // 참가자 리스트에 추가
    await this.addUser(roomId, nickname, 'participants');
    // 참가자수 1 증가
    this.calculateParticipant(roomId, 'INCREASE');

    this.server.in(roomId).emit('getParticipant', {
      nickname: nickname,
      isParticipated: userInfo.isParticipated,
    });
  }

  @SubscribeMessage('leaveRoom')
  public async leaveRoom(
    @MessageBody('roomId') roomId: string,
    @MessageBody('nickname') nickname: string,
    @ConnectedSocket() client: Socket,
  ) {
    const userInfo: GameUserInfo = await this.getUserInfoFromRedis(
      roomId,
      nickname,
    );
    // 참가버튼을 누른 유저였다면 참가자 수 1 감소 & 참가자에서 뺌
    if (userInfo.isParticipated) {
      this.calculateParticipant(roomId, 'DECREASE');
      await this.removeUser(roomId, nickname, 'participants');
    }

    const remainingUsers = await this.removeUser(roomId, nickname, 'users');
    console.log('leaveRoom remainingUsers: ', remainingUsers); ///////////
    if (remainingUsers == '') {
      // 남은 유저가 없으면 방 제거
      await this.redisClient.del(roomId);
      console.log('check delete room: ', await this.redisClient.get(roomId)); ///////
    } else {
      await this.redisClient.hset(roomId, 'users', remainingUsers);
      const host: string = await this.redisClient.hget(roomId, 'host');
      // 나간게 host라면 남아있는 사람들중에서 먼저 들어온사람이 host가 됨
      if (nickname == host) {
        const nextHost = remainingUsers.split('/')[0];
        await this.redisClient.hset(roomId, 'host', nextHost);
      }

      // 아래 로직 필요한가 ?
      const allUsers = await this.getUsersInfo(remainingUsers);
      const hostNickname = await this.redisClient.hget(roomId, 'host');

      const usersInfo = {
        host: hostNickname,
        allUsers: allUsers,
      };

      console.log('leaveRoom event check!'); //////////
      // to send all users except sender
      client.to(roomId).emit('getUsersInfo', usersInfo);
      await client.leave(roomId); // 이건 필요함
    }
  }

  // 덱을 새로 만들고 셔플하며
  // 각 플레이어들에게 카드를 2장씩 나눠주고 총 베팅금을 0으로 초기화 시킴
  // (참가 버튼을 누른 플레이어들에게만)
  @SubscribeMessage('startGame')
  public async startGame(
    @MessageBody('roomId') roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const participantCnt: number = await this.redisClient.hget(
      roomId,
      'participantCnt',
    );
    // 참가자가 최소 2명이상 있어야 게임시작
    if (participantCnt < 2) {
      client.emit('cannotStart', {
        success: false,
        message: 'participant should be equal or more than two',
      });
      return;
    }

    const sbIdx: number = await this.redisClient.hget(roomId, 'sb');
    const bbIdx: number = await this.redisClient.hget(roomId, 'bb');
    const participants: string = await this.redisClient.hget(
      roomId,
      'participants',
    );
    const participantArr: string[] = participants.split('/');

    const sbPlayerNickname = participantArr[sbIdx];
    const bbPlayerNickname = participantArr[bbIdx];

    const deck: Card[] = initDeck();
    console.log('startGame event check: ', participantArr); //////
    await Promise.all(
      // 게임 참가 버튼 누른 사람들에게만 데이터 전달
      participantArr.map(async (nickname) => {
        const userInfo: GameUserInfo = await this.getUserInfoFromRedis(
          roomId,
          nickname,
        );

        // 새 게임이 시작됬으니 각 플레이어의 베팅금액 0으로 초기화
        userInfo.betMoney = 0;
        await this.saveUserInfoToRedis(roomId, nickname, userInfo);

        console.log('startGame userInfo: ', userInfo); ///////
        const socketId = userInfo.socketId;

        const card1 = deck.pop();
        const card2 = deck.pop();

        const playerInThisOrder = await this.getNicknameInThisOrder(roomId);

        const dataToEmit = {
          card1,
          card2,
          sb: false,
          bb: false,
          playerInThisOrder,
        };

        if (nickname == sbPlayerNickname) dataToEmit.sb = true;
        if (nickname == bbPlayerNickname) dataToEmit.bb = true;

        console.log('startGame cards: ', dataToEmit);

        // 참가버튼 누른사람에게만 개별적으로 보내기때문에 Ack을 받아서 다 받았는지 확인해야함
        this.server.to(socketId).emit('getFirstCards', dataToEmit);
      }),
    );

    await this.increasePlayerOrder(roomId);

    // 남은 덱에서 필드에 쓰일 5장은 redis에 저장해놓음
    let cards = '';
    for (let i = 0; i < 5; i++) {
      const card: Card = deck.pop();
      const cardString = card.symbol + String(card.num); // redis에 저장하기 위해 string으로 바꿈
      if (i == 4) {
        cards += cardString;
      } else {
        cards += cardString + '/';
      }
    }
    await this.redisClient.hset(roomId, 'cards', cards);

    // 새로운 게임이 시작됬으니 총 베팅금은 0원으로 초기화
    await this.redisClient.hset(roomId, 'totalBet', 0);

    // minBet은 베팅을 해야할 최소 금액
    // 예를 들어 어떤 플레이어가 12만을 베팅했으면
    // 다음 플레이어들은 최소 12만 이상을 베팅해야함
    await this.redisClient.hset(roomId, 'minBet', 0);
  }

  // 플랍, 턴, 리버에 쓰일 카드 가져옴
  @SubscribeMessage('getCardFromDeck')
  public async getCardFromDeck(
    @MessageBody('roomId') roomId: string,
    @MessageBody('order') order: string, // (flop, turn, river)
    @ConnectedSocket() client: Socket,
  ) {
    const cards = await this.redisClient.hget(roomId, 'cards');
    console.log('getDeck cards: ', cards); ////////
    const cardInfo = {};
    if (order == 'flop') {
      const cardArr = cards.split('/');
      cardInfo['cards'] = [cardArr[0], cardArr[1], cardArr[2]];

      const remCards = cardArr[3] + '/' + cardArr[4];
      await this.redisClient.hset(roomId, 'cards', remCards);
    } else if (order == 'turn') {
      const cardArr = cards.split('/');
      cardInfo['cards'] = [cardArr[0]];

      const remCards = cardArr[1];
      await this.redisClient.hset(roomId, 'cards', remCards);
    } else if (order == 'river') {
      cardInfo['cards'] = [cards];
      await this.redisClient.hset(roomId, 'cards', '');
    }

    client.in(roomId).emit('getCardFromDeck', cardInfo);
  }

  @SubscribeMessage('betting')
  public async betting(
    @MessageBody('roomId') roomId: string,
    @MessageBody('nickname') nickname: string,
    @MessageBody('betMoney') betMoney: number, // 베팅한 금액
    @ConnectedSocket() client: Socket,
  ) {
    console.log('betting event: ', nickname, betMoney); //////
    const minBet = await this.redisClient.hget(roomId, 'minBet');
    if (minBet > betMoney) {
      client.emit('cannotBetMoney', {
        msg: `betMoney should be equal or more than ${minBet}`,
      });
      return;
    }

    await this.redisClient.hset(roomId, 'minBet', betMoney);

    const userInfo: GameUserInfo = await this.getUserInfoFromRedis(
      roomId,
      nickname,
    );
    userInfo.betMoney += betMoney;
    userInfo.money -= betMoney;
    await this.saveUserInfoToRedis(roomId, nickname, userInfo);
    console.log(
      'betting userInfo: ',
      userInfo,
      typeof userInfo.betMoney,
      typeof userInfo.money,
    );
    const totalBet: number = parseInt(
      await this.redisClient.hget(roomId, 'totalBet'),
    );
    console.log('totalBet: ', totalBet, typeof totalBet); //////
    await this.redisClient.hset(roomId, 'totalBet', totalBet + betMoney);

    const storedTotalBet = await this.redisClient.hget(roomId, 'totalBet');
    console.log('storedTotalBet: ', storedTotalBet);
    const playerInThisOrder: string = await this.getNicknameInThisOrder(roomId);

    // 모두에게 보내주어야 서로의 베팅금액과 누구 순서인지 알 수 있음
    this.server.in(roomId).emit('bettingEvent', {
      nickname,
      betMoney,
      totalBet: storedTotalBet,
      playerInThisOrder,
    });

    await this.increasePlayerOrder(roomId);
  }

  // 참가자들이 베팅 후에 Ack을 보내는데
  // 그 Ack들이 참가자 수만큼 들어있는지 확인 후
  // 게임을 진행시킴
  //@SubscribeMessage('checkBettingAck')

  public afterInit(server: Server): void {
    return this.logger.log('Init');
  }

  public async handleDisconnect(
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const socketInfo: SocketInfo = await this.getSocketInfoFromRedis(client.id);
    console.log('handleDisconnection socketINfo: ', socketInfo); ////
    const { roomId, nickname } = socketInfo;

    // disconnected된 client 제거
    await this.redisClient.hdel('sockets', client.id);

    const remainingUsers = await this.removeUser(roomId, nickname, 'users');
    console.log('handleDisconnection remainingUsers: ', remainingUsers); /////
    if (remainingUsers == '') {
      // 남은 유저가 없으면 방 제거
      await this.redisClient.del(roomId);
      console.log(
        'handleDisconnection delete room: ',
        await this.redisClient.get(roomId),
      ); //////
    } else {
      // 나간 유저 제거하고 남아있는 유저들로 업데이트
      await this.redisClient.hset(roomId, 'users', remainingUsers);
      const host: string = await this.redisClient.hget(roomId, 'host');
      // 나간게 host라면 남아있는 사람들중에서 먼저 들어온사람이 host가 됨
      if (nickname == host) {
        const nextHost = remainingUsers.split('/')[0];
        await this.redisClient.hset(roomId, 'host', nextHost);
      }
    }

    console.log(
      'handleDisconnect allUsers: ',
      await this.redisClient.hget(roomId, 'users'),
    ); ////////
    return this.logger.log(`${nickname} is disconnected`);
  }

  public handleConnection(@ConnectedSocket() client: Socket): void {
    return this.logger.log(`Client connected: ${client.id}`);
  }

  checkUserExist(users: string, newUser: string): boolean {
    const userArr = users.split('/');
    if (userArr.includes(newUser)) return true;
    return false;
  }

  async getUsersInfo(users: string): Promise<PublicUser[]> {
    const userArr = users.split('/');
    const usersInfo: PublicUser[] = [];
    console.log('userArr: ', userArr);

    await Promise.all(
      userArr.map(async (nickname) => {
        const user: User = await this.userRepository.findOne({
          nickname: nickname,
        });

        usersInfo.push({
          id: user.id,
          nickname: user.nickname,
          money: user.money,
        });
      }),
    );

    return usersInfo;
  }

  async addUser(
    roomId: string,
    nickname: string,
    fieldName: UsersField,
  ): Promise<string> {
    let users: string = await this.redisClient.hget(roomId, fieldName);
    // 중복방지를 위해 없는 경우에만 추가함
    if (!this.checkUserExist(users, nickname)) {
      // 처음 유저는 / 없이 저장
      if (users == '') {
        users += String(nickname);
      } else {
        users += '/' + String(nickname); //  /를 구분자로 현재 방에 있는 유저들을 저장함
      }
      await this.redisClient.hset(roomId, fieldName, users);
    }
    return users;
  }

  async removeUser(
    roomId: string,
    nickname: string,
    fieldName: UsersField,
  ): Promise<string> {
    const users = await this.redisClient.hget(roomId, fieldName);
    if (users == '') return '';

    let res = '';
    const userArr = users.split('/');
    for (let i = 0; i < userArr.length; i++) {
      if (userArr[i] == nickname) {
        if (i == userArr.length - 1) {
          // 제거하려는 유저가 마지막에 있는 경우 그전 유저의 /가 남으므로 제거함
          res = res.slice(0, res.length - 1);
        }
        continue;
      }

      if (i == userArr.length - 1) {
        res += userArr[i];
      } else {
        res += userArr[i] + '/';
      }
    }

    return res;
  }

  async getUserInfoFromRedis(
    roomId: string,
    nickname: string,
  ): Promise<GameUserInfo> {
    const userInfoString: string = await this.redisClient.hget(
      roomId,
      nickname,
    );
    console.log('fromRedis: ', userInfoString); //////
    const userInfo: GameUserInfo = JSON.parse(userInfoString);
    return userInfo;
  }

  async saveUserInfoToRedis(
    roomId: string,
    nickname: string,
    userInfo: GameUserInfo,
  ) {
    const userInfoString = JSON.stringify(userInfo);
    await this.redisClient.hset(roomId, nickname, userInfoString);
  }

  async getSocketInfoFromRedis(socketId: string): Promise<SocketInfo> {
    const socketInfoString: string = await this.redisClient.hget(
      'sockets',
      socketId,
    );
    const socketInfo: SocketInfo = JSON.parse(socketInfoString);
    return socketInfo;
  }

  async calculateParticipant(
    roomId: string,
    increaseOrDecrease: IncreaseOrDecrease,
  ) {
    const participantCnt: number = await this.redisClient.hget(
      roomId,
      'participantCnt',
    );
    if (increaseOrDecrease == 'INCREASE') {
      await this.redisClient.hset(roomId, 'participantCnt', participantCnt + 1);
    } else {
      await this.redisClient.hset(roomId, 'participantCnt', participantCnt - 1);
    }
  }

  // 이번 순서에 맞는 닉네임 return
  async getNicknameInThisOrder(roomId: string): Promise<string> {
    const playerOrder: number = await this.redisClient.hget(
      roomId,
      'playerOrder',
    );
    const participants: string = await this.redisClient.hget(
      roomId,
      'participants',
    );

    const participantArr = participants.split('/');
    const idx = Number(playerOrder) % participantArr.length;
    const player = participantArr[idx];
    console.log('participantArr: ', participantArr);
    console.log('idx: ', idx);
    console.log('playerOrder: ', playerOrder);
    console.log('length: ', participantArr.length);

    return player;
  }

  async increasePlayerOrder(roomId: string) {
    const playerOrder = await this.redisClient.hget(roomId, 'playerOrder');
    await this.redisClient.hset(roomId, 'playerOrder', Number(playerOrder) + 1);
  }
}
