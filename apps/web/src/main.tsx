import logoUrl from '../../../assets/img/logo-stas-rg.png';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource/jetbrains-mono/400.css';
import './styles/globals.css';
import { App } from './App';
import { AppProviders } from './providers';
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
  createRoot(root).render(
    <StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </StrictMode>,
  );
}

void bootstrap();
