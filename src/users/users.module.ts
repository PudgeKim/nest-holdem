import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserRepo } from './users.repository';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserRepo])],
  controllers: [UsersController],
  providers: [UsersService, UserRepo],
  exports: [TypeOrmModule],
})
export class UsersModule {}
