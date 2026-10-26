import type { PropsWithChildren } from 'react';
import { Refine } from '@refinedev/core';
import routerBindings from '@refinedev/react-router';
import simpleRestProvider from '@refinedev/simple-rest';
import { BrowserRouter } from 'react-router';
import { Toaster } from 'sonner';
import { clientEnvironment } from './lib/environment';
import { demoAuthProvider } from './features/auth/demo-auth-provider';

const dataProvider = simpleRestProvider(clientEnvironment.apiBaseUrl);

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <BrowserRouter>
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
        <Toaster richColors position="top-right" />
      </Refine>
    </BrowserRouter>
  );
}
