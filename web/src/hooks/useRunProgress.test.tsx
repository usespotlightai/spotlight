import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStopRun } from '@/hooks/api/useStopRun';
import { useRunProgress } from '@/hooks/useRunProgress';
import type { Progress } from '@/lib/run';

const stopRun = vi.fn();

vi.mock('@/lib/api', () => ({
  stopRun: (...args: unknown[]) => stopRun(...args),
}));

const setUp = (progress: Progress | null) => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return renderHook(
    () => ({
      stop: useStopRun(),
      progress: useRunProgress('run_1', progress),
    }),
    { wrapper },
  ).result;
};

describe('useRunProgress', () => {
  beforeEach(() => {
    stopRun.mockReset();
  });

  it('is stopping while the stop is on its way', async () => {
    stopRun.mockReturnValue(new Promise(() => {}));
    const result = setUp('in-progress');

    act(() => result.current.stop.mutate({ teamId: 'team_1', runId: 'run_1' }));

    await waitFor(() => expect(result.current.progress).toBe('stopping'));
  });

  it('keeps what the server says while nobody asked to stop', () => {
    expect(setUp('in-progress').current.progress).toBe('in-progress');
    expect(setUp(null).current.progress).toBeNull();
  });
});
