import logoUrl from '../../../assets/img/logo-stas-rg.png';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource/jetbrains-mono/400.css';
import './styles/globals.css';
import { App } from './App';
import { createAppRouter } from './router';
import { RouterProvider } from 'react-router';
import { clientEnvironment } from './lib/environment';

async function bootstrap() {
  if (import.meta.env.DEV && clientEnvironment.enableMocks) {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledFrame: 'bypass' });
  }

  const root = document.getElementById('root');
  if (!root) throw new Error('Elemen root frontend tidak ditemukan.');
  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (favicon) favicon.href = logoUrl;

  const router = createAppRouter(<App />);
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

void bootstrap();
