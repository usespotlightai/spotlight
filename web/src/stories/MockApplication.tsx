import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { type Location, MemoryRouter } from 'react-router';
import App from '@/App';
import { Toaster } from '@/components/ui/toast';
import { failuresToasted } from '@/lib/failure-toasts';
import { OpenPage } from '@/stories/OpenPage';

type MockApplicationProps = {
  at: string | Partial<Location>;
};

export function MockApplication({ at }: MockApplicationProps) {
  const [client] = useState(
    () =>
      new QueryClient({
        mutationCache: failuresToasted(),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <Toaster>
        <MemoryRouter initialEntries={[at]}>
          <OpenPage />
          <App />
        </MemoryRouter>
      </Toaster>
    </QueryClientProvider>
  );
}
