import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from 'nestjs-redis';
import { GameService } from './game.service';

class MockRedis {}

describe('GameService', () => {
  let service: GameService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        {
          provide: RedisService,
          useClass: MockRedis,
        },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
