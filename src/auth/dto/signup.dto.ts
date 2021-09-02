import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SignUpDto {
  @ApiProperty({
    example: 'kim1234',
    description: 'username',
    required: true,
  })
  @IsString()
  readonly username: string;

  @ApiProperty({
    example: 'mypassword',
    description: 'password',
    required: true,
  })
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  readonly password: string;

  @ApiProperty({
    example: 'spiderman',
    description: 'nickname',
    required: true,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  readonly nickname: string;
}
