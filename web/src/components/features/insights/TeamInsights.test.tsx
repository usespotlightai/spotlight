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

type Held = {
  data: unknown;
  isPending: boolean;
  isFetching: boolean;
  errorUpdateCount: number;
  refetch: () => void;
};

const held = (data: unknown): Held => ({
  data,
  isPending: data === undefined,
  isFetching: false,
  errorUpdateCount: 0,
  refetch: vi.fn(),
});

const asked: { tab: string; period: InsightsPeriod }[] = [];
const answers: Record<string, Held> = {};

const answering =
  (tab: string) => (_teamId: string, period: InsightsPeriod) => {
    asked.push({ tab, period });
    return answers[tab] ?? held(undefined);
  };

vi.mock('@/hooks/api/useInsightsOverview', () => ({
  useInsightsOverview: (teamId: string, period: InsightsPeriod) =>
    answering('overview')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsFlow', () => ({
  useInsightsFlow: (teamId: string, period: InsightsPeriod) =>
    answering('flow')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsStations', () => ({
  useInsightsStations: (teamId: string, period: InsightsPeriod) =>
    answering('stations')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsPeople', () => ({
  useInsightsPeople: (teamId: string, period: InsightsPeriod) =>
    answering('people')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsCost', () => ({
  useInsightsCost: (teamId: string, period: InsightsPeriod) =>
    answering('cost')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsRuns', () => ({
  useInsightsRuns: (teamId: string, period: InsightsPeriod) =>
    answering('runs')(teamId, period),
}));
vi.mock('@/hooks/api/useInsightsCandidates', () => ({
  useInsightsCandidates: (teamId: string, period: InsightsPeriod) =>
    answering('candidates')(teamId, period),
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
  touches: 30,
  touchesPerTask: 3,
  activePeople: 4,
  mergedTaskIds: [],
  peopleIds: [],
  ...over,
});

const OVERVIEW = {
  period: { name: '7d' },
  headline: headline(),
  before: headline({ mergedPullRequests: 4 }),
  output: [
    {
      day: '2026-09-30',
      runs: 5,
      spend: { amount: 4.2, currency: 'USD' },
      merged: 1,
      mergedTaskIds: [],
    },
  ],
  outputCurrency: 'USD',
  outputMixedCurrencies: false,
  configChanges: [],
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
    cache: { input: null, cacheRead: null, cacheWrite: null, cacheShare: null },
    cacheByStation: [],
  },
  spendBefore: null,
  mixedCurrenciesBefore: false,
  truncated: false,
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
          path="/w/:slug/team/:teamId/:section"
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

beforeEach(() => {
  asked.length = 0;
  for (const tab of Object.keys(answers)) {
    delete answers[tab];
  }
  answers.overview = held(OVERVIEW);
});

describe('TeamInsights', () => {
  it('opens the tab and period the address names', () => {
    showing('?tab=cost&period=7d');

    expect(
      screen.getByRole('link', { name: 'Cost', current: 'page' }),
    ).toBeInTheDocument();
    expect(asked).toContainEqual({ tab: 'cost', period: '7d' });
    expect(asked.some((each) => each.tab === 'overview')).toBe(false);
  });

  it('opens the Candidates tab the address names, for its period alone', () => {
    showing('?tab=candidates&period=90d');

    expect(
      screen.getByRole('link', { name: 'Candidates', current: 'page' }),
    ).toBeInTheDocument();
    expect(asked).toContainEqual({ tab: 'candidates', period: '90d' });
    expect(asked.some((each) => each.tab === 'overview')).toBe(false);
    expect(
      screen.getByRole('status', { name: 'Loading the candidates' }),
    ).toBeInTheDocument();
  });

  it('keeps the period when moving between tabs', async () => {
    showing('?period=7d');

    await userEvent.click(screen.getByRole('link', { name: 'Flow' }));

    expect(address()).toHaveTextContent('?tab=flow&period=7d');
    expect(asked.at(-1)).toEqual({ tab: 'flow', period: '7d' });
  });

  it('sets this period’s headline against the last', () => {
    showing();

    const tiles = screen.getByLabelText('Headline numbers');
    const merged = within(tiles)
      .getByText('PRs merged')
      .closest('[data-slot="insights-tile"]') as HTMLElement;

    expect(merged).toHaveTextContent('8');
    expect(merged.querySelector('[data-slot="delta"]')).toHaveTextContent(
      '+100% vs last period',
    );
  });

  it('drills from each headline number into the tab behind it, keeping the period', () => {
    showing('?period=90d');

    expect(screen.getByRole('link', { name: '$120.00' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=runs&period=90d',
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
      '/w/acme/team/team_1/insights?tab=runs&stationId=station_build',
    );
    expect(
      within(station).getByRole('link', { name: 'Improve this station' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/agent');
    expect(station).toHaveTextContent('Sent back 30% (was 10%, team 15%)');
  });

  it('holds the shape of the overview while it loads', () => {
    answers.overview = held(undefined);

    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the overview' }),
    ).toBeInTheDocument();
  });

  it('says the overview could not be loaded, and tries again', async () => {
    const failing = {
      ...held(undefined),
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
    answers.overview = held({
      ...OVERVIEW,
      headline: headline({ runs: 0, mergedPullRequests: 0 }),
    });

    showing();

    expect(screen.getByText('No runs in this period')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a task' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1',
    );
  });

  it('says plainly why there is no spend to break down', () => {
    answers.cost = held({
      ...MIXED_COST,
      cost: { ...MIXED_COST.cost, mixedCurrencies: true },
    });

    showing('?tab=cost');

    expect(
      screen.getByText('Prices came in more than one currency'),
    ).toBeInTheDocument();
  });

  it('leaves daily spend out of the overview, saying why, when the period’s prices came in more than one currency', () => {
    answers.overview = held({
      ...OVERVIEW,
      outputCurrency: null,
      outputMixedCurrencies: true,
    });

    showing();

    expect(
      screen.getByText(
        'Merged pull requests per day. Prices came in more than one currency, so spend is left out.',
      ),
    ).toBeInTheDocument();
  });

  it('says when nothing in the period was priced', () => {
    answers.cost = held({
      ...MIXED_COST,
      cost: { ...MIXED_COST.cost, unpriced: 3 },
    });

    showing('?tab=cost');

    expect(screen.getByText('Nothing was priced')).toBeInTheDocument();
  });

  it('reads cache share as not reported where it is unknown', () => {
    answers.cost = held({
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
            cacheShare: 0.75,
          },
        ],
      },
    });

    showing('?tab=cost');

    const tile = screen
      .getByText('Cache share', { selector: 'dt' })
      .closest('[data-slot="insights-tile"]');
    expect(tile).toHaveTextContent('not reported');
    expect(
      within(
        screen.getByRole('table', { name: 'Cache share by station' }),
      ).getAllByRole('row')[1],
    ).toHaveTextContent('Implementation75%300not reported100');
  });

  it('notes when only the latest runs were counted', () => {
    answers.overview = held({ ...OVERVIEW, truncated: true });

    showing();

    expect(screen.getByRole('note')).toHaveTextContent(
      'Only the latest 20,000 runs',
    );
  });

  it('drills from people’s load into the runs that asked them', () => {
    answers.people = held({
      period: { name: '30d' },
      truncated: false,
      load: {
        asks: 4,
        tasks: 2,
        asksPerTask: 2,
        toAnswer: { p50Ms: 60_000, p90Ms: 60_000, count: 4 },
        unanswered: 0,
        sentBack: 1,
        sentBackRate: 0.5,
        refused: 1,
        askedTaskIds: [],
        refusedTaskIds: [],
      },
      loadBefore: {
        asks: 0,
        tasks: 0,
        asksPerTask: null,
        toAnswer: { p50Ms: null, p90Ms: null, count: 0 },
        unanswered: 0,
        sentBack: 0,
        sentBackRate: null,
        refused: 0,
        askedTaskIds: [],
        refusedTaskIds: [],
      },
      adoption: {
        active: ['user_1'],
        activeBefore: [],
        newAdopters: [],
        weekly: [],
        monthly: [],
        stickiness: null,
        people: [],
      },
      people: [],
    });

    showing('?tab=people');

    expect(screen.getByRole('link', { name: '2.0' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=runs&asked=true',
    );
    expect(screen.getByRole('link', { name: '50%' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=runs&next=sent-back',
    );
    expect(screen.getByRole('link', { name: '1' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=runs&next=refused',
    );
  });
});
