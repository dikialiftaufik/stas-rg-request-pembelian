import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { CookieOptions } from 'express';
import type { ApiEnv } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser, JwtAccessPayload, SessionUser } from './auth.types';
import type { AdminLoginDto } from './dto/admin-login.dto';
import type { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 12;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('stas-rg-timing-mitigation-placeholder', BCRYPT_ROUNDS);

export interface LoginAdminResult {
  accessToken: string;
  user: AuthenticatedUser;
}

export interface LoginSessionResult {
  accessToken: string;
  user: SessionUser;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService: ConfigService<ApiEnv, true>,
  ) {}

  async loginAdmin(dto: AdminLoginDto): Promise<LoginAdminResult> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    const hashToCompare = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const isPasswordValid = await bcrypt.compare(dto.password, hashToCompare);

    if (!user || !isPasswordValid || !user.isActive) {
      throw new UnauthorizedException('Email atau password salah.');
    }

    if (user.role !== 'admin') {
      throw new ForbiddenException('Akses ditolak. Akun ini bukan Admin.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtAccessPayload = {
      sub: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        identifier: updatedUser.identifier,
        email: updatedUser.email,
        role: updatedUser.role,
        createdAt: updatedUser.createdAt.toISOString(),
      },
    };
  }

  /** Login terpadu untuk Admin maupun Pengaju menggunakan email atau NIP/NIM. */
  async login(dto: LoginDto): Promise<LoginSessionResult> {
    const trimmed = dto.identifier.trim();
    const normalizedEmail = trimmed.toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: normalizedEmail, mode: 'insensitive' } },
          { identifier: { equals: trimmed, mode: 'insensitive' } },
        ],
      },
      include: {
        researchAssignments: {
          select: { researchId: true },
          orderBy: { assignedAt: 'asc' },
        },
      },
    });

    const hashToCompare = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const isPasswordValid = await bcrypt.compare(dto.password, hashToCompare);

    if (!user || !isPasswordValid || !user.isActive) {
      throw new UnauthorizedException('ID/email atau password salah.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtAccessPayload = {
      sub: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        identifier: updatedUser.identifier,
        email: updatedUser.email,
        role: updatedUser.role,
        researchIds: user.researchAssignments.map((assignment) => assignment.researchId),
        createdAt: updatedUser.createdAt.toISOString(),
      },
    };
  }

  async getSessionProfile(authenticatedUser: AuthenticatedUser): Promise<SessionUser> {
    const assignments = await this.prisma.userResearchAssignment.findMany({
      where: { userId: authenticatedUser.id },
      select: { researchId: true },
      orderBy: { assignedAt: 'asc' },
    });

    return {
      ...authenticatedUser,
      researchIds: assignments.map((assignment) => assignment.researchId),
    };
  }

  getCookieName(): string {
    return this.configService.get('AUTH_COOKIE_NAME', { infer: true });
  }

  getAuthCookieOptions(): CookieOptions {
    const expiresInSeconds = this.configService.get('JWT_EXPIRES_IN_SECONDS', { infer: true });
    const secure = this.configService.get('COOKIE_SECURE', { infer: true });
    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });

    return {
      httpOnly: true,
      secure: nodeEnv === 'production' ? true : secure,
      sameSite: 'lax',
      path: '/',
      maxAge: expiresInSeconds * 1000,
    };
  }

  getClearCookieOptions(): CookieOptions {
    const secure = this.configService.get('COOKIE_SECURE', { infer: true });
    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });

    return {
      httpOnly: true,
      secure: nodeEnv === 'production' ? true : secure,
      sameSite: 'lax',
      path: '/',
    };
  }
}
