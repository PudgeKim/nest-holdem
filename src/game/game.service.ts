import { Injectable } from '@nestjs/common';
import { RedisService } from 'nestjs-redis';
import { CreateRoomDto } from './dto/create-room.dto';
import { v4 } from 'uuid';

@Injectable()
export class GameService {
  client: any;
  constructor(private readonly redisServce: RedisService) {
    this.client = redisServce.getClient();
  }

  async createRoom(createRoomDto: CreateRoomDto) {
    const { userId, nickname, roomName } = createRoomDto;
    const roomId: string = v4();

    // playerOrder = 참가자들 게임 순서 (participantCnt로 나머지 연산해서 차례 구함)
    // sb = small blind index
    // bb = big blind index
    await this.client.hmset(
      roomId,
      'host',
      nickname,
      'roomName',
      roomName,
      'users',
      '',
      'participatedUsers',
      '',
      'participantCnt',
      0,
      'playerOrder',
      0,
      'sb',
      0,
      'bb',
      1,
    );

    return {
      roomId,
      userId,
      nickname,
      roomName,
    };
  }

  async getAllRooms() {
    const allRoomKeys: string[] = await this.client.keys('*');
    console.log('gameService getAllRooms allKeys:', allRoomKeys); ///////
    const allRooms = [];

    for (let i = 0; i < allRoomKeys.length; i++) {
      // sockets key는 socketId
      if (allRoomKeys[i] == 'sockets') continue;

      const roomId = allRoomKeys[i];
      const roomName = await this.client.hget(roomId, 'roomName');
      const hostNickname = await this.client.hget(allRoomKeys[i], 'host');
      allRooms.push({
        roomId: roomId,
        roomName: roomName,
        host: hostNickname,
      });
    }
    console.log('gameService getAllRooms: ', allRooms);
    return {
      allRooms: allRooms,
    };
  }
}
