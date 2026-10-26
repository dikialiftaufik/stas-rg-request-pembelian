import type { AuthProvider } from '@refinedev/core';
import { currentUser, loginDemo, logoutDemo } from '../demo/store';

export type DemoLoginValues = { email: string; password: string };
export const demoAuthProvider: AuthProvider = {
  login: ({ email, password }: DemoLoginValues) =>
    Promise.resolve(
      loginDemo(email, password)
        ? { success: true, redirectTo: '/dashboard' }
        : { success: false, error: { name: 'Login gagal', message: 'Email atau password salah.' } },
    ),
  logout: () => {
    logoutDemo();
    return Promise.resolve({ success: true, redirectTo: '/' });
  },
  check: () => Promise.resolve({ authenticated: Boolean(currentUser()), redirectTo: '/' }),
  getIdentity: () => Promise.resolve(currentUser()),
  getPermissions: () => Promise.resolve(currentUser()?.role ?? null),
  onError: () => Promise.resolve({}),
};
