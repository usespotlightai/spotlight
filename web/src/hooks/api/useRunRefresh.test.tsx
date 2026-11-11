import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { journalKeys } from '@/hooks/api/useRunJournals';
import { useRunRefresh } from '@/hooks/api/useRunRefresh';
import { teamRunKeys } from '@/hooks/api/useTeamRuns';

const streams: Stream[] = [];

class Stream {
  onmessage: (() => void) | null = null;

  constructor() {
    streams.push(this);
  }

  close() {}
}

let client = new QueryClient();

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const keysOf = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map(
    ([filters]) => (filters as { queryKey?: unknown } | undefined)?.queryKey,
  );

describe('the refresh of a live run', () => {
  beforeEach(() => {
    streams.length = 0;
    client = new QueryClient();
    vi.stubGlobal('EventSource', Stream);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes the journal of the followed run on a bump, and not the task or the team runs', () => {
    const invalidated = vi.spyOn(client, 'invalidateQueries');

    renderHook(
      () =>
        useRunRefresh({
          teamId: 'team_1',
          runId: 'run_1',
          taskId: 'task_1',
          state: 'completed',
          following: { id: 'run_2', state: 'claimed', progress: null },
        }),
      { wrapper },
    );
    invalidated.mockClear();
    act(() => streams[0]?.onmessage?.());

    const keys = keysOf(invalidated);
    expect(keys).toContainEqual(journalKeys.ofRun('run_2'));
    expect(keys).not.toContainEqual(journalKeys.runsOfTask('task_1'));
    expect(keys).not.toContainEqual(teamRunKeys.forTeam('team_1'));
  });

  it('refreshes the team runs and the journal index when the followed run changes state', () => {
    const invalidated = vi.spyOn(client, 'invalidateQueries');
    const { rerender } = renderHook(
      ({ state }: { state: 'claimed' | 'completed' }) =>
        useRunRefresh({
          teamId: 'team_1',
          runId: 'run_1',
          taskId: 'task_1',
          following: { id: 'run_1', state, progress: null },
        }),
      { wrapper, initialProps: { state: 'claimed' } },
    );
    invalidated.mockClear();
    rerender({ state: 'completed' });

    const keys = keysOf(invalidated);
    expect(keys).toContainEqual(journalKeys.ofRun('run_1'));
    expect(keys).toContainEqual(journalKeys.runsOfTask('task_1'));
    expect(keys).toContainEqual(teamRunKeys.forTeam('team_1'));
  });
});
