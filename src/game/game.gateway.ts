import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
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

  @SubscribeMessage('msgToServer')
  public handleMessage(
    @ConnectedSocket() client: Socket,
    payload: any,
  ): Promise<WsResponse<any>> {
    return this.server.to(payload.room).emit('msgToClient', payload);
  }

  @SubscribeMessage('joinRoom')
  public async joinRoom(
    @MessageBody() data: any, // front에서 json으로 넘겨주니까 걍 object로 받음
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const roomId: string = data.roomId;
    const nickname: string = data.nickname;

    await this.redisClient.hset(roomId, nickname, client.id); // 각 닉네임별로 socketId 저장

    let users: string = await this.redisClient.hget(data.roomId, 'users');
    if (!this.checkUserExist(users, data.nickname)) {
      // 중복방지를 위해 없는 경우에만 추가함
      if (users == '') {
        // 처음 유저는 / 없이 저장
        users += String(data.nickname);
      } else {
        users += '/' + String(data.nickname); //  /를 구분자로 현재 방에 있는 유저들을 저장함
      }
      await this.redisClient.hmset(data.roomId, 'users', users);
    }

    const allUsers: PublicUser[] = await this.getUsersInfo(users);
    const hostNickname: string = await this.redisClient.hget(
      data.roomId,
      'host',
    );
    const usersInfo = {
      host: hostNickname,
      allUsers: allUsers,
    };
    console.log('joinRoom event check: ', usersInfo); ////////////
    client.broadcast.emit('getUsersInfo', usersInfo);
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
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    const roomId: string = data.roomId;
    let users = await this.redisClient.hget(roomId, 'users');
    users = this.removeUser(data.nickname, users);
    if (users == '') {
      // 남은 유저가 없으면 방 제거
      await this.redisClient.del(roomId);
    } else {
      const host: string = await this.redisClient.hget(roomId, 'host');
      // 나간게 host라면 남아있는 사람들중에서 먼저 들어온사람이 host가 됨
      if (data.nickname == host) {
        const nextHost = users.split('/')[0];
        await this.redisClient.hset(roomId, 'host', nextHost);
      }

      const allUsers = await this.getUsersInfo(users);
      const hostNickname = await this.redisClient.hget(roomId, 'host');

      const usersInfo = {
        host: hostNickname,
        allUsers: allUsers,
      };

      console.log('leaveRoom event check!'); //////////
      client.broadcast.emit('getUsersInfo', usersInfo);
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

  @SubscribeMessage('startGame')
  public async startGame(
    @MessageBody() data: any, // roomId
    @ConnectedSocket() client: Socket,
  ) {
    const roomId: string = data.roomId;

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
        const socketId: string = await this.redisClient.hget(roomId, nickname);
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
        this.server.to(socketId).emit('getFirstCards', cardsInfo);
      }),
    );

    // 남은 덱에서 필드에 쓰일 5장은 redis에 저장해놓음
    let cards = '';
    for (let i = 0; i < 5; i++) {
      const card = deck.pop();
      if (i == 4) {
        cards += card;
      } else {
        cards += card + '/';
      }
    }

    await this.redisClient.hset(roomId, 'cards', cards);
  }

  public afterInit(server: Server): void {
    return this.logger.log('Init');
  }

  public handleDisconnect(@ConnectedSocket() client: Socket): void {
    return this.logger.log(`Client disconnected: ${client.id}`);
  }

  public handleConnection(@ConnectedSocket() client: Socket): void {
    return this.logger.log(`Client connected: ${client.id}`);
  }
}
