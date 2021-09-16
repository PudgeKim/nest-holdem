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

    await this.client.hmset(
      roomId,
      'host',
      nickname,
      'roomName',
      roomName,
      'users',
      '',
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
    console.log(allRoomKeys);
    const allRooms = [];

    for (let i = 0; i < allRoomKeys.length; i++) {
      const roomId = allRoomKeys[i];
      const roomName = await this.client.hget(roomId, 'roomName');
      const hostNickname = await this.client.hget(allRoomKeys[i], 'host');
      allRooms.push({
        roomId: roomId,
        roomName: roomName,
        host: hostNickname,
      });
    }

    return {
      allRooms,
    };
  }
}
