import { Module } from '@nestjs/common';
import { UsersModule } from 'src/users/users.module';
import { GameController } from './game.controller';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';

@Module({
  imports: [UsersModule],
  controllers: [GameController],
  providers: [GameService, GameGateway],
})
export class GameModule {}
