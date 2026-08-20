import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useGreeting } from '@/hooks/api/use-greeting';
import { client } from '@/lib/api/client.gen';

beforeAll(() => {
  client.setConfig({ baseUrl: 'http://localhost/api' });
});

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const mockFetch = (status: number, body: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  );

const requestedUrl = () => {
  const [input] = vi.mocked(fetch).mock.calls[0];
  return new URL(typeof input === 'string' ? input : (input as Request).url);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useGreeting', () => {
  it('returns the greeting from the generated client', async () => {
    mockFetch(200, { message: 'Hello World!' });

    const { result } = renderHook(() => useGreeting(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ message: 'Hello World!' });
  });

  it('requests the API under the /api base path', async () => {
    mockFetch(200, { message: 'Hello World!' });

    const { result } = renderHook(() => useGreeting(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestedUrl().pathname).toBe('/api/');
  });

  it('surfaces a failed response as a query error', async () => {
    mockFetch(500, { message: 'boom' });

    const { result } = renderHook(() => useGreeting(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
