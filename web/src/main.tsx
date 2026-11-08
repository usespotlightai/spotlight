import { reactErrorHandler } from '@sentry/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { Toaster } from '@/components/ui/toast';
import { storedTheme } from '@/hooks/useTheme';
import { client } from '@/lib/api/client.gen';
import { desktopApp, frameWindow } from '@/lib/desktop';
import {
  startErrorReporting,
  withGatewayErrorReported,
} from '@/lib/error-reporting';
import { failuresToasted } from '@/lib/failure-toasts';
import { refuseStrayFileDrops } from '@/lib/file-drops';
import { retryQuery } from '@/lib/query-retry';
import { withSentRequest } from '@/lib/request-failure';
import { reloadOnStaleBuild } from '@/lib/stale-build';
import App from './App.tsx';
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
    queries: { staleTime: 30_000, retry: retryQuery },
  },
});

const render = () =>
  createRoot(root, {
    onUncaughtError: reactErrorHandler(),
    onRecoverableError: reactErrorHandler(),
  }).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <Toaster>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </Toaster>
      </QueryClientProvider>
    </StrictMode>,
  );

const REPORTING_WAIT_MS = 1000;

Promise.race([
  startErrorReporting().catch(() => undefined),
  new Promise((resolve) => setTimeout(resolve, REPORTING_WAIT_MS)),
]).finally(render);
