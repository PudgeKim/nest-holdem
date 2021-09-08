import { Injectable } from '@nestjs/common';
import { RedisService } from 'nestjs-redis';
import { CreateRoomDto } from './dto/create-room.dto';
import { v4 } from 'uuid';

@Injectable()
export class GameService {
  constructor(private readonly redisServce: RedisService) {}

  async createRoom(createRoomDto: CreateRoomDto) {
    const { id, nickname } = createRoomDto;
    //const roomId: string = v4();
    const roomId = 'testroomkey';
    const client = await this.redisServce.getClient();
    client.hmset(roomId, id, 1);

    client.hgetall(roomId, (err, val) => {
      console.log('val: ', val);
    });
  }

  async getAllRooms() {
    const redisClient = await this.redisServce.getClient();
    console.log(redisClient);
  }
}
