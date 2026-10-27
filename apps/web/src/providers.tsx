import { useSyncExternalStore } from 'react';
import type { PropsWithChildren } from 'react';
import { Refine } from '@refinedev/core';
import routerBindings from '@refinedev/react-router';
import simpleRestProvider from '@refinedev/simple-rest';
import { Toaster } from 'sonner';
import { clientEnvironment } from './lib/environment';
import { demoAuthProvider } from './features/auth/demo-auth-provider';

const dataProvider = simpleRestProvider(clientEnvironment.apiBaseUrl);

const mobileQuery = '(max-width: 639px)';
function subscribeMobile(listener: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
function mobileSnapshot() {
  return window.matchMedia(mobileQuery).matches;
}

export function AppProviders({ children }: PropsWithChildren) {
  const mobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, () => false);
  return (
    <>
      <Refine
        dataProvider={dataProvider}
        authProvider={demoAuthProvider}
        routerProvider={routerBindings}
        options={{
          disableTelemetry: true,
          syncWithLocation: true,
          reactQuery: {
            clientConfig: {
              defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
            },
          },
        }}
      >
        {children}
        <Toaster
          closeButton
          duration={4000}
          position={mobile ? 'bottom-center' : 'top-right'}
          toastOptions={{ style: { fontFamily: 'var(--font-sans)' } }}
        />
      </Refine>
    </>
  );
}
