import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StationRunOutcomes } from '@/components/features/stations/outcomes/StationRunOutcomes';
import type {
  FingerprintGroup,
  StationRunOutcome,
  StationTally,
} from '@/lib/station-insights';

const outcomes = vi.fn();
const failing = vi.fn();
const error = vi.fn();
const refetch = vi.fn();

vi.mock('@/hooks/api/useStationInsights', () => ({
  useStationInsights: () => ({
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
  failedRate: 0.5,
  stopped: 0,
  checksPassed: 1,
  checksFailed: 0,
  accepted: 1,
  sentBack: 0,
  cancelled: 0,
  passed: 0,
  merged: 1,
  cost: { amount: 1.2, currency: 'USD' },
  medianMs: 180_000,
  p90Ms: 180_000,
  unpriced: 0,
  mixedCurrencies: false,
};

const TODAY = new Date().toISOString().slice(0, 10);

const run = (over: Partial<StationRunOutcome>): StationRunOutcome => ({
  runId: 'run_1',
  taskId: 'task_1',
  endedAt: new Date().toISOString(),
  ending: 'completed',
  failure: null,
  visit: 1,
  usage: {
    ms: 180_000,
    steps: 12,
    errors: 0,
    contextTokens: null,
    cost: 0.6,
    currency: 'USD',
  },
  checks: 'passed',
  firstHumanAction: { kind: 'accepted', at: new Date().toISOString() },
  passed: null,
  pullRequestState: 'merged',
  ...over,
});

const NEWER: FingerprintGroup = {
  ran: true,
  pullRequest: null,
  firstRunId: 'run_2',
  fingerprint: 'b7d4a60c8e2f1a9b3d5c7e9f',
  config: null,
  changes: [
    { part: 'effort', name: null, kind: 'changed', was: 'high', now: 'xhigh' },
  ],
  tally: TALLY,
  rates: { checksPassed: 1, accepted: 0.5, merged: 0.5 },
  firstDay: TODAY,
  lastDay: TODAY,
  runs: [
    run({}),
    run({
      runId: 'run_2',
      ending: 'failed',
      failure: 'The agent ran out of turns',
      visit: 2,
      checks: null,
      firstHumanAction: null,
      pullRequestState: null,
      usage: null,
    }),
  ],
};

const OLDER: FingerprintGroup = {
  ran: true,
  pullRequest: null,
  firstRunId: 'run_0',
  fingerprint: '3f2a9c1e5b7d4a60',
  config: null,
  changes: [],
  tally: { ...TALLY, runs: 1, failed: 0 },
  rates: { checksPassed: 1, accepted: 1, merged: 1 },
  firstDay: TODAY,
  lastDay: TODAY,
  runs: [run({ runId: 'run_0' })],
};

const showing = () =>
  render(
    <MemoryRouter>
      <StationRunOutcomes
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

describe('StationRunOutcomes', () => {
  it('groups the runs by the config they ran with, newest first, named by what changed', () => {
    showing();

    expect(groups().map((group) => group.textContent)).toEqual([
      'Effort high → xhigh',
      'Config 3f2a9c1e',
    ]);
  });

  it('offers the impact of each config that changed something', () => {
    showing();

    const [newer, older] = screen
      .getAllByRole('button', { name: /^Collapse / })
      .map((toggle) => toggle.closest('li') as HTMLElement);

    expect(
      within(newer as HTMLElement).getByRole('button', { name: 'Impact' }),
    ).toBeInTheDocument();
    expect(
      within(older as HTMLElement).queryByRole('button', { name: 'Impact' }),
    ).not.toBeInTheDocument();
  });

  it('sums each config’s runs in the same columns as its runs', () => {
    showing();

    const [newer] = screen
      .getAllByRole('button', { name: /^Collapse / })
      .map((toggle) => toggle.closest('li') as HTMLElement);

    expect(newer).toHaveTextContent(
      'Checks100% passedHuman action50% acceptedPull request50% mergedDuration3mCost$1.20',
    );
  });

  it('shows how each run turned out, leading to it', () => {
    showing();

    const [first, second] = within(
      screen.getAllByRole('list', { name: 'Runs' })[0] as HTMLElement,
    ).getAllByRole('listitem');

    expect(first).toHaveTextContent(
      'CompletedVisit1ChecksChecks passedHuman actionAcceptedPull requestMergedDuration3mCost$0.60',
    );
    expect(second).toHaveTextContent(
      'FailedThe agent ran out of turnsVisit2Checks–Human action–Pull request–Duration–',
    );
    expect(
      within(second as HTMLElement).getByRole('link', { name: 'Failed' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/runs/run_2');
  });

  it('names runs from before the first run with a config', () => {
    outcomes.mockReturnValue({
      stationId: 'station_1',
      groups: [{ ...OLDER, fingerprint: null }],
    });

    showing();

    expect(
      screen.getByText('Before the first run with a config'),
    ).toBeInTheDocument();
  });

  it('marks a config whose runs never started, apart from the live config', () => {
    outcomes.mockReturnValue({
      stationId: 'station_1',
      groups: [{ ...NEWER, ran: false, firstRunId: 'run_3' }, OLDER],
    });

    showing();

    const groups = document.querySelectorAll('[data-slot="config-group"]');
    expect(groups[0]).toHaveTextContent('Never started');
    expect(groups[1]).not.toHaveTextContent('Never started');
  });

  it('keeps the shape of a config while they load', () => {
    outcomes.mockReturnValue(undefined);

    showing();

    expect(
      screen.getByRole('status', { name: 'Loading how its runs turned out' }),
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

  it('says the runs could not be loaded, and tries again on request', async () => {
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
      screen.getByText('Only team members can see this station’s runs'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
