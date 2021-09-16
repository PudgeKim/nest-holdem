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
import { userInfo } from 'os';

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
    client.emit('getUsersInfo', usersInfo);
  }

  checkUserExist(users: string, newUser: string): boolean {
    const userArr = users.split('/');
    if (userArr.includes(newUser)) return true;
    return false;
  }

  async getUsersInfo(users: string): Promise<PublicUser[]> {
    const userArr = users.split('/');
    const usersInfo: PublicUser[] = [];

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

  // test docker
  // @SubscribeMessage('leaveRoom')
  // public leaveRoom(
  //   @MessageBody() room: string,
  //   @ConnectedSocket() client: Socket,
  // ): void {
  //   client.leave(room);
  //   client.emit('leftRoom', room);
  // }

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
