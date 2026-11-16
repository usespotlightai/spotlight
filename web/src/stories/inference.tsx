import type { Decorator } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';

import { inferenceEndpointKeys } from '@/hooks/api/useInferenceEndpoint';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import { SLUG, WORKSPACE } from '@/mocks/world';

export const inWorkspace =
  (inference: 'set' | 'unset'): Decorator =>
  (Story) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    client.setQueryData(workspaceKeys.detail(SLUG), WORKSPACE);

    if (inference === 'unset') {
      client.setQueryData(
        inferenceEndpointKeys.forWorkspace(WORKSPACE.id),
        null,
      );
    }

    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/${SLUG}`]}>
          <Routes>
            <Route
              path="/:slug"
              element={
                <div className="max-w-md p-4">
                  <Story />
                </div>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
