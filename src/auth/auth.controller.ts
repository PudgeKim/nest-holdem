import {
  Res,
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { SignInDto } from 'src/users/dto/signin.dto';
import { SignUpDto } from 'src/users/dto/signup.dto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiResponse({ status: 201, description: 'success' })
  @ApiResponse({ status: 409, description: 'nickname already exists' })
  @ApiResponse({ status: 409, description: 'username already exists' })
  @ApiResponse({
    status: 400,
    description: 'nickname must be longer than or equal to 2 characters',
  })
  @ApiResponse({
    status: 400,
    description: 'password must be longer than or equal to 6 characters',
  })
  @Post('signup')
  async signUp(@Body() signUpDto: SignUpDto): Promise<PublicUser> {
    return this.authService.signUp(signUpDto);
  }

  @ApiResponse({ status: 201, description: 'success' })
  @ApiResponse({ status: 401, description: 'username does not exist' })
  @ApiResponse({ status: 401, description: 'password is wrong' })
  @Post('signin')
  async signIn(@Res() res: Response, @Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto, res);
  }

  @Get('signout')
  signOut(@Req() req: Request, @Res() res: Response) {
    return this.authService.signOut(req, res);
  }

  @UseGuards(JwtAuthGuard)
  @Get('check-login')
  checkLogin(@Req() req: Request) {
    return this.authService.checkLogin(req);
  }

  @UseGuards(JwtAuthGuard)
  @Get('hello')
  hello() {
    return 'hello';
  }
}
