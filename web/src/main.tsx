import { reactErrorHandler } from '@sentry/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { Toaster } from '@/components/ui/toast';
import { client } from '@/lib/api/client.gen';
import {
  startErrorReporting,
  withGatewayErrorReported,
} from '@/lib/error-reporting';
import { failuresToasted } from '@/lib/failure-toasts';
import { withSentRequest } from '@/lib/request-failure';
import App from './App.tsx';
import './index.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

client.interceptors.error.use(withSentRequest);
client.interceptors.error.use(withGatewayErrorReported);

const queryClient = new QueryClient({
  mutationCache: failuresToasted(),
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
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
  new Promise((settled) => setTimeout(settled, REPORTING_WAIT_MS)),
]).finally(render);
