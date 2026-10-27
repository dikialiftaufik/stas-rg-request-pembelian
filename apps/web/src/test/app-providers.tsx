import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { RouterProvider } from 'react-router';
import { createAppRouter } from '../router';
export function AppProviders({ children }: PropsWithChildren) {
  const [router] = useState(() => createAppRouter(children));
  useEffect(() => () => router.dispose(), [router]);
  return <RouterProvider router={router} />;
}
