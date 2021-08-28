import { IsString, MaxLength, MinLength } from 'class-validator';

export class SignUpDto {
  @IsString()
  readonly username: string;

  @IsString()
  @MinLength(6)
  @MaxLength(32)
  readonly password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(20)
  readonly nickname: string;
}
