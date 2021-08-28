import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { SignInDto } from 'src/users/dto/signin.dto';
import { SignUpDto } from 'src/users/dto/signup.dto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  async signUp(@Body() signUpDto: SignUpDto): Promise<PublicUser> {
    return this.authService.signUp(signUpDto);
  }

  @Post('signin')
  async signIn(@Body() signInDto: SignInDto): Promise<UserWithToken> {
    return this.authService.signIn(signInDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('hello')
  hello() {
    return 'hello';
  }
}
