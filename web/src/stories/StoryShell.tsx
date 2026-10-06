import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { type Location, MemoryRouter, Routes } from 'react-router';
import { Toaster } from '@/components/ui/toast';
import { failuresToasted } from '@/lib/failure-toasts';

type StoryShellProps = {
  at: string | Partial<Location>;
  seed?: (client: QueryClient) => void;
  children: ReactNode;
};

export function StoryShell({ at, seed, children }: StoryShellProps) {
  const [client] = useState(() => {
    const made = new QueryClient({
      mutationCache: failuresToasted(),
      defaultOptions: {
        queries: { staleTime: Number.POSITIVE_INFINITY, retry: false },
      },
    });
    seed?.(made);
    return made;
  });

  return (
    <QueryClientProvider client={client}>
      <Toaster>
        <MemoryRouter initialEntries={[at]}>
          <Routes>{children}</Routes>
        </MemoryRouter>
      </Toaster>
    </QueryClientProvider>
  );
}
