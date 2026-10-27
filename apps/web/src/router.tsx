import type { ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { AppProviders } from './providers';
export function createAppRouter(children: ReactNode) {
  return createBrowserRouter([{ path: '*', element: <AppProviders>{children}</AppProviders> }]);
}
