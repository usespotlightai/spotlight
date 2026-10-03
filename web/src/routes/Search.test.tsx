import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchDetail, Search as SearchSummary } from '@/lib/search';
import { Search } from '@/routes/Search';

const detail = vi.fn((): SearchDetail | undefined => undefined);
const error = vi.fn((): unknown => null);

vi.mock('@/hooks/api/useSearch', () => ({
  useSearch: () => ({
    data: detail(),
    isPending: detail() === undefined,
    errorUpdateCount: error() ? 1 : 0,
    error: error(),
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/api/useSearches', () => ({
  useSearches: () => ({
    data: [
      { id: 'search_0', startedAt: '2026-09-30T09:00:00.000Z' },
      { id: 'search_1', startedAt: '2026-10-01T09:00:00.000Z' },
    ] as SearchSummary[],
  }),
}));

const sets = vi.fn((): unknown => undefined);

vi.mock('@/hooks/api/useReplaySets', () => ({
  useTeamReplaySets: () => ({
    data:
      sets() === 'none'
        ? undefined
        : (sets() ?? [
            {
              id: 'set_1',
              name: 'Billing work',
              entries: [
                {
                  runId: 'run_held',
                  taskId: 'task_held',
                  title: 'Retry refunds on timeout',
                },
              ],
            },
          ]),
  }),
}));

vi.mock('@/hooks/useStationTrail', () => ({
  useStationTrail: () => [{ label: 'Implementation', to: '/station' }],
}));

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({ data: [{ id: 'claude-code', name: 'Claude Code' }] }),
}));

vi.mock('@/hooks/api/useStopSearch', () => ({
  useStopSearch: () => ({ mutate: vi.fn(), isPending: false, reset: vi.fn() }),
}));

vi.mock('@/hooks/api/usePickSearchCandidate', () => ({
  usePickSearchCandidate: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  }),
}));

const candidate = (
  over: Partial<SearchDetail['seed']>,
): SearchDetail['seed'] => ({
  candidateId: 'c',
  name: 'shorter',
  seed: false,
  iteration: 1,
  hypothesis: null,
  fingerprint: null,
  changes: [],
  replayId: 'replay_c',
  replayState: 'finished',
  heldOutReplayId: null,
  heldOutReplayState: null,
  searchInterval: null,
  heldOutInterval: null,
  searchedGain: null,
  heldOutGain: null,
  searchScore: 0.6,
  searchScored: 5,
  heldOutScore: null,
  costPerRun: 0.5,
  spent: { amount: 2.5, currency: 'USD' },
  onFrontier: false,
  onlyOnSeenTasks: null,
  pullRequest: null,
  ...over,
});

const DETAIL: SearchDetail = {
  id: 'search_1',
  lineId: 'line_1',
  stationId: 'station_1',
  setId: 'set_1',
  state: 'finished',
  ending: 'iterations-spent',
  agent: { harness: 'claude-code', model: 'opus', effort: 'high' },
  budget: {
    iterations: 2,
    perIteration: 2,
    ceiling: { amount: 20, currency: 'USD' },
    concurrency: 4,
    repeats: 1,
  },
  objective: 'success',
  spent: { amount: 12, currency: 'USD' },
  iterationsRun: 2,
  proposed: 1,
  best: null,
  startedAt: '2026-10-01T09:00:00.000Z',
  endedAt: '2026-10-01T12:00:00.000Z',
  split: {
    searchedTasks: 5,
    heldOutTasks: 2,
    searched: [],
    heldOut: [{ runId: 'run_held', taskId: 'task_held' }],
  },
  iterations: [
    {
      number: 1,
      runId: 'run_search_1',
      state: 'ended',
      attempts: 1,
      proposed: ['tests'],
      agentSpent: null,
    },
    {
      number: 2,
      runId: 'run_search_2',
      state: 'failed',
      attempts: 0,
      proposed: [],
      agentSpent: null,
    },
  ],
  seed: candidate({
    candidateId: 'seed',
    name: 'seed',
    seed: true,
    iteration: null,
    replayId: 'replay_seed',
    onFrontier: true,
  }),
  candidates: [
    candidate({
      candidateId: 'tests',
      name: 'tests-first',
      hypothesis: 'Reading the tests first should help.',
      changes: [
        { part: 'prompt', name: null, kind: 'changed', was: null, now: null },
      ],
      searchScore: 0.8,
      heldOutScore: 1,
      heldOutReplayId: 'replay_tests_held',
      heldOutReplayState: 'finished',
      searchInterval: { rate: 0.8, low: 0.6, high: 1 },
      heldOutInterval: { rate: 1, low: 1, high: 1 },
      searchedGain: {
        gain: 0.2,
        low: 0.05,
        high: 0.35,
        verdict: 'better',
        minGain: 0.05,
        tasks: 5,
      },
      heldOutGain: {
        gain: 0.1,
        low: -0.2,
        high: 0.4,
        verdict: 'within-noise',
        minGain: 0.05,
        tasks: 6,
      },
      onFrontier: true,
      onlyOnSeenTasks: 'marked',
    }),
  ],
  frontier: ['seed', 'tests'],
  onlyOnSeenTasks: 1,
  minGain: 0.05,
};

const renderSearch = () =>
  render(
    <MemoryRouter
      initialEntries={[
        '/w/acme/team/team_1/lines/line_1/stations/station_1/searches/search_1',
      ]}
    >
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/lines/:lineId/stations/:stationId/searches/:searchId"
          element={<Search />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe('Search', () => {
  beforeEach(() => {
    detail.mockReturnValue(undefined);
    error.mockReturnValue(null);
    sets.mockReturnValue(undefined);
  });

  it('holds the page’s place while the search loads', () => {
    renderSearch();

    expect(
      screen.getByRole('status', { name: 'Loading the search' }),
    ).toBeInTheDocument();
  });

  it('tells someone off the team that only its members see searches', () => {
    error.mockReturnValue({ status: 404 });
    sets.mockReturnValue('none');

    renderSearch();

    expect(
      screen.getByText('Only the team’s members can see its searches'),
    ).toBeInTheDocument();
  });

  it('says a search the team does not hold is not found, for a member', () => {
    error.mockReturnValue({ status: 404 });
    sets.mockReturnValue([]);

    renderSearch();

    expect(screen.getByText('Search not found')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'See the station’s searches' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_1#searches',
    );
  });

  it('finds no search of another station at this address', () => {
    detail.mockReturnValue({ ...DETAIL, stationId: 'elsewhere' });

    renderSearch();

    expect(screen.getByText('Search not found')).toBeInTheDocument();
  });

  it('shows the search’s state, budget, spend and why it ended', () => {
    detail.mockReturnValue(DETAIL);

    renderSearch();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Search 2' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Finished')).toBeInTheDocument();
    expect(
      screen.getByText('It ran every iteration it was given.'),
    ).toBeInTheDocument();
    expect(screen.getByText('$12.00 of $20.00')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Stop' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Billing work' }),
    ).toBeInTheDocument();
  });

  it('says the search aims for more success, and names its best', () => {
    detail.mockReturnValue(DETAIL);

    renderSearch();

    expect(
      document.querySelector('[data-slot="search-objective"]'),
    ).toHaveTextContent('More success');
    expect(screen.getByText('Best')).toBeInTheDocument();
  });

  it('says a search aims for the same success for less, naming its cheapest and how its frontier is drawn', () => {
    detail.mockReturnValue({ ...DETAIL, objective: 'cost', best: null });

    renderSearch();

    expect(
      document.querySelector('[data-slot="search-objective"]'),
    ).toHaveTextContent('The same success for less');
    expect(screen.getByText('Cheapest')).toBeInTheDocument();
    expect(
      screen.getByText('No candidate holds its success yet'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /the frontier joins only those that succeed as often as the live config/,
      ),
    ).toBeInTheDocument();
  });

  it('names the held-out tasks', () => {
    detail.mockReturnValue(DETAIL);

    renderSearch();

    expect(
      within(screen.getByRole('list', { name: 'Held-out tasks' })).getByRole(
        'link',
        { name: 'Retry refunds on timeout' },
      ),
    ).toHaveAttribute('href', '/w/acme/team/team_1/runs/run_held');
  });

  it('puts a table behind the frontier chart', () => {
    detail.mockReturnValue(DETAIL);

    renderSearch();

    fireEvent.click(screen.getByRole('button', { name: 'Show table' }));

    const table = screen.getByRole('table', {
      name: 'Candidates by success and cost',
    });
    expect(within(table).getByText('Live config')).toBeInTheDocument();
    expect(within(table).getByText('tests-first')).toBeInTheDocument();
    expect(within(table).getByText('100%')).toBeInTheDocument();

    const tests = within(table).getByText('tests-first').closest('tr');
    const slots = (slot: string) =>
      [...(tests?.querySelectorAll(`[data-slot="${slot}"]`) ?? [])].map(
        (each) => each.textContent,
      );
    expect(slots('rate-with-interval')).toEqual([
      '80% (60–100%)',
      '100% (100–100%)',
    ]);
    expect(slots('gain-verdict')).toEqual([
      '+20 pts(+5 to +35)· Better',
      '+10 pts(−20 to +40)· Within noise',
    ]);
  });

  it('marks a candidate that gained only on the tasks the search could see, and counts them on the frontier', () => {
    detail.mockReturnValue(DETAIL);

    renderSearch();

    expect(
      screen.getByText(
        '1 candidate on the frontier gained only on the tasks the search could see, not on the held-out ones.',
      ),
    ).toBeInTheDocument();

    const first = screen.getByRole('list', {
      name: 'Candidates of iteration 1',
    });
    expect(within(first).getByText('Only on seen tasks')).toBeInTheDocument();
    expect(within(first).getByRole('note')).toHaveTextContent(
      'Its gain showed only on the tasks the search could see.',
    );
    expect(within(first).getByRole('button', { name: 'Pick' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Show table' }));

    const table = screen.getByRole('table', {
      name: 'Candidates by success and cost',
    });
    expect(
      within(table)
        .getByText('tests-first')
        .closest('tr')
        ?.querySelector('[data-slot="only-on-seen-tasks"]'),
    ).toHaveTextContent('Only on seen tasks');
    expect(
      within(table)
        .getByText('Live config')
        .closest('tr')
        ?.querySelector('[data-slot="only-on-seen-tasks"]'),
    ).toBeNull();
  });

  it('marks the best candidate in the header when its gain showed only on the tasks the search could see', () => {
    detail.mockReturnValue({
      ...DETAIL,
      best: {
        candidateId: 'tests',
        name: 'tests-first',
        seed: false,
        searchScore: 0.8,
        searchInterval: null,
        heldOutScore: 1,
        heldOutInterval: null,
        costPerRun: 0.5,
        onlyOnSeenTasks: 'marked',
      },
    });

    renderSearch();

    const best = document.querySelector('[data-slot="best-candidate"]');
    expect(best).toHaveTextContent('tests-first');
    expect(
      best?.querySelector('[data-slot="only-on-seen-tasks"]'),
    ).toHaveTextContent('Only on seen tasks');
  });

  it('says plainly when too few held-out tasks were scored to tell, without marking or counting it', () => {
    const [tests] = DETAIL.candidates;
    detail.mockReturnValue({
      ...DETAIL,
      candidates: tests
        ? [{ ...tests, onlyOnSeenTasks: 'too-few-held-out' }]
        : [],
      onlyOnSeenTasks: 0,
    });

    renderSearch();

    const first = screen.getByRole('list', {
      name: 'Candidates of iteration 1',
    });
    expect(
      within(first).getByText('Too few held-out tasks to tell'),
    ).toBeInTheDocument();
    expect(within(first).queryByText('Only on seen tasks')).toBeNull();
    expect(within(first).queryByRole('note')).toBeNull();
    expect(
      screen.queryByText(/on the frontier gained only on the tasks/),
    ).toBeNull();
  });

  it('shows the live config’s score it started from, and the gain that counts as real', () => {
    detail.mockReturnValue(DETAIL);

    renderSearch();

    expect(
      screen.getByText(/a gain in success counts as real from \+5 pts/),
    ).toBeInTheDocument();
  });

  it('groups candidates by iteration, with their changes, scores, replays and a pick', () => {
    detail.mockReturnValue({ ...DETAIL, state: 'searching', ending: null });

    renderSearch();

    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();

    const first = screen.getByRole('list', {
      name: 'Candidates of iteration 1',
    });
    expect(
      within(first).getByText('Reading the tests first should help.'),
    ).toBeInTheDocument();
    expect(within(first).getByText('On the frontier')).toBeInTheDocument();
    expect(
      within(first).getByRole('link', { name: 'Its held-out replay' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_1/replays/replay_tests_held',
    );
    expect(within(first).getByRole('button', { name: 'Pick' })).toBeEnabled();

    expect(
      screen.getByText('Its agent proposed nothing that could be replayed.'),
    ).toBeInTheDocument();

    const seed = screen.getByRole('list', { name: 'Where it started' });
    expect(
      within(seed).queryByRole('button', { name: 'Pick' }),
    ).not.toBeInTheDocument();
  });

  it('says the live config is replayed first while there are no candidates', () => {
    detail.mockReturnValue({
      ...DETAIL,
      state: 'seeding',
      ending: null,
      iterations: [],
      candidates: [],
    });

    renderSearch();

    expect(screen.getByText('No candidates yet')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Watch the live config’s replay' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_1/replays/replay_seed',
    );
  });
});
