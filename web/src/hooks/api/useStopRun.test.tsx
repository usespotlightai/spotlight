import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStopInFlight, useStopRun } from '@/hooks/api/useStopRun';

const stopRun = vi.fn();

vi.mock('@/lib/api', () => ({
  stopRun: (...args: unknown[]) => stopRun(...args),
}));

const setUp = (runId: string) => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return renderHook(
    () => ({ stop: useStopRun(), inFlight: useStopInFlight(runId) }),
    { wrapper },
  ).result;
};

describe('useStopInFlight', () => {
  beforeEach(() => {
    stopRun.mockReset();
  });

  it('knows a stop is on its way as soon as it is asked', async () => {
    stopRun.mockReturnValue(new Promise(() => {}));
    const result = setUp('run_1');

    act(() => result.current.stop.mutate({ teamId: 'team_1', runId: 'run_1' }));

    await waitFor(() => expect(result.current.inFlight).toBe(true));
  });

  it('forgets the stop once the server refused it', async () => {
    stopRun.mockRejectedValue(new Error('refused'));
    const result = setUp('run_1');

    act(() => result.current.stop.mutate({ teamId: 'team_1', runId: 'run_1' }));

    await waitFor(() => expect(result.current.stop.isError).toBe(true));
    expect(result.current.inFlight).toBe(false);
  });

  it('leaves the other runs out of a stop', async () => {
    stopRun.mockReturnValue(new Promise(() => {}));
    const result = setUp('run_2');

    act(() => result.current.stop.mutate({ teamId: 'team_1', runId: 'run_1' }));

    await waitFor(() => expect(result.current.stop.isPending).toBe(true));
    expect(result.current.inFlight).toBe(false);
  });
});
