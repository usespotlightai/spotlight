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
  guardsChanges: false,
  noise: null,
  minGain: 0.05,
  entries: Array.from({ length: tasks }, (_, place) => ({
    runId: `run_${place}`,
    taskId: `task_${place}`,
    title: null,
    state: 'completed',
    endedAt: null,
    addedAt: '2026-10-01T09:00:00.000Z',
    refusal: null,
    reason: null,
  })),
});

const SEARCH: Search = {
  id: 'search_1',
  lineId: 'line_1',
  stationId: 'station_1',
  setId: 'set_1',
  state: 'searching',
  ending: null,
  agent: { harness: 'claude-code', model: null, effort: null },
  budget: {
    iterations: 3,
    perIteration: 2,
    ceiling: { amount: 20, currency: 'USD' },
    concurrency: 4,
    repeats: 1,
  },
  spent: { amount: 4.5, currency: 'USD' },
  iterationsRun: 2,
  proposed: 3,
  best: {
    candidateId: 'c',
    name: 'tests-first',
    seed: false,
    searchScore: 0.8,
    searchInterval: null,
    heldOutScore: null,
    heldOutInterval: null,
    costPerRun: 0.9,
  },
  startedAt: '2026-10-02T09:00:00.000Z',
  endedAt: null,
};

const renderSearches = (source = null) =>
  render(
    <MemoryRouter>
      <StationSearches at={AT} source={source} replayCheck={null} />
    </MemoryRouter>,
  );

describe('StationSearches', () => {
  beforeEach(() => {
    searches.mockReturnValue(undefined);
    error.mockReturnValue(null);
    sets.mockReturnValue([]);
  });

  it('holds the place of the searches while they load', () => {
    renderSearches();

    expect(
      screen.getByRole('status', { name: 'Loading the searches' }),
    ).toBeInTheDocument();
  });

  it('tells someone off the team that only its members see searches', () => {
    error.mockReturnValue({ status: 404 });

    renderSearches();

    expect(
      screen.getByText('Only the team’s members can see its searches'),
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

  it('lists each search with its progress, spend and best candidate, and refuses a second', () => {
    searches.mockReturnValue([SEARCH]);
    sets.mockReturnValue([setOf(6)]);

    renderSearches();

    const row = screen.getByRole('link', { name: 'Search 1' });
    expect(row).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_1/searches/search_1',
    );
    expect(screen.getByText('Searching')).toBeInTheDocument();
    expect(screen.getByText('2 of 3 iterations')).toBeInTheDocument();
    expect(screen.getByText('· $4.50 of $20.00')).toBeInTheDocument();
    expect(screen.getByText('tests-first')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Start a search' }),
    ).toBeDisabled();
    expect(
      screen.getByText('A search of this station is under way.'),
    ).toBeInTheDocument();
  });

  it('names where a picked candidate opens its pull request', () => {
    searches.mockReturnValue([]);

    render(
      <MemoryRouter>
        <StationSearches
          at={AT}
          source={{ repository: 'acme/config', path: 'lines/default.tf' }}
          replayCheck={{
            mostRegressions: 1,
            ceiling: 10,
            currency: 'USD',
            minGain: 0.05,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('acme/config')).toBeInTheDocument();
    expect(screen.getByText('lines/default.tf')).toBeInTheDocument();
    expect(screen.getByText('1 regression')).toBeInTheDocument();
    expect(screen.getByText('$10.00')).toBeInTheDocument();
  });
});
