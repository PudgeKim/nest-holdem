import { PickType } from '@nestjs/mapped-types';
import { SignUpDto } from './signup.dto';

export class SignInDto extends PickType(SignUpDto, ['username', 'password']) {}
