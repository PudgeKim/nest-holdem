import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GameService } from './game/game.service';
import { GameGateway } from './game/game.gateway';
import { RedisModule } from 'nestjs-redis';
import { GameController } from './game/game.controller';
import { ConfigModule } from '@nestjs/config';
import { GameModule } from './game/game.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot(),
    RedisModule.register({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
    }),
    AuthModule,
    UsersModule,
    GameModule,
  ],
  controllers: [AppController, GameController],
  providers: [AppService, GameService, GameGateway],
})
export class AppModule {}
