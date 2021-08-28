import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SignInDto } from 'src/users/dto/signin.dto';
import { User } from 'src/users/user.entity';
import { UserRepository } from 'src/users/users.repository';
import * as bcrypt from 'bcrypt';
import { SignUpDto } from 'src/users/dto/signup.dto';

@Injectable()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
  ) {}

  async signUp(signUpDto: SignUpDto): Promise<PublicUser> {
    return this.userRepository.signUp(signUpDto);
  }

  async signIn(signInDto: SignInDto): Promise<UserWithToken> {
    const { username, password } = signInDto;

    const user: User = await this.userRepository.findOne({ username });
    if (!user) {
      throw new UnauthorizedException('username does not exist');
    }

    const checkPW: boolean = await bcrypt.compare(password, user.password);
    if (!checkPW) {
      throw new UnauthorizedException('password is wrong');
    }

    const payload = { id: user.id, nickname: user.nickname };
    const accessToken = this.jwtService.sign(payload);
    return {
      id: user.id,
      nickname: user.nickname,
      accessToken: accessToken,
    };
  }
}
