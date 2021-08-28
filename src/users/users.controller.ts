import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get(':id')
  async getUserById(id: number): Promise<PublicUser> {
    return this.usersService.getUserById(id);
  }
}
