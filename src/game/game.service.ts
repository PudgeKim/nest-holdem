import { Injectable } from '@nestjs/common';
import { RedisService } from 'nestjs-redis';

@Injectable()
export class GameService {
  constructor(private readonly redisServce: RedisService) {}
  async getAllRooms() {
    const redisClient = await this.redisServce.getClient();
    console.log(redisClient);
  }
}
