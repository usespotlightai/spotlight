import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReplaySets } from '@/components/features/replays/station/ReplaySets';
import type { Replay, ReplaySet } from '@/lib/replay';

const sets = vi.fn((): ReplaySet[] | undefined => undefined);
const error = vi.fn((): unknown => null);
const replays = vi.fn((): Replay[] | undefined => []);

vi.mock('@/hooks/api/useReplaySets', () => ({
  useReplaySets: () => ({
    data: sets(),
    isPending: sets() === undefined,
    errorUpdateCount: error() ? 1 : 0,
    error: error(),
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/api/useReplays', () => ({
  useReplays: () => ({
    data: replays(),
    isPending: false,
    errorUpdateCount: 0,
  }),
}));

vi.mock('@/hooks/api/useOpenReplaySet', () => ({
  useOpenReplaySet: () => ({
    mutate: vi.fn(),
    isPending: false,
    reset: vi.fn(),
  }),
}));

const AT = {
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
  entries: [],
};

const replay = (over: Partial<Replay>): Replay =>
  ({
    id: 'replay_1',
    candidate: {
      id: 'c',
      name: 'Shorter prompt',
      kind: 'proposed',
      fingerprint: 'f',
      station: {},
      createdAt: '2026-10-01T09:00:00.000Z',
    },
    isBaseline: false,
    state: 'finished',
    startedAt: '2026-10-02T09:00:00.000Z',
    totals: { successRate: 0.75 },
    ...over,
  }) as Replay;

const renderSets = () =>
  render(
    <MemoryRouter>
      <ReplaySets at={AT} />
    </MemoryRouter>,
  );

describe('ReplaySets', () => {
  beforeEach(() => {
    sets.mockReturnValue(undefined);
    error.mockReturnValue(null);
    replays.mockReturnValue([]);
  });

  it('tells someone off the team that only its members see replays', () => {
    error.mockReturnValue({ status: 404, detail: 'No such team' });

    renderSets();

    expect(
      screen.getByText('Only the team’s members can see its replays'),
    ).toBeInTheDocument();
  });

  it('offers to open the first set where there is none', () => {
    sets.mockReturnValue([]);

    renderSets();

    expect(screen.getByText('No replay sets yet')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open a replay set' }),
    ).toBeInTheDocument();
  });

  it('shows each set’s size, a gone station and its latest replay against the baseline', () => {
    sets.mockReturnValue([
      {
        ...SET,
        stationGone: true,
        entries: [
          {
            runId: 'run_1',
            taskId: 'task_1',
            title: 'Fix the queue',
            state: 'completed',
            endedAt: null,
            addedAt: '2026-10-01T09:00:00.000Z',
            refusal: null,
            reason: null,
          },
        ],
      },
    ]);
    replays.mockReturnValue([
      replay({}),
      replay({
        id: 'baseline',
        isBaseline: true,
        startedAt: '2026-10-01T09:00:00.000Z',
        totals: { successRate: 0.5 } as Replay['totals'],
      }),
    ]);

    renderSets();

    expect(screen.getByRole('link', { name: 'Queue fixes' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_1/replay-sets/set_1',
    );
    expect(screen.getByText('1 run')).toBeInTheDocument();
    expect(screen.getByText('Station gone')).toBeInTheDocument();
    expect(screen.getByText('Latest: Shorter prompt')).toBeInTheDocument();
    expect(screen.getByText('75% succeeded')).toBeInTheDocument();
    expect(screen.getByText('+25 pts')).toBeInTheDocument();
  });
});
