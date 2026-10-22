import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamInsights } from '@/components/features/insights/TeamInsights';
import type {
  Headline,
  InsightsCost,
  InsightsOverview,
  InsightsPeriod,
} from '@/lib/insights';

type Queried = {
  data: unknown;
  isPending: boolean;
  isFetching: boolean;
  errorUpdateCount: number;
  refetch: () => void;
};

const queried = (data: unknown): Queried => ({
  data,
  isPending: data === undefined,
  isFetching: false,
  errorUpdateCount: 0,
  refetch: vi.fn(),
});

const requested: { tab: string; period: InsightsPeriod }[] = [];
const answers: Record<string, Queried> = {};

const answering =
  (tab: string) => (_teamId: string, period: InsightsPeriod) => {
    requested.push({ tab, period });
    return answers[tab] ?? queried(undefined);
  };

vi.mock('@/hooks/api/useInsightsOverview', () => ({
  useInsightsOverview: (teamId: string, period: InsightsPeriod) =>
    answering('overview')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsCost', () => ({
  useInsightsCost: (teamId: string, period: InsightsPeriod) =>
    answering('cost')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsPeople', () => ({
  useInsightsPeople: (teamId: string, period: InsightsPeriod) =>
    answering('people')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsFlow', () => ({
  useInsightsFlow: (teamId: string, period: InsightsPeriod) =>
    answering('flow')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsPullRequests', () => ({
  useInsightsPullRequests: (teamId: string, period: InsightsPeriod) =>
    answering('pull-requests')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsShipping', () => ({
  useInsightsShipping: (teamId: string, period: InsightsPeriod) =>
    answering('shipping')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsStations', () => ({
  useInsightsStations: (teamId: string, period: InsightsPeriod) =>
    answering('stations')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsChanges', () => ({
  useInsightsChanges: (teamId: string, period: InsightsPeriod) =>
    answering('changes')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsAgentConfigs', () => ({
  useInsightsAgentConfigs: (teamId: string, period: InsightsPeriod) =>
    answering('agent-configs')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsCandidates', () => ({
  useInsightsCandidates: (teamId: string, period: InsightsPeriod) =>
    answering('candidates')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsTools', () => ({
  useInsightsTools: (teamId: string, period: InsightsPeriod) =>
    answering('tools')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsMemory', () => ({
  useInsightsMemory: (teamId: string, period: InsightsPeriod) =>
    answering('memory')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsRuns', () => ({
  useInsightsRuns: (teamId: string, period: InsightsPeriod) =>
    answering('runs')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsPullRequestList', () => ({
  useInsightsPullRequestList: () => queried(undefined),
}));
vi.mock('@/hooks/api/useConfigOrigins', () => ({
  useConfigOrigins: () => ({ origins: [], failed: false, retry: vi.fn() }),
}));
vi.mock('@/hooks/api/useStationInsights', () => ({
  useStationInsights: () => queried(undefined),
}));
vi.mock('@/hooks/api/useStationJudge', () => ({
  useStationJudge: () => queried(undefined),
}));
vi.mock('@/hooks/api/useStation', () => ({
  useStation: () => ({ station: undefined }),
}));
vi.mock('@/components/features/trace/list/TraceList', () => ({
  TraceList: ({ range }: { range: string }) => <p>Traces over {range}</p>,
}));
vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({ data: [] }),
}));
vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({
    data: [
      {
        id: 'line_1',
        key: 'delivery',
        name: 'Delivery',
        reactions: [],
        repositories: [],
        stations: [
          {
            id: 'station_build',
            key: 'build',
            name: 'Implementation',
            position: 1,
            color: '#5c66d9',
            kind: 'work',
          },
        ],
      },
    ],
  }),
}));

const HOUR = 3_600_000;

const headline = (over: Partial<Headline> = {}): Headline => ({
  spend: { amount: 120, currency: 'USD' },
  unpriced: 0,
  mixedCurrencies: false,
  runs: 40,
  tasks: 10,
  mergedPullRequests: 8,
  closedPullRequests: 2,
  mergeRate: 0.8,
  costPerMerge: { amount: 15, currency: 'USD' },
  taskToMerge: { p50Ms: 26 * HOUR, p90Ms: 72 * HOUR, count: 8 },
  humanActions: 30,
  humanActionsPerTask: 3,
  activePeople: 4,
  mergedTaskIds: [],
  peopleIds: [],
  ...over,
});

const OVERVIEW = {
  period: { name: '7d' },
  headline: headline(),
  changes: {
    spend: null,
    mergedPullRequests: {
      unit: 'percent',
      by: 1,
      fromZero: false,
      direction: 'up',
      tone: 'good',
    },
    mergeRate: null,
    costPerMerge: null,
    taskToMerge: null,
    humanActionsPerTask: null,
    activePeople: null,
  },
  output: [
    {
      day: '2026-09-30',
      runs: 5,
      spend: { amount: 4.2, currency: 'USD' },
      merged: 1,
      mergedTaskIds: [],
      changes: [],
    },
  ],
  outputCurrency: 'USD',
  outputMixedCurrencies: false,
  worthImproving: [
    {
      lineId: 'line_1',
      stationId: 'station_build',
      runs: 12,
      signals: [
        {
          signal: 'sent-back',
          now: 0.3,
          before: 0.1,
          team: 0.15,
          rose: true,
          trails: true,
          flaggedAbove: 0.15,
          currency: null,
        },
      ],
      worstBy: 3,
      mixedCurrencies: false,
    },
  ],
  people: [],
} as unknown as InsightsOverview;

const MIXED_COST = {
  period: { name: '30d' },
  cost: {
    spend: null,
    unpriced: 0,
    byHarness: [],
    byModel: [],
    byStation: [],
    byRepository: [],
    mixedCurrencies: false,
    nodes: [],
    links: [],
    cache: { input: null, cacheRead: null, cacheWrite: null, cacheRate: null },
    cacheByStation: [],
  },
  spendChange: null,
} as unknown as InsightsCost;

function Address() {
  const location = useLocation();
  return <output aria-label="Address">{location.search}</output>;
}

const showing = (search = '') =>
  render(
    <MemoryRouter initialEntries={[`/w/acme/team/team_1/insights${search}`]}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/insights"
          element={
            <>
              <TeamInsights slug="acme" teamId="team_1" />
              <Address />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

const address = () => screen.getByRole('status', { name: 'Address' });

const tabs = () => screen.getByRole('navigation', { name: 'Insights' });

const tabsRequested = () => requested.map((each) => each.tab);

const sections = () =>
  [...document.querySelectorAll('[data-slot="insights-section"] > h2')].map(
    (heading) => heading.textContent,
  );

beforeEach(() => {
  requested.length = 0;
  for (const tab of Object.keys(answers)) {
    delete answers[tab];
  }
  answers.overview = queried(OVERVIEW);
});

describe('TeamInsights', () => {
  it('opens the tab and period the address names', () => {
    showing('?tab=cost&period=7d');

    expect(
      screen.getByRole('link', { name: 'Cost', current: 'page' }),
    ).toBeInTheDocument();
    expect(requested).toContainEqual({ tab: 'cost', period: '7d' });
    expect(requested.some((each) => each.tab === 'overview')).toBe(false);
  });

  it('lists the seven tabs, Overview first', () => {
    showing();

    expect(
      within(tabs())
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Overview',
      'Cost',
      'People',
      'Productivity',
      'Stations',
      'Tools and skills',
      'Traces',
    ]);
    expect(
      within(tabs()).getByRole('link', { name: 'Overview', current: 'page' }),
    ).toBeInTheDocument();
  });

  it('opens the overview where the address names a tab Insights no longer has', () => {
    showing('?tab=candidates&period=90d');

    expect(
      within(tabs()).getByRole('link', { name: 'Overview', current: 'page' }),
    ).toBeInTheDocument();
    expect(requested).toEqual([{ tab: 'overview', period: '90d' }]);
  });

  it('shows runs at each station, config changes and candidates on the Stations tab, all over the period', () => {
    showing('?tab=stations&period=90d');

    expect(sections()).toEqual([
      'Runs at each station',
      'Config changes',
      'Candidates',
    ]);
    expect(requested).toEqual(
      expect.arrayContaining([
        { tab: 'stations', period: '90d' },
        { tab: 'changes', period: '90d' },
        { tab: 'candidates', period: '90d' },
      ]),
    );
    expect(
      screen.getByRole('status', { name: 'Loading the stations' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading the changes' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading the candidates' }),
    ).toBeInTheDocument();
  });

  it('opens one station alone where the address names it', () => {
    showing('?tab=stations&stationId=station_build');

    expect(
      within(tabs()).getByRole('link', { name: 'Stations', current: 'page' }),
    ).toBeInTheDocument();
    expect(sections()).toEqual([]);
    expect(tabsRequested()).toEqual(['stations']);
  });

  it('shows where work waits, what the agents ship and the pull requests on the Productivity tab', () => {
    showing('?tab=productivity&period=7d');

    expect(sections()).toEqual([
      'Where work waits',
      'What the agents ship',
      'Review and approval',
      'Pull requests',
    ]);
    expect(requested).toEqual(
      expect.arrayContaining([
        { tab: 'flow', period: '7d' },
        { tab: 'shipping', period: '7d' },
        { tab: 'pull-requests', period: '7d' },
      ]),
    );
    expect(
      screen.getByRole('status', { name: 'Loading what the agents ship' }),
    ).toBeInTheDocument();
  });

  it('shows skills, tools and memory on the Tools and skills tab', () => {
    showing('?tab=tools&period=7d');

    expect(sections()).toEqual(['Skills and tools', 'Memory']);
    expect(requested).toEqual(
      expect.arrayContaining([
        { tab: 'tools', period: '7d' },
        { tab: 'memory', period: '7d' },
      ]),
    );
    expect(
      screen.getByRole('status', { name: 'Loading the tools' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading the memory' }),
    ).toBeInTheDocument();
  });

  it('collapses a section and expands it again', async () => {
    showing('?tab=tools');

    const memory = screen.getByRole('button', { name: 'Memory' });
    await userEvent.click(memory);

    expect(memory).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('status', { name: 'Loading the memory' }),
    ).not.toBeInTheDocument();

    await userEvent.click(memory);

    expect(
      screen.getByRole('status', { name: 'Loading the memory' }),
    ).toBeInTheDocument();
  });

  it('lists the team’s traces over the period, as a tab of their own', () => {
    showing('?tab=traces&period=7d');

    expect(screen.getByRole('link', { name: 'Traces' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByText('Traces over 7d')).toBeInTheDocument();
  });

  it('keeps the period when moving between tabs', async () => {
    showing('?period=7d');

    await userEvent.click(
      within(tabs()).getByRole('link', { name: 'Stations' }),
    );

    expect(address()).toHaveTextContent('?tab=stations&period=7d');
    expect(requested).toContainEqual({ tab: 'stations', period: '7d' });
  });

  it('keeps the period but drops the filters and page when moving to another tab', () => {
    showing('?tab=productivity&period=90d&state=merged&page=2');

    expect(
      within(tabs()).getByRole('link', { name: 'Traces' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=traces&period=90d',
    );
    expect(
      within(tabs()).getByRole('link', { name: 'Overview' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/insights?period=90d');
  });

  it('sets this period’s headline against the last', () => {
    showing();

    const tiles = screen.getByLabelText('Headline numbers');
    const merged = within(tiles)
      .getByText('PRs merged')
      .closest('[data-slot="insights-tile"]') as HTMLElement;

    expect(merged).toHaveTextContent('8');
    const delta = merged.querySelector('[data-slot="delta"]');
    expect(delta).toHaveTextContent('+100%');
    expect(delta).toHaveAttribute('data-tone', 'good');
  });

  it('drills from each headline number into the tab behind it, keeping the period', () => {
    showing('?period=90d');

    expect(screen.getByRole('link', { name: '$120.00' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=traces&period=90d',
    );
    expect(screen.getByRole('link', { name: '4' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=people&period=90d',
    );
  });

  it('leads a station worth improving to its page, its runs and the agent', () => {
    showing();

    const station = screen.getByRole('list', {
      name: 'Stations worth improving',
    });

    expect(
      within(station).getByRole('link', { name: 'Implementation' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_build',
    );
    expect(
      within(station).getByRole('link', { name: '12 runs' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=traces&stationId=station_build',
    );
    expect(
      within(station).getByRole('link', { name: 'Improve' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/agent');
    expect(
      within(station).getByRole('img', {
        name: 'Sent back 30% (was 10%, all stations 15%)',
      }),
    ).toBeInTheDocument();
  });

  it('keeps the shape of the overview while it loads', () => {
    answers.overview = queried(undefined);

    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the overview' }),
    ).toBeInTheDocument();
  });

  it('says the overview could not be loaded, and tries again', async () => {
    const failing = {
      ...queried(undefined),
      isPending: true,
      errorUpdateCount: 1,
    };
    answers.overview = failing;

    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The overview could not be loaded.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(failing.refetch).toHaveBeenCalled();
  });

  it('says there were no runs in the period, and offers the board', () => {
    answers.overview = queried({
      ...OVERVIEW,
      headline: headline({ runs: 0, mergedPullRequests: 0 }),
    });

    showing();

    expect(screen.getByText('No runs')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a task' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1',
    );
  });

  it('says plainly why there is no spend to break down', () => {
    answers.cost = queried({
      ...MIXED_COST,
      cost: { ...MIXED_COST.cost, mixedCurrencies: true },
    });

    showing('?tab=cost');

    expect(
      screen.getByText('Prices in more than one currency'),
    ).toBeInTheDocument();
  });

  it('leaves daily spend out of the overview, saying why, when the period’s prices came in more than one currency', () => {
    answers.overview = queried({
      ...OVERVIEW,
      outputCurrency: null,
      outputMixedCurrencies: true,
    });

    showing();

    expect(
      screen.getByText(
        'Merged pull requests per day. Spend not shown. Prices in more than one currency.',
      ),
    ).toBeInTheDocument();
  });

  it('says when nothing in the period was priced', () => {
    answers.cost = queried({
      ...MIXED_COST,
      cost: { ...MIXED_COST.cost, unpriced: 3 },
    });

    showing('?tab=cost');

    expect(screen.getByText('No priced runs')).toBeInTheDocument();
  });

  it('reads cache share as not reported where it is unknown', () => {
    answers.cost = queried({
      ...MIXED_COST,
      cost: {
        ...MIXED_COST.cost,
        unpriced: 3,
        cacheByStation: [
          {
            stationId: 'station_build',
            input: 100,
            cacheRead: 300,
            cacheWrite: null,
            cacheRate: 0.75,
          },
        ],
      },
    });

    showing('?tab=cost');

    const tile = within(screen.getByLabelText('Spend'))
      .getByText('Cache share')
      .closest('[data-slot="insights-tile"]');
    expect(tile).toHaveTextContent('not reported');
    expect(
      within(
        screen.getByRole('list', { name: 'Cache share by station' }),
      ).getAllByRole('listitem')[0],
    ).toHaveTextContent(
      'ImplementationCache share75%Cache read300Cache writenot reportedInput100',
    );
  });

  it('drills from people’s load into the runs that asked them', () => {
    answers.people = queried({
      period: { name: '30d' },
      load: {
        asks: 4,
        tasks: 2,
        asksPerTask: 2,
        toAnswer: { p50Ms: 60_000, p90Ms: 60_000, count: 4 },
        unanswered: 0,
        sentBack: 1,
        sentBackRate: 0.5,
        dismissed: 1,
        askedTaskIds: [],
        dismissedTaskIds: ['task_9'],
      },
      loadChanges: {
        asksPerTask: null,
        toAnswer: null,
        sentBackRate: null,
        dismissed: null,
      },
      adoption: {
        activeCount: 1,
        activeChange: null,
        newAdopterCount: 0,
        weeklyCount: 0,
        monthlyCount: 0,
        stickiness: null,
        people: [],
      },
    });

    showing('?tab=people');

    expect(screen.getByRole('link', { name: '2.0' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=traces&asked=true',
    );
    expect(screen.getByRole('link', { name: '50%' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=traces&humanAction=sent-back',
    );
    expect(screen.getByRole('link', { name: '1' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=traces&taskIds=task_9',
    );
  });
});
