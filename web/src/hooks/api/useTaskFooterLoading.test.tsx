import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTaskFooterLoading } from '@/hooks/api/useTaskFooterLoading';

const settled = { isPending: false, errorUpdateCount: 0 };
const pending = { isPending: true, errorUpdateCount: 0 };

const state = {
  task: { ...settled, data: { stationId: 'station_2' } } as Record<
    string,
    unknown
  >,
  lines: settled,
  pullRequests: settled,
  runs: pending,
  runsAskedFor: [] as (string | undefined)[],
};

vi.mock('@/hooks/api/useTasks', () => ({ useTask: () => state.task }));
vi.mock('@/hooks/api/useLines', () => ({ useLines: () => state.lines }));
vi.mock('@/hooks/api/useTaskPullRequests', () => ({
  useTaskPullRequests: () => state.pullRequests,
}));
vi.mock('@/hooks/api/useTaskRuns', () => ({
  useTaskRuns: (_teamId: string, taskId?: string) => {
    state.runsAskedFor.push(taskId);
    return state.runs;
  },
}));

beforeEach(() => {
  state.task = { ...settled, data: { stationId: 'station_2' } };
  state.lines = settled;
  state.pullRequests = settled;
  state.runs = pending;
  state.runsAskedFor = [];
});

describe('useTaskFooterLoading', () => {
  it('waits for the pull requests of the task', () => {
    state.pullRequests = pending;

    const { result } = renderHook(() =>
      useTaskFooterLoading('team_1', 'task_1'),
    );

    expect(result.current).toBe(true);
  });

  it('does not ask for the task’s runs while the run is at the task’s station', () => {
    const { result } = renderHook(() =>
      useTaskFooterLoading('team_1', 'task_1', 'station_2'),
    );

    expect(result.current).toBe(false);
    expect(state.runsAskedFor.every((taskId) => taskId === undefined)).toBe(
      true,
    );
  });

  it('waits for the task’s runs once the task has moved on from the run’s station', () => {
    const { result } = renderHook(() =>
      useTaskFooterLoading('team_1', 'task_1', 'station_1'),
    );

    expect(result.current).toBe(true);
    expect(state.runsAskedFor).toContain('task_1');
  });

  it('waits for nothing without a task', () => {
    state.task = pending;

    const { result } = renderHook(() =>
      useTaskFooterLoading('team_1', undefined),
    );

    expect(result.current).toBe(false);
  });
});
