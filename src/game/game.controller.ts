import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto';
import { GameService } from './game.service';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post('create-room')
  async createRoom(@Body() createRoomDto: CreateRoomDto) {
    return this.gameService.createRoom(createRoomDto);
  }

  @Get('redis-test')
  async getRedisClient() {
    return this.gameService.getAllRooms();
  }
}
