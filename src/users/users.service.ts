import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserRepo } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserRepo)
    private userRepository: UserRepo,
  ) {}

  async getUserById(id: number): Promise<PublicUser> {
    return this.userRepository.getUserById(id);
  }
}
