import { IsNumber, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRoomDto {
  @IsNumber()
  userId: number;

  @IsString()
  @MinLength(2)
  @MaxLength(20)
  nickname: string;

  @IsString()
  @MinLength(2)
  @MaxLength(20)
  roomName: string;
}
