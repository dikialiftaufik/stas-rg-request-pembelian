import type { AuthProvider } from '@refinedev/core';
import { ApiError } from '@/lib/api-client';
import {
  clearAuthenticatedUserSession,
  currentUser,
  loginDemo,
  setAuthenticatedUserSession,
  syncRequestsFromServer,
  syncResearchTypesFromServer,
  syncUsersFromServer,
} from '../demo/store';
import type { DemoUser } from '../demo/model';
import {
  fetchCurrentSessionApi,
  fetchResearchTypesApi,
  loginUserApi,
  logoutUserApi,
} from '../research-types/api';
import { fetchRequestsApi } from '../requests/api';
import { fetchUsersApi } from '../users/api';

export type DemoLoginValues = {
  identifier?: string;
  email?: string;
  password: string;
};

let bootstrapPromise: Promise<void> | null = null;
let bootstrapCompleted = false;

async function hydrateWorkspaceForUser(user: DemoUser): Promise<void> {
  const [researchList, usersList, requestsBundle] = await Promise.all([
    fetchResearchTypesApi().catch(() => null),
    user.role === 'admin' ? fetchUsersApi().catch(() => null) : Promise.resolve(null),
    fetchRequestsApi().catch(() => null),
  ]);
  if (researchList) {
    syncResearchTypesFromServer(researchList.data);
  }
  if (usersList) {
    syncUsersFromServer(usersList.data);
  }
  if (requestsBundle) {
    syncRequestsFromServer(requestsBundle);
  }
}

export function isAuthBootstrapped(): boolean {
  return bootstrapCompleted;
}

export function ensureAuthBootstrapped(): Promise<void> {
  if (bootstrapCompleted) {
    return Promise.resolve();
  }
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      try {
        const user = await fetchCurrentSessionApi();
        await hydrateWorkspaceForUser(user);
        setAuthenticatedUserSession(user);
      } catch {
        if (!currentUser()) {
          clearAuthenticatedUserSession();
        }
      } finally {
        bootstrapCompleted = true;
      }
    })();
  }
  return bootstrapPromise;
}

export const demoAuthProvider: AuthProvider = {
  login: async ({ identifier, email, password }: DemoLoginValues) => {
    const credential = (identifier ?? email ?? '').trim();
    try {
      const user = await loginUserApi(credential, password);
      await hydrateWorkspaceForUser(user);
      setAuthenticatedUserSession(user);
      bootstrapCompleted = true;

      return { success: true, redirectTo: '/dashboard' };
    } catch (error) {
      // Jika server backend offline / 502 Bad Gateway, gunakan fallback login demo lokal
      if (
        (error instanceof ApiError &&
          (error.status === 502 || error.status === 503 || error.status === 504 || error.status === 0)) ||
        !(error instanceof ApiError)
      ) {
        if (loginDemo(credential.toLowerCase(), password)) {
          const user = currentUser();
          if (user) {
            setAuthenticatedUserSession(user);
            bootstrapCompleted = true;
            return { success: true, redirectTo: '/dashboard' };
          }
        }
      }

      const message = error instanceof ApiError ? error.message : 'ID/email atau password salah.';
      return {
        success: false,
        error: { name: 'Login gagal', message },
      };
    }
  },
  logout: async () => {
    try {
      await logoutUserApi();
    } catch {
      /* Tetap bersihkan sesi lokal meskipun jaringan terputus. */
    }
    clearAuthenticatedUserSession();
    return { success: true, redirectTo: '/' };
  },
  check: async () => {
    await ensureAuthBootstrapped();
    return { authenticated: Boolean(currentUser()), redirectTo: '/' };
  },
  getIdentity: () => Promise.resolve(currentUser()),
  getPermissions: () => Promise.resolve(currentUser()?.role ?? null),
  onError: () => Promise.resolve({}),
};
