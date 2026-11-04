import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { StationSummary } from '@/components/features/stations/activity/StationSummary';
import type { StationRunOutcomes, StationTally } from '@/lib/station-insights';

const inForce = vi.fn<() => StationRunOutcomes['inForce']>();

vi.mock('@/hooks/api/useStationInsights', () => ({
  useStationInsights: () => ({
    data: { stationId: 'station_1', groups: [], inForce: inForce() },
    isPending: false,
    errorUpdateCount: 0,
  }),
}));

const TALLY = {
  runs: 42,
  failed: 0,
  stopped: 0,
  checksPassed: 1,
  checksFailed: 0,
  accepted: 1,
  sentBack: 0,
  cancelled: 0,
  passed: 0,
  merged: 1,
  cost: null,
  medianMs: null,
  p90Ms: null,
  unpriced: 0,
  mixedCurrencies: false,
} as StationTally;

const showing = () =>
  render(
    <MemoryRouter>
      <StationSummary
        slug="acme"
        teamId="team_1"
        lineId="line_1"
        stationId="station_1"
        period="live"
      />
    </MemoryRouter>,
  );

describe('StationSummary', () => {
  it('sums up every listed run of the live config', () => {
    inForce.mockReturnValue({
      tally: TALLY,
      taskFailures: [],
      runFailures: [],
    });

    showing();

    expect(screen.getByText('Latest runs on this config')).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="station-summary"]'),
    ).toHaveTextContent('42');
  });

  it('says no run has run a config yet, with no tiles', () => {
    inForce.mockReturnValue(null);

    showing();

    expect(screen.getByText('No run on a config yet.')).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="station-summary"]'),
    ).not.toBeInTheDocument();
  });
});
