import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SignInDto } from 'src/users/dto/signin.dto';
import { SignUpDto } from 'src/users/dto/signup.dto';
import { User } from 'src/users/user.entity';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';
import * as httpMocks from 'node-mocks-http';

class JwtSericeMock {
  sign() {
    return 'xxx.yyy.zzz';
  }
}
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

  // 원래 findOne에서 where구문을 넣을 때 { username } 형태로 인자를 주어서
  // usernameObj로 하였음
  findOne: jest.fn().mockImplementation(async (usernameObj) => {
    const username = usernameObj.username;
    const storedUsername = 'kim1234';
    const storedPassword = 'mypassword';
    const salt = await bcrypt.genSalt();
    const hashedPW = await bcrypt.hash(storedPassword, salt);

    if (username !== storedUsername) {
      return undefined;
    }

    return {
      id: 1,
      username: storedUsername,
      password: hashedPW,
      nickname: 'sonny',
    };
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
  // signUp
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

  // signIn
  it('should success', async () => {
    const res = httpMocks.createResponse();
    const signInDto: SignInDto = {
      username: 'kim1234',
      password: 'mypassword',
    };
    await service.signIn(signInDto, res);

    expect(res._getData()).toStrictEqual({
      success: true,
      id: 1,
      nickname: 'sonny',
    });
  });

  it('should return an error because of non existent nickname', async () => {
    const res = httpMocks.createResponse();
    const signInDto: SignInDto = {
      username: 'noname',
      password: 'mypassword',
    };
    await expect(service.signIn(signInDto, res)).rejects.toThrow(
      new UnauthorizedException('username does not exist'),
    );
  });

  it('should return an error because of wrong password', async () => {
    const res = httpMocks.createResponse();
    const signInDto: SignInDto = {
      username: 'kim1234',
      password: 'wrongpassword',
    };
    await expect(service.signIn(signInDto, res)).rejects.toThrow(
      new UnauthorizedException('password is wrong'),
    );
  });
});
