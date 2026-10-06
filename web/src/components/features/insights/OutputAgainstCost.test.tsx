import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { OutputAgainstCost } from '@/components/features/insights/OutputAgainstCost';
import type { LineResponseDto } from '@/lib/api';
import { BeforeAfterPanelContext } from '@/lib/before-after-panel';
import { type OutputDay, stationNamesOf } from '@/lib/insights';

const NAMES = stationNamesOf([
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
] as unknown as LineResponseDto[]);

const DAYS: OutputDay[] = [
  { day: '2026-09-29', runs: 0, spend: null, merged: 0, changes: [] },
  {
    day: '2026-09-30',
    runs: 5,
    spend: 4.2,
    merged: 1,
    changes: [
      {
        lineId: 'line_1',
        stationId: 'station_build',
        fingerprint: 'b7d4a60c8e2f1a9b',
        previousFingerprint:
          '0000000000000000000000000000000000000000000000000000000000000000',
        firstRunAt: '2026-09-30T10:00:00.000Z',
        runId: 'run_1',
      },
    ],
  },
];

const showing = (currency: string | null = 'USD', noSpend = 'No priced runs') =>
  render(
    <MemoryRouter initialEntries={['/w/acme/team/team_1/insights?period=7d']}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/insights"
          element={
            <OutputAgainstCost
              slug="acme"
              teamId="team_1"
              days={DAYS}
              currency={currency}
              noSpend={noSpend}
              names={NAMES}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe('OutputAgainstCost', () => {
  it('shows the chart with a marker for each new config', () => {
    showing();

    expect(
      document.querySelector('[data-slot="output-chart"]'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Config changes' })).getByRole(
        'button',
        { name: /Config changed on .*: Implementation/ },
      ),
    ).toBeInTheDocument();
  });

  it('opens the station’s before and after from a marker', async () => {
    const show = vi.fn();
    render(
      <BeforeAfterPanelContext value={{ shown: null, show, close: vi.fn() }}>
        <MemoryRouter initialEntries={['/w/acme/team/team_1/insights']}>
          <Routes>
            <Route
              path="/w/:slug/team/:teamId/insights"
              element={
                <OutputAgainstCost
                  slug="acme"
                  teamId="team_1"
                  days={DAYS}
                  currency="USD"
                  noSpend="No priced runs"
                  names={NAMES}
                />
              }
            />
          </Routes>
        </MemoryRouter>
      </BeforeAfterPanelContext>,
    );

    await userEvent.click(
      screen.getByRole('button', {
        name: /Config changed on .*: Implementation/,
      }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Before and after' }),
    );

    expect(show).toHaveBeenCalledWith({
      stationId: 'station_build',
      runId: 'run_1',
    });
  });

  it('puts a table behind the chart, each day leading to its runs', async () => {
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Table' }));

    const table = screen.getByRole('table', {
      name: 'Output against cost, by day',
    });
    const [, empty, busy] = within(table).getAllByRole('row');

    expect(empty).toHaveTextContent('0–0–');
    expect(busy).toHaveTextContent('5$4.201Implementation');
    expect(
      within(busy as HTMLElement).getByRole('link', { name: '5' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=runs&period=7d&day=2026-09-30',
    );
    expect(
      within(busy as HTMLElement).getByRole('link', { name: 'Implementation' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_build',
    );
    expect(screen.getByRole('button', { name: 'Table' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('leaves spend out where it cannot be summed in one currency', () => {
    showing(null, 'Prices in more than one currency');

    expect(
      screen.getByText(/Spend not shown\. Prices in more than one currency/),
    ).toBeInTheDocument();
  });
});
