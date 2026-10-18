import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SetChecks } from '@/components/features/replays/set/SetChecks';
import type { ReplaySet } from '@/lib/replay';
import type { ReplayCheckSummary } from '@/lib/search';

const pages = vi.fn((): ReplayCheckSummary[][] | undefined => undefined);
const failing = vi.fn(() => false);
const more = vi.fn(() => false);
const fetchNextPage = vi.fn();

vi.mock('@/hooks/api/useGateChanges', () => ({
  useGateChanges: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/api/useReplaySetChecks', () => ({
  useReplaySetChecks: () => ({
    data: pages() ? { pages: pages() } : undefined,
    isPending: pages() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch: vi.fn(),
    hasNextPage: more(),
    isFetchingNextPage: false,
    fetchNextPage,
  }),
}));

const SET: ReplaySet = {
  id: 'set_1',
  lineId: 'line_1',
  stationId: 'station_1',
  name: 'Queue fixes',
  createdAt: '2026-10-01T09:00:00.000Z',
  stationGone: false,
  gatesChanges: false,
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

const check = (over: Partial<ReplayCheckSummary>): ReplayCheckSummary => ({
  id: 'check_1',
  stationId: 'station_1',
  stationKey: 'implementation',
  result: 'passed',
  undecidedBecause: null,
  regressions: 0,
  attempt: 1,
  reference: { commit: null, pullRequest: 42 },
  createdAt: '2026-10-02T09:00:00.000Z',
  replayUrl:
    'https://app.example/w/acme/team/team_1/lines/line_1/stations/station_1/replays/r1',
  ...over,
});

describe('SetChecks', () => {
  beforeEach(() => {
    pages.mockReturnValue(undefined);
    failing.mockReturnValue(false);
    more.mockReturnValue(false);
    fetchNextPage.mockClear();
  });

  it('keeps the checks’ place while they load', () => {
    render(
      <MemoryRouter>
        <SetChecks teamId="team_1" set={SET} replayCheck={null} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('status', { name: 'Loading the checks' }),
    ).toBeInTheDocument();
  });

  it('says the set gates nothing yet, beside the switch that lets it', () => {
    pages.mockReturnValue([[]]);

    render(
      <MemoryRouter>
        <SetChecks teamId="team_1" set={SET} replayCheck={null} />
      </MemoryRouter>,
    );

    expect(screen.getByText('No checks yet')).toBeInTheDocument();
    expect(
      screen.getByText('The set doesn’t gate config changes.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'Gates config changes' }),
    ).not.toBeChecked();
  });

  it('says it could not load the checks, with a retry', () => {
    failing.mockReturnValue(true);

    render(
      <MemoryRouter>
        <SetChecks teamId="team_1" set={SET} replayCheck={null} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });

  it('lists each check with its change, result, regressions and attempt, opening its replay, and pages back', () => {
    pages.mockReturnValue([
      [
        check({}),
        check({
          id: 'check_2',
          result: 'undecided',
          undecidedBecause: 'over-ceiling',
          regressions: 2,
          attempt: 2,
          reference: { commit: 'abcdef1234', pullRequest: null },
          replayUrl: null,
        }),
      ],
    ]);
    more.mockReturnValue(true);

    render(
      <MemoryRouter>
        <SetChecks teamId="team_1" set={SET} replayCheck={null} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('link', { name: 'Pull request #42' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_1/replays/r1',
    );
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('Commit abcdef1')).toBeInTheDocument();
    expect(
      screen.getByText('Undecided: replay reached its ceiling'),
    ).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('attempt 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show older checks' }));

    expect(fetchNextPage).toHaveBeenCalled();
  });
});
