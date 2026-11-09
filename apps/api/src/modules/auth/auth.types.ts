export type UserRole = 'admin' | 'pengaju';

export interface AuthenticatedUser {
  id: string;
  name: string;
  identifier: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface SessionUser extends AuthenticatedUser {
  researchIds: string[];
}

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
