import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStopRun } from '@/hooks/api/useStopRun';
import { useRunActivity } from '@/hooks/useRunActivity';
import type { ReportedActivity } from '@/lib/run';

const stopRun = vi.fn();

vi.mock('@/lib/api', () => ({
  stopRun: (...args: unknown[]) => stopRun(...args),
}));

const setUp = (activity: ReportedActivity | null) => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return renderHook(
    () => ({
      stop: useStopRun(),
      activity: useRunActivity('run_1', activity),
    }),
    { wrapper },
  ).result;
};

describe('useRunActivity', () => {
  beforeEach(() => {
    stopRun.mockReset();
  });

  it('is stopping while the stop is on its way', async () => {
    stopRun.mockReturnValue(new Promise(() => {}));
    const result = setUp('working');

    act(() => result.current.stop.mutate({ teamId: 'team_1', runId: 'run_1' }));

    await waitFor(() => expect(result.current.activity).toBe('stopping'));
  });

  it('keeps what the server says while nobody asked to stop', () => {
    expect(setUp('working').current.activity).toBe('working');
    expect(setUp('stopping').current.activity).toBe('stopping');
    expect(setUp(null).current.activity).toBeNull();
  });
});
