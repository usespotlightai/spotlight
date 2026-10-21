import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRunRefresh } from '@/hooks/api/useRunRefresh';

const stream = vi.fn();

vi.mock('@/hooks/api/useRunStream', () => ({
  useRunStream: (...args: unknown[]) => stream(...args),
}));

const follows = (
  following: Parameters<typeof useRunRefresh>[0]['following'],
) => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  renderHook(
    () =>
      useRunRefresh({
        teamId: 'team_1',
        runId: 'run_1',
        taskId: 'task_1',
        state: 'completed',
        activity: null,
        following,
      }),
    { wrapper },
  );

  return stream.mock.calls.at(-1)?.slice(0, 2);
};

describe('useRunRefresh', () => {
  beforeEach(() => {
    stream.mockReset();
  });

  it('follows the newest run while it works', () => {
    expect(
      follows({ id: 'run_2', state: 'claimed', activity: 'working' }),
    ).toEqual(['run_2', true]);
  });

  it('follows a run stopped while it waited for a person, so the end shows', () => {
    expect(
      follows({ id: 'run_2', state: 'waiting', activity: 'stopping' }),
    ).toEqual(['run_2', true]);
  });

  it('stops following a run that does nothing', () => {
    expect(follows({ id: 'run_2', state: 'waiting', activity: null })).toEqual([
      'run_2',
      false,
    ]);
  });
});
