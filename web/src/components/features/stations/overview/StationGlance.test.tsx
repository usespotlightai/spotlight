import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { StationGlance } from '@/components/features/stations/overview/StationGlance';
import type { StationOutcomes, StationTally } from '@/lib/station-outcomes';

const inForce = vi.fn<() => StationOutcomes['inForce']>();

vi.mock('@/hooks/api/useStationOutcomes', () => ({
  useStationOutcomes: () => ({
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
  withdrawn: 0,
  handedOn: 0,
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
      <StationGlance
        slug="acme"
        teamId="team_1"
        lineId="line_1"
        stationId="station_1"
      />
    </MemoryRouter>,
  );

describe('StationGlance', () => {
  it('sums up every listed run of the config in force', () => {
    inForce.mockReturnValue({ tally: TALLY });

    showing();

    expect(screen.getByText('Latest runs on this config')).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="station-glance"]'),
    ).toHaveTextContent('42');
  });

  it('says nothing where no run has run a config yet', () => {
    inForce.mockReturnValue(null);

    showing();

    expect(
      screen.queryByText('Latest runs on this config'),
    ).not.toBeInTheDocument();
  });
});
