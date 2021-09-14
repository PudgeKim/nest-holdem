import { EntityRepository, Repository } from 'typeorm';
import { SignUpDto } from './dto/signup.dto';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';

@EntityRepository(User)
export class UserRepo extends Repository<User> {
  async signUp(signUpDto: SignUpDto): Promise<PublicUser> {
    const { username, password, nickname } = signUpDto;

    const duplicateUser: User = await this.findOne({ username });
    if (duplicateUser) {
      throw new ConflictException('username already exists');
    }

    const duplicateNickname: User = await this.findOne({ nickname });
    if (duplicateNickname) {
      throw new ConflictException('nickname already exists');
    }

    const salt = await bcrypt.genSalt();
    const hashedPW = await bcrypt.hash(password, salt);

    const newUser: User = this.create({
      username,
      nickname,
      password: hashedPW,
      money: 10000000,
    });

    try {
      const savedUser: User = await this.save(newUser);
      return {
        id: savedUser.id,
        nickname: savedUser.nickname,
        money: savedUser.money,
      };
    } catch (error) {
      throw new InternalServerErrorException();
    }
  }

  async getUserById(id: number): Promise<PublicUser> {
    try {
      const user: User = await this.findOne(id);
      if (!user) {
        throw new BadRequestException(`'user does not exists (userId: ${id})'`);
      }

      return {
        id: user.id,
        nickname: user.nickname,
        money: user.money,
      };
    } catch (error) {
      throw new InternalServerErrorException();
    }
  }
}
