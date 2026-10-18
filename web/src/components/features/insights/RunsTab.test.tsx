import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamInsights } from '@/components/features/insights/TeamInsights';
import type { InsightsRun, RunFilter } from '@/lib/insights';

const refetch = vi.fn();
const requested: { filter: RunFilter; page: number }[] = [];
const runsState = {
  data: undefined as unknown,
  isPending: false,
  isFetching: false,
  errorUpdateCount: 0,
  refetch,
};

vi.mock('@/hooks/api/useInsightsRuns', () => ({
  useInsightsRuns: (
    _teamId: string,
    _period: string,
    filter: RunFilter,
    page: number,
  ) => {
    requested.push({ filter, page });
    return runsState;
  },
}));
vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({
    data: [
      {
        id: 'claude-code',
        name: 'Claude Code',
        models: [],
        defaultModel: '',
        efforts: [],
      },
    ],
  }),
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

const run = (over: Partial<InsightsRun>): InsightsRun => ({
  runId: 'run_1',
  taskId: 'task_1',
  lineId: 'line_1',
  stationId: 'station_build',
  fingerprint: null,
  harness: 'claude-code',
  model: null,
  effort: null,
  profileKey: null,
  repositories: [],
  openedBy: 'user_1',
  queuedAt: null,
  startedAt: null,
  endedAt: new Date().toISOString(),
  queuedMs: null,
  runningMs: null,
  ms: 312_000,
  cost: { amount: 1.84, currency: 'USD' },
  tokens: null,
  ending: 'completed',
  failure: null,
  checks: null,
  firstHumanAction: null,
  passed: null,
  pullRequestState: null,
  ...over,
});

const page = (runs: InsightsRun[], total = runs.length, at = 1) => ({
  period: { name: '30d' },
  total,
  page: at,
  size: 50,
  runs,
  people: [{ personId: 'user_1', name: 'Sam Rivera' }],
});

function Address() {
  const location = useLocation();
  return <output aria-label="Address">{location.search}</output>;
}

const showing = (search: string) =>
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

beforeEach(() => {
  requested.length = 0;
  refetch.mockReset();
  runsState.data = page([
    run({}),
    run({
      runId: 'run_2',
      ending: 'failed',
      failure: 'The agent ran out of turns',
      openedBy: null,
      cost: null,
    }),
  ]);
  runsState.isPending = false;
  runsState.errorUpdateCount = 0;
});

describe('the runs tab', () => {
  it('lists every run, each leading to its Run page', () => {
    showing('?tab=runs');

    const [first, second] = within(
      screen.getByRole('list', { name: 'Runs' }),
    ).getAllByRole('listitem');

    expect(first).toHaveTextContent(
      'CompletedFailure–StationImplementationPersonSam RiveraAgent configClaude Code · Harness defaultTook5m 12sCost$1.84Endedjust now',
    );
    expect(second).toHaveTextContent('FailedFailureThe agent ran out of turns');
    expect(second).toHaveTextContent('No one');
    expect(
      within(second as HTMLElement).getByRole('link', { name: 'Failed' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/runs/run_2');
  });

  it('requests the runs the address narrows to', () => {
    showing('?tab=runs&stationId=station_build&outcome=failed&page=2');

    expect(requested.at(-1)).toEqual({
      filter: { stationId: 'station_build', outcome: 'failed' },
      page: 2,
    });
    expect(
      screen.getByRole('button', {
        name: 'Station: Implementation',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Outcome: Failed' }),
    ).toBeInTheDocument();
  });

  it('lets a drilled-in filter go, back to the first page', async () => {
    showing('?tab=runs&day=2026-09-30&page=2');

    await userEvent.click(
      screen.getByRole('button', { name: 'Stop narrowing by day' }),
    );

    expect(address()).toHaveTextContent(/^\?tab=runs$/);
  });

  it('pages through the runs in the address', async () => {
    runsState.data = page([run({})], 120);

    showing('?tab=runs');

    expect(screen.getByText('1–50 of 120')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Previous page' }),
    ).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    expect(address()).toHaveTextContent('?tab=runs&page=2');
  });

  it('says there were no runs in the period, and offers the board', () => {
    runsState.data = page([], 0);

    showing('?tab=runs');

    expect(screen.getByText('No runs in this period')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Create a task' }),
    ).toBeInTheDocument();
  });

  it('says when no run matches, and shows every run again', async () => {
    runsState.data = page([], 0);

    showing('?tab=runs&outcome=stopped');

    expect(screen.getByText('No runs match.')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Show every run' }),
    );

    expect(address()).toHaveTextContent(/^\?tab=runs$/);
  });

  it('says the runs could not be loaded, and tries again', async () => {
    runsState.data = undefined;
    runsState.isPending = true;
    runsState.errorUpdateCount = 1;

    showing('?tab=runs');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The runs could not be loaded.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('keeps the shape of the table while the runs load', () => {
    runsState.data = undefined;
    runsState.isPending = true;

    showing('?tab=runs');

    expect(
      screen.getByRole('status', { name: 'Loading the runs' }),
    ).toBeInTheDocument();
  });
});
