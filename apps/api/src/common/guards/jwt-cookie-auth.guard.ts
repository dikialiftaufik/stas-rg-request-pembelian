import { CanActivate, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { ApiEnv } from '../../config/env.schema';
import type { AuthenticatedUser, JwtAccessPayload } from '../../modules/auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';

@Injectable()
export class JwtCookieAuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService<ApiEnv, true>,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookieName = this.configService.get('AUTH_COOKIE_NAME', { infer: true });
    const rawCookies = request.cookies as Record<string, unknown> | undefined;
    const token = rawCookies?.[cookieName];

    if (typeof token !== 'string' || token.trim().length === 0) {
      throw new UnauthorizedException('Sesi tidak ditemukan. Silakan login terlebih dahulu.');
    }

    let payload: JwtAccessPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token);
    } catch {
      throw new UnauthorizedException('Sesi tidak valid atau telah berakhir. Silakan login ulang.');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Payload sesi tidak valid.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Akun tidak ditemukan atau sudah dinonaktifkan.');
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      name: user.name,
      identifier: user.identifier,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };

    request.user = authenticatedUser;
    return true;
  }
}
