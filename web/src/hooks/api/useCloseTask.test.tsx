import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCloseTask } from '@/hooks/api/useCloseTask';
import { taskKeys } from '@/hooks/api/useTasks';

const moveTask = vi.fn<(...args: unknown[]) => unknown>();

vi.mock('@/lib/api', () => ({
  moveTask: (options: unknown) => moveTask(options),
}));

const closing = () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const invalidated = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return {
    result: renderHook(() => useCloseTask(), { wrapper }).result,
    invalidated,
  };
};

const CLOSE = {
  slug: 'acme',
  teamId: 'team_1',
  lineId: 'line_1',
  taskId: 'task_1',
  revision: 3,
  completedStationId: 'station_done',
};

describe('useCloseTask', () => {
  beforeEach(() => {
    moveTask.mockReset();
  });

  it('reads the task anew when someone moved it first, so the next close takes its revision', async () => {
    moveTask.mockRejectedValue(
      new Error('Sorry, someone moved this task first. Please try again.'),
    );
    const { result, invalidated } = closing();

    act(() => result.current.mutate(CLOSE));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidated).toHaveBeenCalledWith({
      queryKey: taskKeys.forTeam('team_1'),
    });
  });
});
