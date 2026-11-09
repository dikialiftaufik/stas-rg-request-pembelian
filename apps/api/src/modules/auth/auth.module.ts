import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtCookieAuthGuard } from '../../common/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { ApiEnv } from '../../config/env.schema';
import { AuthController, SessionAuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<ApiEnv, true>) => ({
        secret: configService.get('JWT_SECRET', { infer: true }),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN_SECONDS', { infer: true }),
        },
      }),
    }),
  ],
  controllers: [SessionAuthController, AuthController],
  providers: [AuthService, JwtCookieAuthGuard, RolesGuard],
  exports: [AuthService, JwtModule, JwtCookieAuthGuard, RolesGuard],
})
export class AuthModule {}
