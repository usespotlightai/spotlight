import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StationSearches } from '@/components/features/searches/station/StationSearches';
import type { ReplaySet } from '@/lib/replay';
import type { Search } from '@/lib/search';

const searches = vi.fn((): Search[] | undefined => undefined);
const error = vi.fn((): unknown => null);
const sets = vi.fn((): ReplaySet[] | undefined => []);

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

vi.mock('@/hooks/api/useReplaySets', () => ({
  useReplaySets: () => ({
    data: sets(),
    isPending: false,
    errorUpdateCount: 0,
  }),
}));

vi.mock('@/hooks/api/useSearchEstimate', () => ({
  useSearchEstimate: () => ({ data: undefined, isFetching: false }),
}));

vi.mock('@/hooks/api/useStartSearch', () => ({
  useStartSearch: () => ({ mutate: vi.fn(), isPending: false, reset: vi.fn() }),
}));

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({ data: [] }),
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
  name: 'Billing work',
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
  },
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
    sets.mockReturnValue([]);
  });

  it('keeps the place of the searches while they load', () => {
    renderSearches();

    expect(
      screen.getByRole('status', { name: 'Loading the searches' }),
    ).toBeInTheDocument();
  });

  it('tells someone off the team that only its members see searches', () => {
    error.mockReturnValue({ status: 404 });

    renderSearches();

    expect(
      screen.getByText('Only team members can see its searches'),
    ).toBeInTheDocument();
  });

  it('offers a search once a set covers enough tasks', () => {
    searches.mockReturnValue([]);
    sets.mockReturnValue([setOf(6)]);

    renderSearches();

    expect(screen.getByText('No searches yet')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Start a search' }),
    ).toBeEnabled();
  });

  it('says why no search can start when no set covers enough tasks', () => {
    searches.mockReturnValue([]);
    sets.mockReturnValue([setOf(3)]);

    renderSearches();

    expect(
      screen.getByRole('button', { name: 'Start a search' }),
    ).toBeDisabled();
    expect(
      screen.getByText('No replay set covers 5 different tasks yet.'),
    ).toBeInTheDocument();
  });

  it('lists each search with its progress, spend and best candidate, and does not start a second', () => {
    searches.mockReturnValue([SEARCH]);
    sets.mockReturnValue([setOf(6)]);

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
    const start = screen.getByRole('button', { name: 'Start a search' });
    expect(start).toBeDisabled();
    expect(start).toHaveAccessibleDescription(
      'A search of this station is in progress.',
    );
    expect(
      screen.getByText('A search of this station is in progress.'),
    ).toHaveClass('sr-only');
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
    sets.mockReturnValue([setOf(6)]);

    renderSearches();

    expect(
      screen.getByRole('img', { name: 'Only on seen tasks' }),
    ).toHaveAttribute('data-mark', 'likely');
    expect(
      screen.getByRole('img', { name: 'Too few held-out tasks to tell' }),
    ).toHaveAttribute('data-mark', 'too-few-held-out');
  });
});
