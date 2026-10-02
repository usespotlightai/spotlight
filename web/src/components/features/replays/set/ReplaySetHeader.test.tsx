import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ReplaySetHeader } from '@/components/features/replays/set/ReplaySetHeader';
import type { Replay, ReplaySet } from '@/lib/replay';

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
  entries: [],
};

const renderHeader = (set: ReplaySet, replays: Replay[]) =>
  render(
    <MemoryRouter>
      <ReplaySetHeader
        teamId="team_1"
        set={set}
        replays={replays}
        deletedTo="/w/acme"
      />
    </MemoryRouter>,
  );

describe('ReplaySetHeader', () => {
  it('lets a set be renamed and deleted while nothing of it runs', () => {
    renderHeader(SET, [{ state: 'finished' } as Replay]);

    expect(screen.getByRole('button', { name: 'Rename' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });

  it('refuses to delete a set while a replay of it runs, saying why', () => {
    renderHeader(SET, [{ state: 'running' } as Replay]);

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(
      screen.getByText(/can’t be deleted until that replay ends or is stopped/),
    ).toBeInTheDocument();
  });

  it('says a set whose station is gone takes no more runs, and still offers rename and delete', () => {
    renderHeader({ ...SET, stationGone: true }, []);

    expect(screen.getByText(/takes no\s+more runs/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
  });
});
