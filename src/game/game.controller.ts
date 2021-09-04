import { Controller, Get } from '@nestjs/common';
import { GameService } from './game.service';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}
  @Get('redis-test')
  async getRedisClient() {
    return this.gameService.getAllRooms();
  }
}
