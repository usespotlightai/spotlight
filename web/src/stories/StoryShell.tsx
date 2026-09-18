import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { MemoryRouter, Routes } from 'react-router';

type StoryShellProps = {
  at: string;
  seed?: (client: QueryClient) => void;
  children: ReactNode;
};

export function StoryShell({ at, seed, children }: StoryShellProps) {
  const [client] = useState(() => {
    const made = new QueryClient({
      defaultOptions: {
        queries: { staleTime: Number.POSITIVE_INFINITY, retry: false },
      },
    });
    seed?.(made);
    return made;
  });

  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>{children}</Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
