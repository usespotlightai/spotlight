import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StationSearches } from '@/components/features/searches/station/StationSearches';
import type { ReplaySet } from '@/lib/replay';
import type { Search } from '@/lib/search';

const searches = vi.fn((): Search[] | undefined => undefined);
const error = vi.fn((): unknown => null);
const sets = vi.fn((): ReplaySet | null | undefined => null);

vi.mock('@/hooks/api/useSearches', () => ({
  useSearches: () => ({
    data: searches(),
    isPending: searches() === undefined,
    errorUpdateCount: error() ? 1 : 0,
    error: error(),
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/api/useReplaySet', () => ({
  useReplaySet: () => ({
    data: sets(),
    isPending: sets() === undefined,
    errorUpdateCount: 0,
  }),
}));

const AT = {
  slug: 'acme',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
};

const setOf = (tasks: number): ReplaySet => ({
  id: 'set_1',
  lineId: 'line_1',
  stationId: 'station_1',
  createdAt: '2026-10-01T09:00:00.000Z',
  refreshedAt: null,
  lastRefresh: null,
  stationGone: false,
  searchSchedule: null,
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
  entries: Array.from({ length: tasks }, (_, place) => ({
    runId: `run_${place}`,
    taskId: `task_${place}`,
    title: null,
    state: 'completed',
    endedAt: null,
    addedAt: '2026-10-01T09:00:00.000Z',
    unreplayableReason: null,
    reason: null,
    outcome: 'other',
    origin: 'person',
  })),
});

const SEARCH: Search = {
  id: 'search_1',
  lineId: 'line_1',
  stationId: 'station_1',
  setId: 'set_1',
  state: 'searching',
  stopReason: null,
  agent: { harness: 'claude-code', model: null, effort: null },
  budget: {
    iterations: 3,
    perIteration: 2,
    ceiling: { amount: 20, currency: 'USD' },
    concurrency: 4,
    repeats: 1,
  },
  objective: 'success',
  spent: { amount: 4.5, currency: 'USD' },
  iterationsRun: 2,
  proposed: 3,
  best: {
    candidateId: 'c',
    name: 'tests-first',
    isSeed: false,
    searchScore: 0.8,
    searchInterval: null,
    heldOutScore: null,
    heldOutInterval: null,
    costPerRun: 0.9,
    overfit: null,
    regressions: { searched: 0, heldOut: null, total: 0 },
    exceedsRegressionLimit: false,
  },
  maxRegressions: null,
  trigger: 'schedule',
  pick: null,
  startedAt: '2026-10-02T09:00:00.000Z',
  endedAt: null,
};

const renderSearches = () =>
  render(
    <MemoryRouter>
      <StationSearches at={AT} />
    </MemoryRouter>,
  );

describe('StationSearches', () => {
  beforeEach(() => {
    searches.mockReturnValue(undefined);
    error.mockReturnValue(null);
    sets.mockReturnValue(null);
  });

  it('keeps the place of the searches while they load', () => {
    renderSearches();

    expect(
      screen.getByRole('status', { name: 'Loading the searches' }),
    ).toBeInTheDocument();
  });

  it('keeps the place of the searches while the set loads, with no empty text', () => {
    searches.mockReturnValue([]);
    sets.mockReturnValue(undefined);

    renderSearches();

    expect(
      screen.getByRole('status', { name: 'Loading the searches' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('No searches yet')).not.toBeInTheDocument();
  });

  it('tells someone off the team that only its members see searches', () => {
    error.mockReturnValue({ status: 404 });

    renderSearches();

    expect(
      screen.getByText('Only team members can see its searches'),
    ).toBeInTheDocument();
  });

  it('says Spotlight starts searches while there are none, with no button to start one', () => {
    searches.mockReturnValue([]);
    sets.mockReturnValue(setOf(6));

    renderSearches();

    expect(screen.getByText('No searches yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Spotlight searches the station on a schedule and when a station alert fires.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says why Spotlight skipped the last search', () => {
    searches.mockReturnValue([]);
    sets.mockReturnValue({
      ...setOf(3),
      searchSchedule: {
        lastStartedAt: null,
        lastSkip: { reason: 'set-too-small', at: '2026-10-01T09:00:00.000Z' },
        checkAfter: '2026-10-02T09:00:00.000Z',
        minimumTasks: 5,
      },
    });

    renderSearches();

    expect(
      screen.getByText(
        'Spotlight did not start a search: the replay set has too few tasks. Minimum tasks: 5',
      ),
    ).toBeInTheDocument();
  });

  it('lists each search with its progress, spend and best candidate', () => {
    searches.mockReturnValue([SEARCH]);
    sets.mockReturnValue(setOf(6));

    renderSearches();

    const row = screen.getByRole('link', { name: 'Search 1' });
    expect(row).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_1/searches/search_1',
    );
    expect(screen.getByText('Searching')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="search"]')).toHaveTextContent(
      '2 / 3',
    );
    expect(screen.getByText('$4.50 / $20.00')).toBeInTheDocument();
    expect(screen.getByText('tests-first')).toBeInTheDocument();
    expect(screen.getByText('80%')).toHaveAccessibleDescription(
      /^This score is from the searched tasks\./,
    );
    expect(
      screen.queryByRole('button', { name: 'Start a search' }),
    ).not.toBeInTheDocument();
  });

  it('marks a search whose best candidate gained only on the tasks it could see, or says too few held-out tasks were scored to tell', () => {
    const best = SEARCH.best;
    searches.mockReturnValue([
      { ...SEARCH, best: best && { ...best, overfit: 'likely' } },
      {
        ...SEARCH,
        id: 'search_2',
        best: best && { ...best, overfit: 'too-few-held-out' },
      },
    ]);
    sets.mockReturnValue(setOf(6));

    renderSearches();

    expect(screen.getByRole('img', { name: 'Likely overfit' })).toHaveAttribute(
      'data-mark',
      'likely',
    );
    expect(
      screen.getByRole('img', { name: 'Overfit unknown' }),
    ).toHaveAttribute('data-mark', 'too-few-held-out');
  });

  it('marks a search whose best candidate is over the line’s regression limit', () => {
    const best = SEARCH.best;
    searches.mockReturnValue([
      {
        ...SEARCH,
        maxRegressions: 1,
        best: best && {
          ...best,
          regressions: { searched: 2, heldOut: null, total: 2 },
          exceedsRegressionLimit: true,
        },
      },
    ]);
    sets.mockReturnValue(setOf(6));

    renderSearches();

    expect(
      screen.getByRole('img', { name: 'Over the regression limit' }),
    ).toHaveAccessibleDescription('Regressed: 2 tasks. Line allows: 1.');
  });
});
