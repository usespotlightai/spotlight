import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    totals: { successRate: 0.75, interval: { rate: 0.75, low: 0.5, high: 1 } },
    againstBaseline: {
      gain: 0.25,
      low: 0.05,
      high: 0.45,
      verdict: 'better',
      minGain: 0.05,
      tasks: 4,
    },
    comparedWith: { replayId: 'baseline', successRate: 0.5, interval: null },
    pairedWith: 'baseline',
    pairsAgainstBaseline: { wins: 2, losses: 1, ties: 1 },
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
      screen.getByText('Only team members can see its replays'),
    ).toBeInTheDocument();
  });

  it('offers to open the first set where there is none', () => {
    sets.mockReturnValue([]);

    renderSets();

    expect(screen.getByText('No replay sets yet')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create a replay set' }),
    ).toBeInTheDocument();
  });

  it('shows each set’s size, a gone station and its latest replay against the baseline', async () => {
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
            unreplayableReason: null,
            reason: null,
            outcome: 'other',
            origin: 'person',
          },
        ],
      },
    ]);
    replays.mockReturnValue([
      replay({}),
      replay({
        id: 'baseline',
        isBaseline: true,
        pairedWith: null,
        comparedWith: null,
        startedAt: '2026-10-01T09:00:00.000Z',
        totals: { successRate: 0.5 } as Replay['totals'],
      }),
    ]);

    renderSets();

    expect(screen.getByRole('link', { name: 'Queue fixes' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_1/replay-sets/set_1',
    );
    expect(
      document.querySelector('[data-slot="replay-set"]'),
    ).toHaveTextContent('Queue fixesStation goneRuns1');
    expect(screen.getByText('Station gone')).toBeInTheDocument();
    const rate = screen.getByRole('button', { name: '75% succeeded' });
    expect(screen.queryByText('Shorter prompt')).not.toBeInTheDocument();

    await userEvent.hover(rate);

    expect(await screen.findByText('Shorter prompt')).toBeInTheDocument();
    const success = document.querySelector(
      '[data-slot="success-against-baseline"]',
    );
    expect(success).toHaveTextContent('75% (50–100%) succeeded');
    expect(
      success?.querySelector('[data-slot="gain-verdict"]'),
    ).toHaveAttribute('data-verdict', 'better');
    expect(success).toHaveTextContent(
      '+25 pts(+5 to +45)vs baseline 50%· Better',
    );
    expect(
      success?.querySelector('[data-slot="pair-tally"]'),
    ).toHaveTextContent(
      'Side by side with the baseline: 2 wins, 1 loss, 1 tie',
    );
  });

  it('shows a replay with the answer against the live replay it was handed the answer against', async () => {
    sets.mockReturnValue([SET]);
    replays.mockReturnValue([
      replay({
        id: 'answer',
        candidate: {
          id: 'c',
          name: 'With the answer',
          kind: 'oracle',
          fingerprint: 'f',
          station: {},
          createdAt: '2026-10-01T09:00:00.000Z',
        },
        comparedWith: { replayId: 'live', successRate: 0.25, interval: null },
        pairedWith: null,
        pairsAgainstBaseline: null,
      }),
      replay({
        id: 'baseline',
        isBaseline: true,
        pairedWith: null,
        comparedWith: null,
        startedAt: '2026-10-01T09:00:00.000Z',
        totals: { successRate: 0.5 } as Replay['totals'],
      }),
    ]);

    renderSets();

    await userEvent.hover(
      screen.getByRole('button', { name: '75% succeeded' }),
    );

    expect(await screen.findByText('With the answer')).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="success-against-baseline"]'),
    ).toHaveTextContent('+25 pts(+5 to +45)vs live config 25%· Better');
  });

  it('names a counterpart that has scored nothing yet, with no rate', async () => {
    sets.mockReturnValue([SET]);
    replays.mockReturnValue([
      replay({
        candidate: {
          id: 'c',
          name: 'With the answer',
          kind: 'oracle',
          fingerprint: 'f',
          station: {},
          createdAt: '2026-10-01T09:00:00.000Z',
        },
        againstBaseline: null,
        comparedWith: { replayId: 'live', successRate: null, interval: null },
        pairedWith: null,
        pairsAgainstBaseline: null,
      }),
    ]);

    renderSets();

    await userEvent.hover(
      screen.getByRole('button', { name: '75% succeeded' }),
    );

    expect(await screen.findByText('With the answer')).toBeInTheDocument();
    const success = document.querySelector(
      '[data-slot="success-against-baseline"]',
    );
    expect(success).toHaveTextContent('75% (50–100%) succeeded· live config');
    expect(success).not.toHaveTextContent('baseline');
  });
});
