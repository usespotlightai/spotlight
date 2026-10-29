import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type SearchDetail,
  type Search as SearchSummary,
  whyItStalledAnchor,
} from '@/lib/search';
import {
  formatCauseAction,
  formatCauseTitle,
  formatIncumbent,
  formatReflectionIteration,
  formatReflectionResult,
  formatWhyItStalled,
  OPEN_FAILED_REPLAY,
  REFLECTION_KIND,
  REFLECTION_LOOKING,
  SEE_WHY_IT_STALLED,
  UNCAUSED_TITLE,
} from '@/lib/search-words';
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
                  runId: 'run_held_out',
                  taskId: 'task_held_out',
                  title: 'Retry refunds on timeout',
                },
              ],
            },
          ]),
  }),
}));

vi.mock('@/hooks/api/useStation', () => ({
  useStation: () => ({ line: undefined, station: undefined }),
}));

vi.mock('@/hooks/useStationTrail', () => ({
  useStationTrail: () => [{ label: 'Implementation', to: '/station' }],
}));

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({
    data: [
      {
        id: 'claude-code',
        name: 'Claude Code',
        models: [{ id: 'opus', name: 'Opus' }],
      },
    ],
  }),
}));

vi.mock('@/hooks/api/useStopSearch', () => ({
  useStopSearch: () => ({ mutate: vi.fn(), isPending: false, reset: vi.fn() }),
}));

vi.mock('@/hooks/api/usePickSearchCandidate', () => ({
  usePickSearchCandidate: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

const candidate = (
  over: Partial<SearchDetail['seed']>,
): SearchDetail['seed'] => ({
  candidateId: 'c',
  name: 'shorter',
  isSeed: false,
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
  searchedPairs: null,
  heldOutPairs: null,
  searchScore: 0.6,
  searchScored: 5,
  heldOutScore: null,
  costPerRun: 0.5,
  spent: { amount: 2.5, currency: 'USD' },
  onFrontier: false,
  overfit: null,
  regressions: { searched: null, heldOut: null, total: null },
  exceedsRegressionLimit: false,
  pullRequest: null,
  ...over,
});

const DETAIL: SearchDetail = {
  id: 'search_1',
  lineId: 'line_1',
  stationId: 'station_1',
  setId: 'set_1',
  state: 'finished',
  stopReason: 'iterations-spent',
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
    heldOut: [{ runId: 'run_held_out', taskId: 'task_held_out' }],
  },
  iterations: [
    {
      number: 1,
      kind: 'propose',
      runId: 'run_search_1',
      state: 'ended',
      attempts: 1,
      proposed: ['tests'],
      agentSpent: null,
      reflection: null,
    },
    {
      number: 2,
      kind: 'propose',
      runId: 'run_search_2',
      state: 'failed',
      attempts: 0,
      proposed: [],
      agentSpent: null,
      reflection: null,
    },
  ],
  seed: candidate({
    candidateId: 'seed',
    name: 'seed',
    isSeed: true,
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
      heldOutReplayId: 'replay_tests_held_out',
      heldOutReplayState: 'finished',
      searchInterval: { rate: 0.8, low: 0.6, high: 1 },
      heldOutInterval: { rate: 1, low: 1, high: 1 },
      searchedGain: {
        gain: 0.2,
        low: 0.05,
        high: 0.35,
        significance: 'better',
        minGain: 0.05,
        tasks: 5,
      },
      heldOutGain: {
        gain: 0.1,
        low: -0.2,
        high: 0.4,
        significance: 'within-noise',
        minGain: 0.05,
        tasks: 6,
      },
      searchedPairs: { wins: 3, losses: 1, ties: 1 },
      heldOutPairs: { wins: 0, losses: 0, ties: 0 },
      onFrontier: true,
      overfit: 'likely',
    }),
  ],
  frontier: ['seed', 'tests'],
  minGain: 0.05,
  maxRegressions: null,
};

const reflection = (
  over: Partial<NonNullable<SearchDetail['iterations'][number]['reflection']>>,
  state: SearchDetail['iterations'][number]['state'] = 'ended',
): SearchDetail['iterations'][number] => ({
  number: 3,
  kind: 'reflect',
  runId: 'run_search_3',
  state,
  attempts: 0,
  proposed: [],
  agentSpent: null,
  reflection: {
    tasks: [
      {
        taskId: 'task_held_out',
        originalRunId: 'run_held_out',
        replayRunId: 'run_r1',
      },
      { taskId: 'task_2', originalRunId: 'run_2', replayRunId: 'run_r2' },
      { taskId: 'task_3', originalRunId: 'run_3', replayRunId: 'run_r3' },
    ],
    causes: [
      {
        taskId: 'task_held_out',
        originalRunId: 'run_held_out',
        replayRunId: 'run_r1',
        cause: 'judge',
        evidence:
          'It failed the change for missing tests a rename does not need.',
        suggestion: 'Require tests only where behaviour changes.',
        recordedAt: '2026-10-01T11:00:00.000Z',
      },
      {
        taskId: 'task_2',
        originalRunId: 'run_2',
        replayRunId: 'run_r2',
        cause: 'task',
        evidence: 'The cache it tells the agent to warm was removed.',
        suggestion: null,
        recordedAt: '2026-10-01T11:00:00.000Z',
      },
    ],
    incumbent: 'tests',
    result: 'no-config-cause',
    endedSearch: true,
    ...over,
  },
});

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

const tile = (label: string) =>
  screen
    .getAllByText(label)
    .map((each) => each.closest('[data-slot="insights-tile"]'))
    .find(Boolean) as HTMLElement;

const tileNote = (label: string) =>
  tile(label).querySelector('dt [aria-describedby]') as HTMLElement;

const candidateRow = (name: string) =>
  screen
    .getByRole('button', { name: `Details of ${name}` })
    .closest('li') as HTMLElement;

const openCandidate = async (name: string) => {
  await userEvent.click(
    screen.getByRole('button', { name: `Details of ${name}` }),
  );
  return document
    .querySelector('[data-slot="candidate-detail"]')
    ?.closest('aside') as HTMLElement;
};

describe('Search', () => {
  beforeEach(() => {
    detail.mockReturnValue(undefined);
    error.mockReturnValue(null);
    sets.mockReturnValue(undefined);
  });

  it('keeps the page’s place while the search loads', () => {
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
      screen.getByText('Only team members can see its searches'),
    ).toBeInTheDocument();
  });

  it('says a search the team does not own is not found, for a member', () => {
    error.mockReturnValue({ status: 404 });
    sets.mockReturnValue([]);

    renderSearch();

    expect(screen.getByText('Search not found')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'See the station’s searches' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_1/improve#searches',
    );
  });

  it('finds no search of another station at this address', () => {
    detail.mockReturnValue({ ...DETAIL, stationId: 'elsewhere' });

    renderSearch();

    expect(screen.getByText('Search not found')).toBeInTheDocument();
  });

  it('marks a search that ended unusually, saying why on hover', () => {
    detail.mockReturnValue({
      ...DETAIL,
      state: 'stopped',
      stopReason: 'stalled',
    });

    renderSearch();

    expect(
      screen.getByText('Stalled').closest('[aria-describedby]'),
    ).toHaveAccessibleDescription('Found nothing better twice in a row.');
  });

  it('shows the search’s spend and when it ran, with no mark when it ran its course', () => {
    detail.mockReturnValue(DETAIL);

    renderSearch();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Search 2' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Finished')).not.toBeInTheDocument();
    expect(
      screen
        .getByRole('link', { name: 'Billing work' })
        .parentElement?.querySelector('[aria-describedby]'),
    ).toHaveAccessibleDescription(/^Started .*, ended /);
    expect(tile('Spent')).toHaveTextContent('$12.00of $20.00');
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

    expect(tileNote('Best')).toHaveAccessibleDescription(
      /^The search aims for more success\./,
    );
  });

  it('says a search aims for the same success rate at a lower cost, naming its cheapest and how its frontier is drawn', () => {
    detail.mockReturnValue({ ...DETAIL, objective: 'cost', best: null });

    renderSearch();

    expect(tileNote('Cheapest')).toHaveAccessibleDescription(
      /^The search aims to maintain the same success rate at a lower cost\. Spotlight ranks candidates by cost per run, considering only those whose success rate matches the live configuration within statistical uncertainty\.$/,
    );
    expect(tile('Cheapest')).toHaveTextContent(
      'No candidate matches the live config’s success yet',
    );
    expect(
      screen.getByText(
        /Frontier: Candidates that match the live configuration’s success rate, within statistical uncertainty/,
      ),
    ).toBeInTheDocument();
  });

  it('shows the cheapest candidate’s cost per run next to the live config’s, with its success rate on hover', () => {
    detail.mockReturnValue({
      ...DETAIL,
      objective: 'cost',
      best: {
        candidateId: 'tests',
        name: 'tests-first',
        isSeed: false,
        searchScore: 0.8,
        searchInterval: null,
        heldOutScore: 0.5,
        heldOutInterval: { rate: 0.5, low: 0.09, high: 0.91 },
        costPerRun: 0.14,
        overfit: null,
        regressions: { searched: 0, heldOut: 0, total: 0 },
        exceedsRegressionLimit: false,
      },
    });

    renderSearch();

    expect(tile('Cheapest')).toHaveTextContent(
      'tests-first$0.14 per run, down from $0.50',
    );
    expect(tileNote('Cheapest')).toHaveAccessibleDescription(
      /Success rate, held out: 50%\. Estimated success rate: 9–91%\.$/,
    );
  });

  it('names the held-out tasks', () => {
    detail.mockReturnValue(DETAIL);

    renderSearch();

    expect(tile('Tasks')).toHaveTextContent('5searched · 2 held out');
    expect(tileNote('Tasks')).toHaveAccessibleDescription(
      /^The search agent only sees the tasks and scores used during the search\..*Held-out tasks \(\d\): .*Retry refunds on timeout\.$/,
    );
  });

  it('says what each iteration tries and which agent searches', () => {
    detail.mockReturnValue(DETAIL);

    renderSearch();

    expect(tileNote('Iterations')).toHaveAccessibleDescription(
      'Each iteration proposes up to 2 candidates. Up to 4 replay runs run in parallel. Each run is replayed once per candidate. Search agent: Claude Code · Opus · High reasoning.',
    );
  });

  it('puts a table behind the frontier chart', () => {
    detail.mockReturnValue(DETAIL);

    renderSearch();

    fireEvent.click(screen.getByRole('button', { name: 'Table' }));

    const table = screen.getByRole('table', {
      name: 'Candidates by success and cost',
    });
    expect(within(table).getByText('Live config')).toBeInTheDocument();
    expect(within(table).getByText('tests-first')).toBeInTheDocument();

    const tests = within(table).getByText('tests-first').closest('tr');
    expect(
      [...(tests?.querySelectorAll('td') ?? [])].map(
        (each) => each.textContent,
      ),
    ).toEqual([
      expect.stringContaining('tests-first'),
      '80%',
      expect.any(String),
    ]);
    expect(
      tests?.querySelector('[data-slot="candidate-rate"]'),
    ).toHaveAccessibleDescription('Likely range: 60–100% · of 5 runs scored');
  });

  it('marks a candidate that gained only on the tasks the search could see', async () => {
    detail.mockReturnValue(DETAIL);

    renderSearch();

    expect(screen.queryByText(/frontier candidate gained only/)).toBeNull();

    expect(
      within(candidateRow('tests-first')).getByRole('img', {
        name: 'Likely overfit',
      }),
    ).toBeInTheDocument();
    expect(
      within(candidateRow('Live config')).queryByRole('img', {
        name: 'Likely overfit',
      }),
    ).toBeNull();

    const opened = await openCandidate('tests-first');
    expect(
      within(opened).getByRole('img', { name: 'Likely overfit' }),
    ).toBeInTheDocument();
    expect(within(opened).queryByRole('note')).toBeNull();
    const results = within(opened).getByRole('table', { name: 'Results' });
    expect(
      within(results)
        .getAllByRole('columnheader')
        .map((each) => each.textContent),
    ).toEqual(['Measure', 'This config', 'Live config', 'Gain']);
    expect(
      within(results)
        .getAllByRole('rowheader')
        .map((each) => each.textContent),
    ).toEqual(['Held out', 'Searched', 'Cost per run', 'Regressions']);
    expect(
      within(opened).getByRole('button', { name: 'Open pull request' }),
    ).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Table' }));

    const table = screen.getByRole('table', {
      name: 'Candidates by success and cost',
    });
    expect(
      within(table)
        .getByText('tests-first')
        .closest('tr')
        ?.querySelector('[data-slot="only-on-seen-tasks"]'),
    ).toHaveAccessibleName('Likely overfit');
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
        isSeed: false,
        searchScore: 0.8,
        searchInterval: null,
        heldOutScore: 1,
        heldOutInterval: null,
        costPerRun: 0.5,
        overfit: 'likely',
        regressions: { searched: 1, heldOut: 0, total: 1 },
        exceedsRegressionLimit: false,
      },
    });

    renderSearch();

    const best = tile('Best');
    expect(best).toHaveTextContent('tests-first100% held out');
    expect(
      within(best).getByRole('img', { name: 'Likely overfit' }),
    ).toBeInTheDocument();
  });

  it('marks a candidate over the line’s regression limit wherever it shows', async () => {
    const [tests] = DETAIL.candidates;
    const over = tests && {
      ...tests,
      regressions: { searched: 2, heldOut: 1, total: 3 },
      exceedsRegressionLimit: true,
    };
    detail.mockReturnValue({
      ...DETAIL,
      candidates: over ? [over] : [],
      best: over && {
        candidateId: over.candidateId,
        name: over.name,
        isSeed: false,
        searchScore: over.searchScore,
        searchInterval: null,
        heldOutScore: over.heldOutScore,
        heldOutInterval: null,
        costPerRun: over.costPerRun,
        overfit: null,
        regressions: over.regressions,
        exceedsRegressionLimit: true,
      },
      maxRegressions: 2,
    });

    renderSearch();

    const mark = { name: 'Over the regression limit' };
    expect(
      within(candidateRow('tests-first')).getByRole('img', mark),
    ).toHaveAccessibleDescription('Regressed: 3 tasks. Line allows: 2.');
    expect(
      within(candidateRow('Live config')).queryByRole('img', mark),
    ).toBeNull();
    expect(within(tile('Best')).getByRole('img', mark)).toBeInTheDocument();

    const opened = await openCandidate('tests-first');
    expect(
      within(opened).getByRole('img', { name: 'Over the regression limit' }),
    ).toBeInTheDocument();
    expect(
      within(opened).getByRole('button', { name: 'Open pull request' }),
    ).toBeEnabled();
    expect(
      document.querySelectorAll('[data-slot="regression-limit"]').length,
    ).toBe(3);

    fireEvent.click(screen.getByRole('button', { name: 'Table' }));

    const table = screen.getByRole('table', {
      name: 'Candidates by success and cost',
    });
    const row = (name: string) =>
      within(table).getByText(name).closest('tr') as HTMLElement;

    expect(
      within(row('tests-first')).getByRole('img', mark),
    ).toBeInTheDocument();
    expect(within(row('Live config')).queryByRole('img', mark)).toBeNull();
  });

  it('says plainly when too few held-out tasks were scored to tell, without marking it', async () => {
    const [tests] = DETAIL.candidates;
    detail.mockReturnValue({
      ...DETAIL,
      candidates: tests ? [{ ...tests, overfit: 'too-few-held-out' }] : [],
    });

    renderSearch();

    const row = candidateRow('tests-first');
    expect(
      within(row).getByRole('img', { name: 'Overfit unknown' }),
    ).toBeInTheDocument();
    expect(
      within(row).queryByRole('img', { name: 'Likely overfit' }),
    ).toBeNull();
    expect(
      within(await openCandidate('tests-first')).queryByRole('note'),
    ).toBeNull();
  });

  it('shows the live config’s score it started from, and the gain that counts as real', () => {
    detail.mockReturnValue(DETAIL);

    renderSearch();

    expect(tile('Live config')).toHaveTextContent('60%of 5 runs scored');
    expect(tileNote('Live config')).toHaveAccessibleDescription(
      'Minimum real gain: +5 pts.',
    );
  });

  it('groups candidates by iteration, opening each for its reasoning, replays and a pick', async () => {
    detail.mockReturnValue({ ...DETAIL, state: 'searching', stopReason: null });

    renderSearch();

    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();

    const rows = within(
      screen.getByRole('list', { name: 'Candidates by iteration' }),
    ).getAllByRole('listitem');
    expect(rows.map((each) => each.textContent?.split(' ')[0])).toEqual([
      'Started',
      'Live',
      'Iteration',
      expect.stringContaining('tests-first'),
      'Iteration',
      'The',
    ]);
    expect(
      within(candidateRow('tests-first')).getByRole('img', {
        name: 'On the frontier',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('The search agent proposed nothing replayable.'),
    ).toBeInTheDocument();

    const opened = await openCandidate('tests-first');
    expect(
      within(opened).getByText('Reading the tests first should help.'),
    ).toBeInTheDocument();
    expect(
      within(opened).getByRole('link', { name: 'Held-out replay' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_1/replays/replay_tests_held_out',
    );
    expect(
      within(opened).getByRole('button', { name: 'Open pull request' }),
    ).toBeEnabled();

    expect(
      within(await openCandidate('Live config')).queryByRole('button', {
        name: 'Open pull request',
      }),
    ).not.toBeInTheDocument();
  });

  it('says the live config is replayed first while there are no candidates', () => {
    detail.mockReturnValue({
      ...DETAIL,
      state: 'seeding',
      stopReason: null,
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

  describe('when a search stalled and looked for why', () => {
    const whyAt = (container: HTMLElement, iteration: number) =>
      container
        .querySelector(
          `[data-slot="why-it-stalled"][data-iteration="${iteration}"]`,
        )
        ?.closest('[data-slot="insights-card"]') as HTMLElement;

    it('groups what it found by cause, says what to do, and links each to its failed replay run', () => {
      detail.mockReturnValue({
        ...DETAIL,
        stopReason: 'stalled',
        iterations: [...DETAIL.iterations, reflection({})],
      });

      const { container } = renderSearch();

      const why = screen.getByRole('region', { name: formatWhyItStalled(3) });
      expect(why).toBe(whyAt(container, 3));
      expect(
        why.querySelector('[data-slot="reflection-incumbent"]'),
      ).toHaveTextContent(
        formatIncumbent({ isSeed: false, name: 'tests-first' }),
      );
      expect(
        why.querySelector('[data-slot="reflection-result"]'),
      ).toHaveTextContent(formatReflectionResult('no-config-cause'));

      const groups = why.querySelectorAll('[data-slot="cause-group"]');
      expect(
        [...groups].map((each) => each.getAttribute('data-cause')),
      ).toEqual(['task', 'judge', 'none']);

      const judge = within(why).getByRole('region', {
        name: formatCauseTitle('judge'),
      });
      expect(
        within(judge).getByText(formatCauseAction('judge')),
      ).toBeInTheDocument();
      expect(
        within(judge).getByText('Require tests only where behaviour changes.'),
      ).toBeInTheDocument();
      expect(
        within(judge).getByRole('link', {
          name: `${OPEN_FAILED_REPLAY}: Retry refunds on timeout`,
        }),
      ).toHaveAttribute('href', '/w/acme/team/team_1/runs/run_r1');

      const task = within(why).getByRole('region', {
        name: formatCauseTitle('task'),
      });
      expect(
        within(task).getByText(formatCauseAction('task')),
      ).toBeInTheDocument();

      const none = within(why).getByRole('region', { name: UNCAUSED_TITLE });
      expect(
        within(none).getByRole('link', {
          name: `${OPEN_FAILED_REPLAY}: Task task_3`,
        }),
      ).toHaveAttribute('href', '/w/acme/team/team_1/runs/run_r3');
    });

    it('says the search continued when the config could still fix some', () => {
      detail.mockReturnValue({
        ...DETAIL,
        state: 'searching',
        stopReason: null,
        iterations: [
          ...DETAIL.iterations,
          reflection({
            result: 'continued',
            endedSearch: false,
            causes: [
              {
                taskId: 'task_2',
                originalRunId: 'run_2',
                replayRunId: 'run_r2',
                cause: 'config',
                evidence: 'The prompt never mentions the retry policy.',
                suggestion: null,
                recordedAt: '2026-10-01T11:00:00.000Z',
              },
            ],
          }),
        ],
      });

      const { container } = renderSearch();

      const why = whyAt(container, 3);
      expect(
        why.querySelector('[data-slot="reflection-result"]'),
      ).toHaveTextContent(formatReflectionResult('continued'));
      expect(
        within(why).getByText(formatCauseAction('config')),
      ).toBeInTheDocument();
    });

    it('says it is still looking while the reflection runs', () => {
      detail.mockReturnValue({
        ...DETAIL,
        state: 'searching',
        stopReason: null,
        iterations: [
          ...DETAIL.iterations,
          reflection(
            { causes: [], result: null, endedSearch: false },
            'running',
          ),
        ],
      });

      const { container } = renderSearch();

      const why = whyAt(container, 3);
      expect(within(why).getByText(REFLECTION_LOOKING)).toBeInTheDocument();
      expect(
        why.querySelector('[data-slot="cause-group"]'),
      ).not.toBeInTheDocument();
    });

    it('shows the reflection apart from the iterations that proposed candidates, linking to its own section', () => {
      detail.mockReturnValue({
        ...DETAIL,
        stopReason: 'stalled',
        iterations: [...DETAIL.iterations, reflection({})],
      });

      const { container } = renderSearch();

      const reflected = container.querySelector(
        '[data-slot="iteration"][data-kind="reflect"]',
      ) as HTMLElement;
      const note = reflected.nextElementSibling as HTMLElement;
      expect(
        within(reflected).getByText(`· ${REFLECTION_KIND}`),
      ).toBeInTheDocument();
      expect(
        within(reflected).queryByText(/The search took/),
      ).not.toBeInTheDocument();
      expect(note).toHaveAttribute('data-slot', 'iteration-note');
      expect(
        within(note).getByText(formatReflectionIteration(3, 2)),
      ).toBeInTheDocument();
      expect(
        within(note).getByRole('link', { name: SEE_WHY_IT_STALLED }),
      ).toHaveAttribute('href', `#${whyItStalledAnchor(3)}`);
    });

    it('shows every reflection, newest first, each iteration linking to its own', () => {
      detail.mockReturnValue({
        ...DETAIL,
        stopReason: 'stalled',
        iterations: [
          ...DETAIL.iterations,
          reflection({ result: 'continued', endedSearch: false }),
          {
            ...reflection({}),
            number: 6,
            runId: 'run_search_6',
          },
        ],
      });

      const { container } = renderSearch();

      const sections = container.querySelectorAll(
        '[data-slot="why-it-stalled"]',
      );
      expect(
        [...sections].map((each) => each.getAttribute('data-iteration')),
      ).toEqual(['6', '3']);
      expect(screen.getByRole('region', { name: formatWhyItStalled(6) })).toBe(
        whyAt(container, 6),
      );

      const links = [
        ...container.querySelectorAll(
          '[data-slot="iteration-note"] a[href^="#"]',
        ),
      ].map((each) => each.getAttribute('href'));
      expect(links).toEqual([
        `#${whyItStalledAnchor(3)}`,
        `#${whyItStalledAnchor(6)}`,
      ]);
      for (const link of links) {
        expect(container.querySelector(link as string)).not.toBeNull();
      }
    });

    it('says when its agent’s run failed before it recorded a cause', () => {
      detail.mockReturnValue({
        ...DETAIL,
        stopReason: 'stalled',
        iterations: [
          ...DETAIL.iterations,
          reflection(
            { causes: [], incumbent: 'seed', result: 'did-not-run' },
            'failed',
          ),
        ],
      });

      const { container } = renderSearch();

      const why = whyAt(container, 3);
      expect(
        why.querySelector('[data-slot="reflection-incumbent"]'),
      ).toHaveTextContent(formatIncumbent({ isSeed: true, name: 'seed' }));
      expect(
        why.querySelector('[data-slot="reflection-result"]'),
      ).toHaveTextContent(formatReflectionResult('did-not-run'));
    });
  });

  it('has no why-it-stalled section when it never looked', () => {
    detail.mockReturnValue(DETAIL);

    const { container } = renderSearch();

    expect(
      container.querySelector('[data-slot="why-it-stalled"]'),
    ).not.toBeInTheDocument();
  });
});
