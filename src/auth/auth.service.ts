import { Res, Injectable, UnauthorizedException, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SignInDto } from 'src/users/dto/signin.dto';
import { User } from 'src/users/user.entity';
import { UserRepo } from 'src/users/users.repository';
import * as bcrypt from 'bcrypt';
import { SignUpDto } from 'src/users/dto/signup.dto';
import { json, Request, Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserRepo)
    private userRepository: UserRepo,
    private jwtService: JwtService,
  ) {}

  async signUp(signUpDto: SignUpDto): Promise<PublicUser> {
    return this.userRepository.signUp(signUpDto);
  }

  async signIn(signInDto: SignInDto, @Res() res: Response) {
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

    res
      .cookie('accessToken', 'Bearer ' + accessToken, {
        // 1년
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      })
      .send({
        success: true,
        id: user.id,
        nickname: user.nickname,
        money: user.money,
      });
  }

  signOut(@Req() req: Request, @Res() res: Response) {
    const accessToken: string = req.get('Authorization');
    console.log('token: ', accessToken);
    res
      .cookie('accessToken', '', {
        expires: new Date(Date.now()),
      })
      .send({ success: true });
  }

  async checkLogin(@Req() req: Request) {
    // because of guard we already check not logined user
    return { user: req.user };
  }
}
