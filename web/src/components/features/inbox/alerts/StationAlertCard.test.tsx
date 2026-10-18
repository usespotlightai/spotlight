import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StationAlertCard } from '@/components/features/inbox/alerts/StationAlertCard';
import type { StationAlertFiring } from '@/lib/station-alert';

type Queried = {
  data: unknown;
  isPending: boolean;
  isFetching: boolean;
  errorUpdateCount: number;
  error: unknown;
  refetch: () => void;
};

const queried = (
  data: unknown,
  errorUpdateCount = 0,
  error: unknown = null,
): Queried => ({
  data,
  isPending: data === undefined && errorUpdateCount === 0,
  isFetching: false,
  errorUpdateCount,
  error,
  refetch: vi.fn(),
});

const answer: { alert: Queried } = { alert: queried(undefined) };

vi.mock('@/hooks/api/useStationAlert', () => ({
  useStationAlert: () => answer.alert,
}));
vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({
    data: [
      {
        id: 'line_1',
        key: 'delivery',
        name: 'Delivery',
        repositories: [],
        reactions: [],
        stations: [
          {
            id: 'station_impl',
            key: 'implementation',
            name: 'Implementation',
            kind: 'work',
            color: '#000',
            position: 0,
          },
        ],
      },
    ],
  }),
}));

const ALERT = {
  alertId: 'alert_1',
  lineId: 'line_1',
  stationId: 'station_impl',
  rule: {
    measure: 'sent_back_rate',
    risesBy: 0.15,
    fallsBy: null,
    above: null,
    below: null,
    over: 10,
  },
  value: 0.4,
  baseline: 0.2,
  change: {
    unit: 'points',
    by: 0.2,
    fromZero: false,
    direction: 'up',
    tone: 'bad',
  },
  runId: 'run_2',
  taskId: 'task_1',
  firedAt: '2026-09-30T10:00:00.000Z',
  insightsPeriod: '7d',
  resolvedAt: null,
  currency: 'USD',
  series: [
    { runId: 'run_1', endedAt: '2026-09-29T10:00:00.000Z', value: 0.2 },
    { runId: 'run_2', endedAt: '2026-09-30T10:00:00.000Z', value: 0.4 },
  ],
} as unknown as StationAlertFiring;

const showing = () =>
  render(
    <MemoryRouter initialEntries={['/w/acme/inbox/request_1']}>
      <Routes>
        <Route
          path="/w/:slug/inbox/:itemId"
          element={
            <StationAlertCard slug="acme" teamId="team_1" alertId="alert_1" />
          }
        />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  answer.alert = queried(ALERT);
});

describe('StationAlertCard', () => {
  it('shows a faithful skeleton while it loads', () => {
    answer.alert = queried(undefined);

    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the alert' }),
    ).toBeInTheDocument();
  });

  it('offers to try again where it could not load', async () => {
    answer.alert = queried(undefined, 1);

    showing();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(answer.alert.refetch).toHaveBeenCalled();
  });

  it('tells someone off the team that only its members can see the alert', () => {
    answer.alert = queried(undefined, 1, { statusCode: 404 });

    showing();

    expect(
      screen.getByText('Only team members can see this alert'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /try again/i }),
    ).not.toBeInTheDocument();
  });

  it('says what each line on the chart means', () => {
    showing();

    expect(
      within(screen.getByRole('list', { name: 'Legend' })).getByText(
        'The run it fired at',
      ),
    ).toBeInTheDocument();
  });

  it('says what the runs did, and where the alert is set, in one sentence', () => {
    showing();

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Alert fired at Implementation',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '40% of the last 10 runs were sent back, up from 20% in the 10 before. The alert is set at a 15-point rise.',
      ),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="alert-chart"]'),
    ).toBeInTheDocument();
  });

  it('links to the station, to it on Insights over the period the alert says, and to a chat that improves it', () => {
    showing();

    expect(
      screen.getByRole('link', { name: 'Open the station' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_impl',
    );
    expect(
      screen.getByRole('link', { name: 'Open in Insights' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=stations&period=7d#station-station_impl',
    );
    expect(screen.getByRole('link', { name: 'Improve' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/agent',
    );
  });

  it('says when the station alert resolved, and when its runs are gone', () => {
    answer.alert = queried({
      ...ALERT,
      resolvedAt: '2026-10-01T10:00:00.000Z',
      series: [],
    });

    showing();

    expect(
      screen.getByText(/back under the threshold since/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'There is no chart to show. The runs behind this alert are deleted.',
      ),
    ).toBeInTheDocument();
  });
});
