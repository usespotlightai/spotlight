import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolsTab } from '@/components/features/insights/tools/ToolsTab';
import { stationNamesOf } from '@/lib/insights';
import type { InsightsTools } from '@/lib/insights-tools';

type Queried = {
  data: unknown;
  isPending: boolean;
  isFetching: boolean;
  errorUpdateCount: number;
  refetch: () => void;
};

const queried = (data: unknown, errorUpdateCount = 0): Queried => ({
  data,
  isPending: data === undefined && errorUpdateCount === 0,
  isFetching: false,
  errorUpdateCount,
  refetch: vi.fn(),
});

const answer: { tools: Queried } = { tools: queried(undefined) };

vi.mock('@/hooks/api/useInsightsTools', () => ({
  useInsightsTools: () => answer.tools,
}));
const lines: { data: unknown[] } = { data: [] };

vi.mock('@/hooks/api/useLines', () => ({ useLines: () => lines }));

const LINES = [
  {
    id: 'line_1',
    key: 'delivery',
    name: 'Delivery',
    repositories: [],
    reactions: [],
    stations: [{ id: 'station_impl', key: 'implement', name: 'Implement' }],
  },
];

const TOOLS = {
  period: { name: '30d' },
  weeks: ['2026-09-21', '2026-09-28'],
  runs: 12,
  trendRule: { recentWeeks: 2, minRuns: 5, shiftPoints: 20 },
  skills: [
    {
      key: 'our-migrations',
      defined: true,
      enabled: 8,
      used: 5,
      weeks: [
        { week: '2026-09-21', runs: 6, enabled: 4, used: 1, usedShare: 1 / 6 },
        { week: '2026-09-28', runs: 6, enabled: 4, used: 4, usedShare: 4 / 6 },
      ],
      trend: 'spreading',
      stations: [
        {
          lineId: 'line_1',
          stationId: 'station_impl',
          runs: 10,
          enabled: 8,
          used: 5,
          trend: 'spreading',
        },
      ],
    },
    {
      key: 'borrowed',
      defined: false,
      enabled: 0,
      used: 1,
      weeks: [
        { week: '2026-09-21', runs: 6, enabled: 0, used: 0, usedShare: 0 },
        { week: '2026-09-28', runs: 6, enabled: 0, used: 1, usedShare: 1 / 6 },
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
          element={
            <ToolsTab
              slug="acme"
              teamId="team_1"
              period="30d"
              names={stationNamesOf(
                LINES as unknown as Parameters<typeof stationNamesOf>[0],
              )}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );

const RUNS = '/w/acme/team/team_1/insights?tab=runs';

beforeEach(() => {
  answer.tools = queried(TOOLS);
  lines.data = LINES;
});

describe('the skills and tools of the Tools and skills tab', () => {
  it('shows a faithful skeleton while it loads', () => {
    answer.tools = queried(undefined);

    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the tools' }),
    ).toBeInTheDocument();
  });

  it('offers to try again where it could not load', async () => {
    answer.tools = queried(undefined, 1);

    showing();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(answer.tools.refetch).toHaveBeenCalled();
  });

  it('leads to creating a task where no run ran', () => {
    answer.tools = queried({ ...EMPTY, runs: 0 });

    showing();

    expect(screen.getByText('No runs in this period')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a task' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1',
    );
  });

  it('cannot create a task where the team has no line', () => {
    answer.tools = queried({ ...EMPTY, runs: 0 });
    lines.data = [];

    showing();

    expect(
      screen.getByRole('button', { name: 'Create a task' }),
    ).toBeDisabled();
  });

  it('leads to the team’s skills where runs used no skill or server', () => {
    answer.tools = queried(EMPTY);

    showing();

    expect(
      screen.getByRole('link', { name: 'See the team’s skills' }),
    ).toHaveAttribute('href', '/w/acme/settings/team/team_1/skills');
  });

  const skillRow = (key: string) =>
    screen
      .getByText(key, { selector: 'a, span' })
      .closest('[data-slot="nested-group"]') as HTMLElement;

  it('lists each skill in one table, marking spreading and explaining the rule on its column', () => {
    showing();

    const table = screen.getByRole('list', { name: 'Skill use' });

    expect(
      within(table).getAllByRole('button', { name: /^Fold / }),
    ).toHaveLength(1);
    expect(
      skillRow('our-migrations').querySelector('[data-slot="skill-trend"]'),
    ).toHaveAttribute('data-trend', 'spreading');
    expect(skillRow('our-migrations')).toHaveTextContent('Enabled8Read5Trend');
  });

  it('links a defined skill to its page under the team’s skills, and opens the runs behind its numbers', () => {
    showing();

    const migrations = skillRow('our-migrations');

    expect(
      within(migrations).getByRole('link', { name: 'our-migrations' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/settings/team/team_1/skills#skill-our-migrations',
    );
    expect(
      within(skillRow('borrowed')).queryByRole('link', { name: 'borrowed' }),
    ).toBeNull();
    expect(within(migrations).getByRole('link', { name: '5' })).toHaveAttribute(
      'href',
      `${RUNS}&skillUsed=our-migrations`,
    );
    expect(within(migrations).getByRole('link', { name: '8' })).toHaveAttribute(
      'href',
      `${RUNS}&skillEnabled=our-migrations`,
    );
  });

  it('names the stations that read a skill, each opening its runs there', () => {
    showing('?tab=tools&period=7d');

    const stations = screen.getByRole('list', {
      name: 'Stations using our-migrations',
    });
    const station = within(stations).getByRole('link', { name: 'Implement' });

    expect(station).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=runs&period=7d&stationId=station_impl&skillUsed=our-migrations',
    );
    expect(station.closest('li')).toHaveTextContent('Runs10Enabled8Read5');
    expect(
      screen.queryByRole('list', { name: 'Stations using borrowed' }),
    ).toBeNull();
  });

  it('leaves out skills, unused skills and refusals where there are none', () => {
    answer.tools = queried({ ...EMPTY, servers: TOOLS.servers });

    showing();

    expect(screen.queryByRole('list', { name: 'Skill use' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Unused skills' })).toBeNull();
    expect(
      screen.queryByRole('list', { name: 'Refused approvals per tool' }),
    ).toBeNull();
    expect(
      screen.getByRole('list', { name: 'How each MCP server behaved' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('note')).toBeNull();
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

    const table = screen.getByRole('list', {
      name: 'How each MCP server behaved',
    });
    const row = within(table).getByText('linear').closest('li') as HTMLElement;

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

    const table = screen.getByRole('list', {
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
