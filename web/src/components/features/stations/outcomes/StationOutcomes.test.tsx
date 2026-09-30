import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StationOutcomes } from '@/components/features/stations/outcomes/StationOutcomes';
import type {
  FingerprintGroup,
  StationRunOutcome,
  StationTally,
} from '@/lib/station-outcomes';

const outcomes = vi.fn();
const failing = vi.fn();
const error = vi.fn();
const refetch = vi.fn();

vi.mock('@/hooks/api/useStationOutcomes', () => ({
  useStationOutcomes: () => ({
    data: outcomes(),
    isPending: outcomes() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    error: error(),
    isFetching: false,
    refetch,
  }),
}));

vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({ data: [{ id: 'line_1' }] }),
}));

const TALLY: StationTally = {
  runs: 2,
  failed: 1,
  stopped: 0,
  checksPassed: 1,
  checksFailed: 0,
  accepted: 1,
  sentBack: 0,
  withdrawn: 0,
  merged: 1,
  cost: { amount: 1.2, currency: 'USD' },
  medianMs: 180_000,
};

const run = (over: Partial<StationRunOutcome>): StationRunOutcome => ({
  runId: 'run_1',
  taskId: 'task_1',
  endedAt: new Date().toISOString(),
  ending: 'completed',
  failure: null,
  round: 1,
  cost: {
    ms: 180_000,
    steps: 12,
    faults: 0,
    used: null,
    cost: 0.6,
    currency: 'USD',
  },
  checks: 'passed',
  next: { act: 'approved', at: new Date().toISOString() },
  delivery: 'merged',
  ...over,
});

const NEWER: FingerprintGroup = {
  fingerprint: 'b7d4a60c8e2f1a9b3d5c7e9f',
  config: null,
  changes: [
    { part: 'effort', name: null, kind: 'changed', was: 'high', now: 'xhigh' },
  ],
  tally: TALLY,
  runs: [
    run({}),
    run({
      runId: 'run_2',
      ending: 'failed',
      failure: 'The agent ran out of turns',
      round: 2,
      checks: null,
      next: null,
      delivery: null,
      cost: null,
    }),
  ],
};

const OLDER: FingerprintGroup = {
  fingerprint: '3f2a9c1e5b7d4a60',
  config: null,
  changes: [],
  tally: { ...TALLY, runs: 1, failed: 0 },
  runs: [run({ runId: 'run_0' })],
};

const showing = () =>
  render(
    <MemoryRouter>
      <StationOutcomes
        slug="acme"
        teamId="team_1"
        lineId="line_1"
        stationId="station_1"
      />
    </MemoryRouter>,
  );

const groups = () =>
  Array.from(document.querySelectorAll('[data-slot="config-group"]'));

beforeEach(() => {
  outcomes.mockReturnValue({ stationId: 'station_1', groups: [NEWER, OLDER] });
  failing.mockReturnValue(false);
  error.mockReturnValue(null);
  refetch.mockReset();
});

describe('StationOutcomes', () => {
  it('groups the runs by the config they ran with, newest first', () => {
    showing();

    expect(
      groups().map(
        (group) =>
          group.querySelector('[data-slot="fingerprint"]')?.textContent,
      ),
    ).toEqual(['b7d4a60c', '3f2a9c1e']);
  });

  it('says what changed from the config before', () => {
    showing();

    const [newer, older] = groups() as HTMLElement[];

    expect(
      within(newer as HTMLElement).getByRole('list', { name: 'What changed' }),
    ).toHaveTextContent('Effort high → xhigh');
    expect(
      within(older as HTMLElement).queryByRole('list', {
        name: 'What changed',
      }),
    ).not.toBeInTheDocument();
  });

  it('tallies how each config’s runs went', () => {
    showing();

    expect(
      groups()[0]?.querySelector('[data-slot="station-tally"]'),
    ).toHaveTextContent(
      'Runs2Failed1Checks passed1Accepted1Merged1Cost$1.20Median3m',
    );
  });

  it('shows how each run turned out, leading to it', () => {
    showing();

    const [first, second] = within(
      within(groups()[0] as HTMLElement).getByRole('list', { name: 'Runs' }),
    ).getAllByRole('listitem');

    expect(first).toHaveTextContent(
      'CompletedRound 1Checks passedApprovedMerged3m$0.60',
    );
    expect(second).toHaveTextContent(
      'FailedThe agent ran out of turnsRound 2––––',
    );
    expect(
      within(second as HTMLElement).getByRole('link', { name: 'Failed' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/runs/run_2');
  });

  it('names runs from before configs were recorded', () => {
    outcomes.mockReturnValue({
      stationId: 'station_1',
      groups: [{ ...OLDER, fingerprint: null }],
    });

    showing();

    expect(
      screen.getByText('Before configs were recorded'),
    ).toBeInTheDocument();
  });

  it('holds the shape of a config while they load', () => {
    outcomes.mockReturnValue(undefined);

    showing();

    expect(
      screen.getByRole('status', { name: 'Loading how its runs turned out' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'How its runs turned out' }),
    ).toBeInTheDocument();
  });

  it('says there are no runs yet, and offers to create a task', () => {
    outcomes.mockReturnValue({ stationId: 'station_1', groups: [] });

    showing();

    expect(screen.getByText('No runs yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a task' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1',
    );
  });

  it('says the runs could not be loaded, and tries again when asked', async () => {
    outcomes.mockReturnValue(undefined);
    failing.mockReturnValue(true);

    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The station’s runs could not be loaded.',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('tells someone off the team that only its members can see the runs', () => {
    outcomes.mockReturnValue(undefined);
    failing.mockReturnValue(true);
    error.mockReturnValue({ statusCode: 404 });

    showing();

    expect(
      screen.getByText(
        'Only the team’s members can see how its runs turned out',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
