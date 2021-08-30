import { Res, Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { Response } from 'express';
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
  async signIn(@Res() res: Response, @Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto, res);
  }

  @UseGuards(JwtAuthGuard)
  @Get('hello')
  hello() {
    return 'hello';
  }
}
