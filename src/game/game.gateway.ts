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

  // @SubscribeMessage('msgToServer')
  // public handleMessage(
  //   @ConnectedSocket() client: Socket,
  //   payload: any,
  // ): Promise<WsResponse<any>> {
  //   return this.server.to(payload.room).emit('msgToClient', payload);
  // }

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
    const userInfo = {
      money: user.money,
      socketId: client.id,
    };
    // key=nickname, value={money, socketId}
    const userInfoString = JSON.stringify(userInfo);
    await this.redisClient.hset(roomId, nickname, userInfoString);

    let users: string = await this.redisClient.hget(roomId, 'users');
    // 중복방지를 위해 없는 경우에만 추가함
    if (!this.checkUserExist(users, nickname)) {
      // 처음 유저는 / 없이 저장
      if (users == '') {
        users += String(nickname);
      } else {
        users += '/' + String(nickname); //  /를 구분자로 현재 방에 있는 유저들을 저장함
      }
      await this.redisClient.hmset(roomId, 'users', users);
    }

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

  @SubscribeMessage('leaveRoom')
  public async leaveRoom(
    @MessageBody('roomId') roomId: string,
    @MessageBody('nickname') nickname: string,
    @ConnectedSocket() client: Socket,
  ) {
    const users = await this.redisClient.hget(roomId, 'users');
    const remainingUsers = this.removeUser(nickname, users);
    if (remainingUsers == '') {
      // 남은 유저가 없으면 방 제거
      await this.redisClient.del(roomId);
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
      await client.leave(roomId);
    }
  }

  removeUser(removed: string, users: string): string {
    let res = '';
    const userArr = users.split('/');
    for (let i = 0; i < userArr.length; i++) {
      if (userArr[i] == removed) {
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

  // 덱을 새로 만들고 셔플하며
  // 각 플레이어들에게 카드를 2장씩 나눠주고 총 베팅금을 0으로 초기화 시킴
  @SubscribeMessage('startGame')
  public async startGame(
    @MessageBody('roomId') roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    const sbIdx: number = await this.redisClient.hget(roomId, 'sb');
    const bbIdx: number = await this.redisClient.hget(roomId, 'bb');

    const users: string = await this.redisClient.hget(roomId, 'users');
    const userArr: string[] = users.split('/');

    const sbPlayerNickname = userArr[sbIdx];
    const bbPlayerNickname = userArr[bbIdx];

    const deck: Card[] = initDeck();
    console.log('startGame event check: ', userArr); //////
    await Promise.all(
      userArr.map(async (nickname) => {
        // 새 게임이 시작됬으니 각 플레이어의 베팅금액 0으로 초기화
        await this.redisClient.hset(roomId, nickname, 'betMoney', 0);
        const userInfoString = await this.redisClient.hget(roomId, nickname);
        const userInfo = JSON.parse(userInfoString);
        console.log('startGame userInfo: ', userInfo);
        const socketId = userInfo.socketId;

        const card1 = deck.pop();
        const card2 = deck.pop();

        const cardsInfo = {
          card1,
          card2,
          sb: false,
          bb: false,
        };

        if (nickname == sbPlayerNickname) cardsInfo.sb = true;
        if (nickname == bbPlayerNickname) cardsInfo.bb = true;
        console.log('card1: ', card1, 'card2: ', card2); //////
        this.server.in(socketId).emit('getFirstCards', cardsInfo);
      }),
    );

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
  }

  // 플랍, 턴, 리버에 쓰일 카드 가져옴
  @SubscribeMessage('getCardFromDeck')
  public async getCardFromDeck(
    @MessageBody() data: any, // roomId, order (flop, turn ,river)
    @ConnectedSocket() client: Socket,
  ) {
    const roomId: string = data.roomId;
    const order: string = data.order;
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
    @MessageBody('money') money: number,
    @MessageBody('betMoney') betMoney: number, // 베팅한 금액
    @ConnectedSocket() client: Socket,
  ) {
    const playerInfoString = await this.redisClient.hget(roomId, nickname);
    const playerInfo = JSON.parse(playerInfoString);
    playerInfo.betMoney += betMoney;
    playerInfo.money -= betMoney;

    let totalBet = await this.redisClient.hget(roomId, 'totalBet');
    totalBet += betMoney;
    await this.redisClient.hset(roomId, 'totalBet', totalBet);
    console.log(
      'betting totalBet: ',
      await this.redisClient.hget(roomId, 'totalBet'),
    ); //////////
  }

  public afterInit(server: Server): void {
    return this.logger.log('Init');
  }

  public async handleDisconnect(
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    // joinRoom에서 key=socketId, value={roomId, nickname}으로 저장해 놓음
    const socketInfoString: string = await this.redisClient.hget(
      'sockets',
      client.id,
    );
    const socketInfo = JSON.parse(socketInfoString);
    console.log('handleDisconnection socketINfo: ', socketInfo); ////
    const { roomId, nickname } = socketInfo;

    // disconnected된 client 제거
    await this.redisClient.hdel('sockets', client.id);

    const users = await this.redisClient.hget(roomId, 'users');
    const remainingUsers = this.removeUser(nickname, users);

    if (remainingUsers == '') {
      // 남은 유저가 없으면 방 제거
      await this.redisClient.del(roomId);
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
}
