import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { rejects } from 'assert';
import { sign } from 'crypto';
import { SignUpDto } from 'src/users/dto/signup.dto';
import { User } from 'src/users/user.entity';
import { AuthService } from './auth.service';

class JwtSericeMock {}
const MockUserRepository = {
  signUp: jest
    .fn()
    .mockImplementation((signUpDto: SignUpDto): Promise<PublicUser> => {
      const duplicateUser = 'spiderman';
      const duplicateNickname = 'batman';
      const { username, password, nickname } = signUpDto;

      if (username == duplicateUser)
        throw new ConflictException('username already exists');
      if (nickname == duplicateNickname)
        throw new ConflictException('nickname already exists');

      const publicUser: PublicUser = {
        id: 1,
        nickname: nickname,
      };

      return Promise.resolve(publicUser);
    }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: MockUserRepository,
        },
        {
          provide: JwtService,
          useClass: JwtSericeMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be a function', () => {
    expect(typeof service.signUp).toBe('function');
  });

  it('should create a new user and return publicUser type', async () => {
    const signUpDto: SignUpDto = {
      username: 'kim1234',
      nickname: 'sonny',
      password: 'mypassword',
    };
    expect(await service.signUp(signUpDto)).toEqual({
      id: 1,
      nickname: 'sonny',
    });
  });

  it('should return an error because of duplicate username', async () => {
    const signUpDto: SignUpDto = {
      username: 'spiderman',
      nickname: 'sonny',
      password: 'mypassword',
    };
    await expect(service.signUp(signUpDto)).rejects.toThrow(
      new ConflictException('username already exists'),
    );
  });

  it('should return an error because of duplicate nickname', async () => {
    const signUpDto: SignUpDto = {
      username: 'kim1234',
      nickname: 'batman',
      password: 'mypassword',
    };
    await expect(service.signUp(signUpDto)).rejects.toThrow(
      new ConflictException('nickname already exists'),
    );
  });
});
