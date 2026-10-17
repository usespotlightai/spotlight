import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ReplaySetActions } from '@/components/features/replays/set/ReplaySetActions';
import { ReplaySetHeading } from '@/components/features/replays/set/ReplaySetHeading';
import type { ReplaySet } from '@/lib/replay';

vi.mock('@/hooks/api/useRenameReplaySet', () => ({
  useRenameReplaySet: () => ({
    mutate: vi.fn(),
    isPending: false,
    reset: vi.fn(),
  }),
}));

vi.mock('@/hooks/api/useDeleteReplaySet', () => ({
  useDeleteReplaySet: () => ({
    mutate: vi.fn(),
    isPending: false,
    reset: vi.fn(),
  }),
}));

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
      { outcome: 'accepted', count: 0 },
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
  entries: [],
};

const renderHeader = (set: ReplaySet, running = false, searching = false) =>
  render(
    <MemoryRouter>
      <ReplaySetActions
        teamId="team_1"
        set={set}
        running={running || searching}
        deletedTo="/w/acme"
      />
      <ReplaySetHeading set={set} line={undefined} station={undefined} />
    </MemoryRouter>,
  );

describe('ReplaySetHeading and ReplaySetActions', () => {
  it('names the set and its runs, and lets it be renamed and deleted while nothing of it runs', () => {
    renderHeader(SET);

    expect(
      screen.getByRole('heading', { name: 'Queue fixes' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^0 runs · opened /)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('does not delete a set while a replay of it runs, saying why', () => {
    renderHeader(SET, true);

    const deleting = screen.getByRole('button', { name: 'Delete' });
    expect(deleting).toBeDisabled();
    expect(deleting).toHaveAccessibleDescription(
      'A replay or search of this set is running. Please delete the set after it ends.',
    );
  });

  it('marks a set whose station is gone, and still offers rename and delete', () => {
    renderHeader({ ...SET, stationGone: true });

    expect(screen.getByText('Station gone')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('does not delete a set a search is using, without marking the heading', () => {
    renderHeader(SET, false, true);

    expect(screen.queryByText(/frozen/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });
});
