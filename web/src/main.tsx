import { reactErrorHandler } from '@sentry/react';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { storedTheme } from '@/hooks/useTheme';
import { client } from '@/lib/api/client.gen';
import { desktopApp, frameWindow } from '@/lib/desktop';
import {
  startErrorReporting,
  withGatewayErrorReported,
} from '@/lib/error-reporting';
import { failuresToasted } from '@/lib/failure-toasts';
import { refuseStrayFileDrops } from '@/lib/file-drops';
import { setFresh, STALE_MS } from '@/lib/live';
import { LIVE_SEQUENCES_KEY } from '@/lib/live-sequences';
import {
  CACHE_MAX_AGE_MS,
  persistOptions,
  storedJournals,
} from '@/lib/query-cache';
import { retryQuery } from '@/lib/query-retry';
import { withSentRequest } from '@/lib/request-failure';
import { keepAppShell } from '@/lib/service-worker';
import { reloadOnStaleBuild } from '@/lib/stale-build';

import App from './App.tsx';
import { preloadVisiblePages } from './visible-pages.ts';

import './index.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

reloadOnStaleBuild();
refuseStrayFileDrops();
frameWindow();
desktopApp()?.setTheme?.(storedTheme());

client.interceptors.error.use(withSentRequest);
client.interceptors.error.use(withGatewayErrorReported);

const queryClient = new QueryClient({
  mutationCache: failuresToasted(),
  defaultOptions: {
    queries: {
      staleTime: STALE_MS,
      gcTime: CACHE_MAX_AGE_MS,
      retry: retryQuery,
    },
  },
});

const render = () =>
  createRoot(root, {
    onUncaughtError: reactErrorHandler(),
    onRecoverableError: reactErrorHandler(),
  }).render(
    <StrictMode>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions(import.meta.env.VITE_API_SHAPE)}
        onSuccess={() =>
          setFresh(queryClient.getQueryData(LIVE_SEQUENCES_KEY) !== undefined)
        }
      >
        <Toaster>
          <TooltipProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </TooltipProvider>
        </Toaster>
      </PersistQueryClientProvider>
    </StrictMode>,
  );

const FIRST_RENDER_WAIT_MS = 1000;

void Promise.race([
  Promise.all([
    startErrorReporting().catch(() => undefined),
    preloadVisiblePages(window.location.pathname),
  ]),
  new Promise((resolve) => setTimeout(resolve, FIRST_RENDER_WAIT_MS)),
]).finally(() => {
  render();
  void storedJournals.prune();
  if (import.meta.env.PROD) {
    keepAppShell();
  }
});
