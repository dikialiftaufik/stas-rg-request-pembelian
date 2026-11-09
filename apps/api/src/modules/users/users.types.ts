import type { UserRole } from '../auth/auth.types';

/** Representasi akun yang aman dikirim ke klien (tanpa password hash). */
export interface UserAccountItem {
  id: string;
  name: string;
  identifier: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  researchIds: string[];
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserAccountListResponse {
  data: UserAccountItem[];
  meta: {
    total: number;
    summary: {
      totalAdmins: number;
      totalPengaju: number;
      totalInactive: number;
    };
  };
}
