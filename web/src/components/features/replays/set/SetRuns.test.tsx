import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { SetRuns } from '@/components/features/replays/set/SetRuns';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';

vi.mock('@/hooks/api/useRemoveReplaySetEntry', () => ({
  useRemoveReplaySetEntry: () => ({ mutate: vi.fn(), isPending: false }),
}));

const AT: ReplayedStation = {
  slug: 'acme',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
};

const SET: ReplaySet = {
  id: 'set_1',
  lineId: 'line_1',
  stationId: 'station_1',
  name: 'Queue fixes',
  createdAt: '2026-10-01T09:00:00.000Z',
  stationGone: false,
  guardsChanges: false,
  health: {
    noise: null,
    saturation: null,
    judge: null,
    checks: null,
    oracle: null,
  },
  minGain: 0.05,
  composition: {
    outcomes: [
      { outcome: 'accepted', count: 1 },
      { outcome: 'sent-back', count: 0 },
      { outcome: 'asked', count: 0 },
      { outcome: 'failed', count: 0 },
      { outcome: 'other', count: 0 },
    ],
    origins: [],
    oldest: null,
    median: null,
    newest: null,
    balanceWarning: null,
  },
  entries: [
    {
      runId: 'run_1',
      taskId: 'task_1',
      title: 'Split the invoice job',
      state: 'completed',
      endedAt: '2026-10-02T09:00:00.000Z',
      addedAt: '2026-10-03T09:00:00.000Z',
      unreplayableReason: null,
      reason: null,
      outcome: 'accepted',
      origin: null,
    },
  ],
};

const FROZEN_BY_SEARCH =
  'A search of this set is running. Add or take out runs after the search ends or a person stops it.';

const renderRuns = (frozen: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SetRuns at={AT} set={SET} frozen={frozen} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('SetRuns', () => {
  it('lets runs be added and taken out while no search uses the set', () => {
    renderRuns(false);

    expect(screen.getByRole('button', { name: 'Add runs' })).toBeEnabled();
    expect(
      screen.getByRole('button', {
        name: 'Take Split the invoice job out of the set',
      }),
    ).toBeEnabled();
  });

  it('does not add or take out runs while a search uses the set, saying why on each', () => {
    renderRuns(true);

    const adding = screen.getByRole('button', { name: 'Add runs' });
    const removing = screen.getByRole('button', {
      name: 'Take Split the invoice job out of the set',
    });
    expect(adding).toBeDisabled();
    expect(adding).toHaveAccessibleDescription(FROZEN_BY_SEARCH);
    expect(removing).toBeDisabled();
    expect(removing).toHaveAccessibleDescription(FROZEN_BY_SEARCH);
  });
});
