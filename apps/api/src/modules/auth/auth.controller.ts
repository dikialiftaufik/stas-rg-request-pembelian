import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtCookieAuthGuard } from '../../common/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import type { AuthenticatedUser, SessionUser } from './auth.types';
import { adminLoginSchema } from './dto/admin-login.dto';
import type { AdminLoginDto } from './dto/admin-login.dto';
import { loginSchema } from './dto/login.dto';
import type { LoginDto } from './dto/login.dto';

@Controller('auth')
export class SessionAuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ data: { user: SessionUser } }> {
    const { accessToken, user } = await this.authService.login(dto);

    response.cookie(
      this.authService.getCookieName(),
      accessToken,
      this.authService.getAuthCookieOptions(),
    );

    return {
      data: { user },
    };
  }

  @Get('me')
  @UseGuards(JwtCookieAuthGuard)
  async getSession(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: { user: SessionUser } }> {
    return {
      data: { user: await this.authService.getSessionProfile(user) },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) response: Response): { data: { loggedOut: true } } {
    response.setHeader('Clear-Site-Data', '"cookies"');
    response.clearCookie(
      this.authService.getCookieName(),
      this.authService.getClearCookieOptions(),
    );

    return {
      data: { loggedOut: true },
    };
  }
}

@Controller('auth/admin')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async loginAdmin(
    @Body(new ZodValidationPipe(adminLoginSchema)) dto: AdminLoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ data: { user: AuthenticatedUser } }> {
    const { accessToken, user } = await this.authService.loginAdmin(dto);

    response.cookie(
      this.authService.getCookieName(),
      accessToken,
      this.authService.getAuthCookieOptions(),
    );

    return {
      data: { user },
    };
  }

  @Get('me')
  @UseGuards(JwtCookieAuthGuard, RolesGuard)
  @Roles('admin')
  getAdminSession(@CurrentUser() user: AuthenticatedUser): { data: { user: AuthenticatedUser } } {
    return {
      data: { user },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logoutAdmin(@Res({ passthrough: true }) response: Response): { data: { loggedOut: true } } {
    response.setHeader('Clear-Site-Data', '"cookies"');
    response.clearCookie(
      this.authService.getCookieName(),
      this.authService.getClearCookieOptions(),
    );

    return {
      data: { loggedOut: true },
    };
  }
}
