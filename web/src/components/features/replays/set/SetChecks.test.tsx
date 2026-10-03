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
  guardsChanges: false,
  health: {
    noise: null,
    saturation: null,
    judge: null,
    checks: null,
    sanity: null,
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
  verdict: 'passed',
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

  it('holds the checks’ place while they load', () => {
    render(
      <MemoryRouter>
        <SetChecks teamId="team_1" set={SET} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('status', { name: 'Loading the checks' }),
    ).toBeInTheDocument();
  });

  it('offers to guard config changes when there are no checks yet', () => {
    pages.mockReturnValue([[]]);

    render(
      <MemoryRouter>
        <SetChecks teamId="team_1" set={SET} />
      </MemoryRouter>,
    );

    expect(screen.getByText('No checks yet')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Let it guard config changes' }),
    ).toHaveAttribute('href', '#guards-changes');
  });

  it('says it could not load the checks, with a retry', () => {
    failing.mockReturnValue(true);

    render(
      <MemoryRouter>
        <SetChecks teamId="team_1" set={SET} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });

  it('lists each check with its pull request, verdict, regressions and replay, and pages back', () => {
    pages.mockReturnValue([
      [
        check({}),
        check({
          id: 'check_2',
          verdict: 'undecided',
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
        <SetChecks teamId="team_1" set={SET} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Pull request #42')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('Commit abcdef1')).toBeInTheDocument();
    expect(
      screen.getByText('Undecided: its replay reached its ceiling'),
    ).toBeInTheDocument();
    expect(screen.getByText('2 regressions')).toBeInTheDocument();
    expect(screen.getByText('· attempt 2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Its replay' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_1/replays/r1',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show older checks' }));

    expect(fetchNextPage).toHaveBeenCalled();
  });
});
