import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamInsights } from '@/components/features/insights/TeamInsights';
import type { InsightsTools } from '@/lib/insights-tools';

type Held = {
  data: unknown;
  isPending: boolean;
  isFetching: boolean;
  errorUpdateCount: number;
  refetch: () => void;
};

const held = (data: unknown, errorUpdateCount = 0): Held => ({
  data,
  isPending: data === undefined && errorUpdateCount === 0,
  isFetching: false,
  errorUpdateCount,
  refetch: vi.fn(),
});

const answer: { tools: Held } = { tools: held(undefined) };

vi.mock('@/hooks/api/useInsightsTools', () => ({
  useInsightsTools: () => answer.tools,
}));
vi.mock('@/hooks/api/useLines', () => ({ useLines: () => ({ data: [] }) }));

const TOOLS = {
  period: { name: '30d' },
  truncated: false,
  weeks: ['2026-09-21', '2026-09-28'],
  runs: 12,
  trendRule: { recentWeeks: 2, fewestRuns: 5, shiftPoints: 20 },
  skills: [
    {
      key: 'our-migrations',
      defined: true,
      given: 8,
      used: 5,
      weeks: [
        { week: '2026-09-21', runs: 6, given: 4, used: 1 },
        { week: '2026-09-28', runs: 6, given: 4, used: 4 },
      ],
      trend: 'spreading',
      stations: [
        {
          lineId: 'line_1',
          stationId: 'station_impl',
          runs: 10,
          given: 8,
          used: 5,
          trend: 'spreading',
        },
      ],
    },
    {
      key: 'borrowed',
      defined: false,
      given: 0,
      used: 1,
      weeks: [
        { week: '2026-09-21', runs: 6, given: 0, used: 0 },
        { week: '2026-09-28', runs: 6, given: 0, used: 1 },
      ],
      trend: null,
      stations: [],
    },
  ],
  unused: ['incident-runbook'],
  servers: [
    {
      server: 'linear',
      runs: 4,
      calls: 10,
      callsPerRun: 2.5,
      p50Ms: 420,
      p95Ms: 2_100,
      failedCalls: 1,
      errorRate: 0.1,
      failingRuns: 1,
      refused: 2,
    },
  ],
  refusals: [
    { tool: 'create_issue', server: 'linear', refused: 2 },
    { tool: 'github.merge', server: null, refused: 1 },
  ],
} as unknown as InsightsTools;

const EMPTY = {
  ...TOOLS,
  skills: [],
  unused: [],
  servers: [],
  refusals: [],
} as unknown as InsightsTools;

const showing = (search = '?tab=tools') =>
  render(
    <MemoryRouter initialEntries={[`/w/acme/team/team_1/insights${search}`]}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/insights"
          element={<TeamInsights slug="acme" teamId="team_1" />}
        />
      </Routes>
    </MemoryRouter>,
  );

const RUNS = '/w/acme/team/team_1/insights?tab=runs';

beforeEach(() => {
  answer.tools = held(TOOLS);
});

describe('the Tools tab', () => {
  it('is a tab of Insights', () => {
    showing();

    expect(screen.getByRole('link', { name: 'Tools' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=tools',
    );
  });

  it('shows a faithful skeleton while it loads', () => {
    answer.tools = held(undefined);

    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the tools' }),
    ).toBeInTheDocument();
  });

  it('offers to try again where it could not load', async () => {
    answer.tools = held(undefined, 1);

    showing();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(answer.tools.refetch).toHaveBeenCalled();
  });

  it('leads to creating a task where no run ran', () => {
    answer.tools = held({ ...EMPTY, runs: 0 });

    showing();

    expect(screen.getByText('No runs in this period')).toBeInTheDocument();
  });

  it('leads to the team’s skills where runs used no skill or server', () => {
    answer.tools = held(EMPTY);

    showing();

    expect(
      screen.getByRole('link', { name: 'See the team’s skills' }),
    ).toHaveAttribute('href', '/w/acme/settings/team/team_1/skills');
  });

  it('shows each skill’s use as its own small chart, marking spreading and saying the rule', () => {
    showing();

    const multiples = screen.getByRole('list', { name: 'Skill use by week' });
    const migrations = within(multiples)
      .getByRole('link', { name: 'our-migrations' })
      .closest('[data-slot="skill-multiple"]') as HTMLElement;

    expect(
      multiples.querySelectorAll('[data-slot="skill-multiple"]'),
    ).toHaveLength(2);
    expect(
      migrations.querySelector('[data-slot="skill-trend"]'),
    ).toHaveAttribute('data-trend', 'spreading');
    expect(
      screen.getByText(/moved 20 points or more over the last 2 weeks/),
    ).toBeInTheDocument();
  });

  it('links a defined skill to its page under the team’s skills, and opens the runs behind its numbers', () => {
    showing();

    const multiples = screen.getByRole('list', { name: 'Skill use by week' });

    expect(
      within(multiples).getByRole('link', { name: 'our-migrations' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/settings/team/team_1/skills#skill-our-migrations',
    );
    expect(
      within(multiples).queryByRole('link', { name: 'borrowed' }),
    ).toBeNull();
    expect(within(multiples).getByRole('link', { name: '5' })).toHaveAttribute(
      'href',
      `${RUNS}&skillUsed=our-migrations`,
    );
    expect(within(multiples).getByRole('link', { name: '8' })).toHaveAttribute(
      'href',
      `${RUNS}&skillGiven=our-migrations`,
    );
  });

  it('opens a skill’s runs for a week from its table', async () => {
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Show table' }));

    const table = screen.getByRole('table', {
      name: 'Runs that read each skill, week by week',
    });

    expect(within(table).getByRole('link', { name: '4' })).toHaveAttribute(
      'href',
      `${RUNS}&week=2026-09-28&skillUsed=our-migrations`,
    );
  });

  it('lists defined skills no run read', () => {
    showing();

    expect(
      within(screen.getByRole('list', { name: 'Unused skills' })).getByRole(
        'link',
        { name: 'incident-runbook' },
      ),
    ).toHaveAttribute(
      'href',
      '/w/acme/settings/team/team_1/skills#skill-incident-runbook',
    );
  });

  it('shows each MCP server’s runs, calls per run, latency, error rate and failing runs, each opening its runs', () => {
    showing();

    const table = screen.getByRole('table', {
      name: 'How each MCP server behaved',
    });
    const row = within(table).getByText('linear').closest('tr') as HTMLElement;

    expect(within(row).getByRole('link', { name: '4' })).toHaveAttribute(
      'href',
      `${RUNS}&server=linear`,
    );
    expect(within(row).getByRole('link', { name: '2.5' })).toHaveAttribute(
      'href',
      `${RUNS}&server=linear`,
    );
    expect(within(row).getByRole('link', { name: '2s' })).toHaveAttribute(
      'href',
      `${RUNS}&server=linear`,
    );
    expect(within(row).getByRole('link', { name: '10%' })).toHaveAttribute(
      'href',
      `${RUNS}&serverFailed=linear`,
    );
    expect(within(row).getByRole('link', { name: '1' })).toHaveAttribute(
      'href',
      `${RUNS}&failedAfter=linear`,
    );
    expect(within(row).getByRole('link', { name: '2' })).toHaveAttribute(
      'href',
      `${RUNS}&refusedServer=linear`,
    );
  });

  it('counts refused approvals per tool of each server, opening the runs they were refused for', () => {
    showing();

    const table = screen.getByRole('table', {
      name: 'Refused approvals per tool',
    });

    expect(within(table).getByRole('link', { name: '2' })).toHaveAttribute(
      'href',
      `${RUNS}&refusedTool=create_issue&refusedServer=linear`,
    );
    expect(within(table).getByRole('link', { name: '1' })).toHaveAttribute(
      'href',
      `${RUNS}&refusedTool=github.merge&refusedServer=none`,
    );
  });
});
