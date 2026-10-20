import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStopRun, useStopsAsked } from '@/hooks/api/useStopRun';
import type { TeamRun } from '@/lib/run';

const stopRun = vi.fn();

vi.mock('@/lib/api', () => ({
  stopRun: (...args: unknown[]) => stopRun(...args),
}));

const working = { id: 'run_1', state: 'claimed' } as TeamRun;

const setUp = () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return renderHook(() => ({ stop: useStopRun(), asked: useStopsAsked() }), {
    wrapper,
  }).result;
};

describe('useStopsAsked', () => {
  beforeEach(() => {
    stopRun.mockReset();
  });

  it('shows the run as stopped as soon as a stop is asked', async () => {
    stopRun.mockReturnValue(new Promise(() => {}));
    const result = setUp();

    act(() => result.current.stop.mutate({ teamId: 'team_1', runId: 'run_1' }));

    await waitFor(() =>
      expect(result.current.asked(working).state).toBe('cancelled'),
    );
  });

  it('leaves the run as it is once the stop was refused', async () => {
    stopRun.mockRejectedValue(new Error('refused'));
    const result = setUp();

    act(() => result.current.stop.mutate({ teamId: 'team_1', runId: 'run_1' }));

    await waitFor(() => expect(result.current.stop.isError).toBe(true));
    expect(result.current.asked(working).state).toBe('claimed');
  });

  it('leaves the other runs as they are', () => {
    const result = setUp();

    expect(result.current.asked(working)).toBe(working);
  });
});
