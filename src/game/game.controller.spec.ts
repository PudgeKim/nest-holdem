import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from 'nestjs-redis';
import { GameController } from './game.controller';
import { GameService } from './game.service';

class MockRedis {}

describe('GameController', () => {
  let controller: GameController;
  let gameService: GameService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GameController],
      providers: [
        GameService,
        {
          provide: RedisService,
          useClass: MockRedis,
        },
      ],
    }).compile();

    controller = module.get<GameController>(GameController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
