import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BeforeAfterHost } from '@/components/features/insights/changes/BeforeAfterHost';
import { ChangesTab } from '@/components/features/insights/changes/ChangesTab';
import { stationNamesOf } from '@/lib/insights';
import type { InsightsCandidates } from '@/lib/insights-candidates';
import type { InsightsChanges, InsightsSetups } from '@/lib/insights-changes';
import { CANDIDATES } from '@/test/fixtures/insights-candidates';

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

const answer: {
  changes: Queried;
  setups: Queried;
  candidates: Queried;
  asked: unknown[];
} = {
  changes: queried(undefined),
  setups: queried(undefined),
  candidates: queried(undefined),
  asked: [],
};

vi.mock('@/hooks/api/useInsightsChanges', () => ({
  useInsightsChanges: () => answer.changes,
}));
vi.mock('@/hooks/api/useInsightsSetups', () => ({
  useInsightsSetups: (_teamId: string, _period: string, narrowed: unknown) => {
    answer.asked.push(narrowed);
    return answer.setups;
  },
}));
vi.mock('@/hooks/api/useInsightsCandidates', () => ({
  insightsCandidatesKeys: { forTeam: () => ['insights', 'candidates'] },
  useInsightsCandidates: () => answer.candidates,
}));
vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({
    data: [{ id: 'claude-code', name: 'Claude Code', models: [] }],
  }),
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

const tally = (over: Record<string, unknown> = {}) => ({
  runs: 10,
  withdrawn: 0,
  failed: 0,
  stopped: 0,
  checksPassed: 0,
  checksFailed: 0,
  accepted: 4,
  sentBack: 2,
  handedOn: 0,
  merged: 0,
  cost: null,
  unpriced: 0,
  mixedCurrencies: false,
  medianMs: null,
  p90Ms: null,
  ...over,
});

const CHANGES = {
  period: { name: '30d' },
  markers: [
    {
      lineId: 'line_1',
      stationId: 'station_impl',
      fingerprint: 'b'.repeat(64),
      previousFingerprint: 'a'.repeat(64),
      firstRunAt: '2026-09-20T10:00:00.000Z',
      runId: 'run_1',
      before: tally(),
      after: tally({ accepted: 8, sentBack: 1 }),
      verdicts: [
        {
          measure: 'accepted_rate',
          before: 0.4,
          after: 0.8,
          measuredBefore: 10,
          measuredAfter: 10,
          currency: null,
          verdict: 'better',
        },
      ],
      judgeBefore: { mean: 0.5, judged: 4 },
      judgeAfter: { mean: 0.75, judged: 4 },
      changes: [
        {
          part: 'model',
          name: null,
          kind: 'changed',
          was: 'sonnet',
          now: 'opus',
        },
      ],
    },
  ],
  judges: [
    {
      lineId: 'line_1',
      stationId: 'station_impl',
      trusted: true,
      measure: 'kappa',
      agreement: 0.7,
      pairs: 20,
      trust: 0.6,
      hiddenBecause: null,
    },
  ],
} as unknown as InsightsChanges;

const SETUPS = {
  period: { name: '30d' },
  stationId: 'station_impl',
  size: null,
  sizes: [
    { size: 'small', maxLines: 50, maxSteps: 20 },
    { size: 'medium', maxLines: 400, maxSteps: 80 },
    { size: 'large', maxLines: null, maxSteps: null },
  ],
  minRuns: 3,
  currency: 'USD',
  setups: [
    {
      harness: 'claude-code',
      model: 'opus',
      effort: 'high',
      profileKey: null,
      tally: tally(),
      costPerRun: 0.9,
      currency: 'USD',
      priced: true,
      outcomes: {
        accepted: 0.6,
        sent_back: 0.1,
        handed_on: 0.2,
        checks_passed: 0.9,
        merged: 0.3,
        judge: 0.75,
      },
      judge: { mean: 0.75, judged: 4 },
      frontier: ['accepted'],
    },
    {
      harness: 'claude-code',
      model: 'sonnet',
      effort: null,
      profileKey: null,
      tally: tally({ runs: 30 }),
      costPerRun: 1.2,
      currency: 'USD',
      priced: true,
      outcomes: {
        accepted: 0.4,
        sent_back: 0.3,
        handed_on: 0.2,
        checks_passed: 0.7,
        merged: 0.2,
        judge: null,
      },
      judge: { mean: null, judged: 0 },
      frontier: [],
    },
  ],
  judgeOmitted: null,
  judges: CHANGES.judges,
} as unknown as InsightsSetups;

const REPLAYED = {
  ...CANDIDATES,
  stations: [
    {
      ...CANDIDATES.stations[0],
      lineId: 'line_1',
      stationId: 'station_impl',
    },
  ],
} as InsightsCandidates;

const filter = async (name: string) => {
  if (!screen.queryByRole('button', { name })) {
    await userEvent.click(
      screen.getByRole('button', { name: /^Filter the setups/ }),
    );
  }
  await userEvent.click(await screen.findByRole('button', { name }));
};

const narrowingTo = async (station: string) => {
  await filter('Station: Every station');
  await userEvent.click(
    await screen.findByRole('menuitemradio', { name: station }),
  );
};

const NAMES = stationNamesOf([
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
] as unknown as Parameters<typeof stationNamesOf>[0]);

const showing = () =>
  render(
    <MemoryRouter
      initialEntries={['/w/acme/team/team_1/insights?tab=stations']}
    >
      <BeforeAfterHost slug="acme" teamId="team_1" period="30d" names={NAMES}>
        <ChangesTab slug="acme" teamId="team_1" period="30d" names={NAMES} />
      </BeforeAfterHost>
    </MemoryRouter>,
  );

beforeEach(() => {
  answer.changes = queried(CHANGES);
  answer.setups = queried(SETUPS);
  answer.candidates = queried(REPLAYED);
  answer.asked = [];
});

describe('the Changes tab', () => {
  it('shows a faithful skeleton while it loads', () => {
    answer.changes = queried(undefined);

    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the changes' }),
    ).toBeInTheDocument();
  });

  it('offers to try again where it could not load', async () => {
    answer.changes = queried(undefined, 1);

    showing();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(answer.changes.refetch).toHaveBeenCalled();
  });

  it('leads to creating a task where nothing ran', () => {
    answer.changes = queried({ ...CHANGES, markers: [], judges: [] });
    answer.setups = queried({ ...SETUPS, setups: [], judges: [] });

    showing();

    expect(screen.getByText('No runs in this period')).toBeInTheDocument();
  });

  it('lists each config change with what changed, and opens its impact', async () => {
    showing();

    const changes = screen.getByRole('list', { name: 'Config changes' });
    const row = within(changes)
      .getByRole('link', { name: 'Implementation' })
      .closest('[data-slot="change-marker"]') as HTMLElement;

    expect(row).toHaveTextContent('Runs before10');
    expect(row).toHaveTextContent('Runs after10');
    expect(
      within(row).getByRole('list', { name: 'What changed' }),
    ).toBeInTheDocument();

    await userEvent.click(within(row).getByRole('button', { name: 'Impact' }));

    const panel = screen.getByRole('complementary', {
      name: 'Impact of the change',
    });
    const table = within(panel).getByRole('table', {
      name: 'Runs before and after the change',
    });
    const accepted = within(table).getByRole('row', { name: /Accepted/ });
    expect(accepted).toHaveTextContent('40%80%');
    expect(
      accepted.querySelector('[data-slot="delta"]')?.getAttribute('data-tone'),
    ).toBe('good');
    const judge = within(table).getByRole('row', { name: /Judge score/ });
    expect(judge).toHaveTextContent(/75%/);
    expect(
      within(judge).getByRole('link', { name: 'Judge score' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=stations&stationId=station_impl#judge',
    );
    expect(
      within(panel).getByRole('link', { name: 'Open the station' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_impl',
    );
    expect(
      within(panel).getByRole('link', { name: 'Improve' }),
    ).toBeInTheDocument();
  });

  it('compares setups in a table, marking the frontier and keeping judge scores to trusted stations', async () => {
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Table' }));

    const table = screen.getByRole('list', {
      name: 'Harness, model, effort and profile',
    });
    expect(
      within(table).getByRole('button', { name: 'Fold Claude Code' }),
    ).toBeInTheDocument();
    const opus = within(table)
      .getByText('opus · high effort')
      .closest('[data-slot="setup-row"]') as HTMLElement;

    expect(within(opus).getByLabelText('Best value')).toBeInTheDocument();
    expect(opus).toHaveTextContent('Judge score75%');
    const calibrations = document.querySelector(
      '[data-slot="judge-calibrations"]',
    ) as HTMLElement;
    expect(
      within(calibrations).getByRole('link', { name: 'Implementation' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=stations&stationId=station_impl#judge',
    );
    expect(calibrations).toHaveTextContent('trusted');
    expect(
      screen.getByText(/Small: up to 50 changed lines/),
    ).toBeInTheDocument();
  });

  it('leaves judge scores out of the table until a station is picked', async () => {
    answer.setups = queried({
      ...SETUPS,
      stationId: null,
      judgeOmitted: 'no_station',
      judges: [],
      setups: SETUPS.setups.map((each) => ({
        ...each,
        judge: null,
        outcomes: { ...each.outcomes, judge: null },
      })),
    });

    showing();
    await userEvent.click(screen.getByRole('button', { name: 'Table' }));

    expect(
      screen.queryByRole('columnheader', { name: 'Judge score' }),
    ).not.toBeInTheDocument();
  });

  it('narrows the comparison by task size', async () => {
    showing();

    await filter('Task size: Every size');
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'Large' }),
    );

    expect(answer.asked.at(-1)).toEqual({ stationId: null, size: 'large' });
  });

  it('draws no replayed candidates until a station is picked', () => {
    showing();

    expect(
      document.querySelector('[data-slot="replayed-legend"]'),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="replayed-note"]'),
    ).not.toBeInTheDocument();
  });

  it('sets a narrowed station’s replayed candidates beside its setups, marked apart and noted as replay success', async () => {
    showing();

    await narrowingTo('Implementation');

    expect(
      document.querySelector('[data-slot="replayed-legend"]'),
    ).toHaveTextContent(/Searched.*Live config, replayed/);
    expect(
      screen.getByText(
        /Accepted against cost per run. Replayed points show replay success on past tasks./,
      ),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="replayed-note"]'),
    ).toHaveTextContent(
      /replay success on up to 18 runs of past tasks, not live outcomes. Each candidate’s own checks and judge score it/,
    );
  });

  it('lists the replayed rows in their own section of the table, leaving out the unpriced', async () => {
    showing();

    await narrowingTo('Implementation');
    await userEvent.click(screen.getByRole('button', { name: 'Table' }));

    const replayed = screen.getByRole('list', { name: 'Replayed configs' });
    const rowOf = (name: string | RegExp) =>
      within(replayed)
        .queryByText(name)
        ?.closest('[data-slot="replayed-setup-row"]');
    expect(rowOf('Live config')).toHaveTextContent('SourceLive');
    expect(rowOf('opus-with-migrations-skill')).toHaveTextContent(
      '67% of 7 held-out runs',
    );
    expect(rowOf('cursor-careful-profile')).toBeFalsy();
    expect(
      screen.getByRole('list', { name: 'Harness, model, effort and profile' }),
    ).toBeInTheDocument();
  });

  it('leaves out replayed candidates priced in another currency than the setups', async () => {
    answer.setups = queried({ ...SETUPS, currency: 'EUR' });

    showing();
    await narrowingTo('Implementation');

    expect(
      document.querySelector('[data-slot="replayed-legend"]'),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="replayed-note"]'),
    ).not.toBeInTheDocument();
  });

  it('says task size does not narrow the replayed candidates', async () => {
    showing();
    await narrowingTo('Implementation');

    expect(
      document.querySelector('[data-slot="replayed-note"]'),
    ).toHaveTextContent('The task-size filter doesn’t apply.');
  });

  it('hides replayed points while the chart shows an outcome where lower is better', async () => {
    showing();
    await narrowingTo('Implementation');
    await filter('Outcome: Accepted');
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'Sent back' }),
    );

    expect(
      document.querySelector('[data-slot="replayed-legend"]'),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="replayed-note"]'),
    ).toHaveTextContent(
      'Replayed points show success only. They’re hidden while the chart shows Sent back.',
    );
  });

  it('says so where the station’s replayed candidates have no priced live setup to sit beside', async () => {
    answer.setups = queried({
      ...SETUPS,
      setups: SETUPS.setups.map((each) => ({ ...each, costPerRun: null })),
    });

    showing();
    await narrowingTo('Implementation');

    expect(
      document.querySelector('[data-slot="replayed-note"]'),
    ).toHaveTextContent(
      'Replayed candidates aren’t drawn. No live setup has a priced outcome.',
    );
  });

  it('keeps the tab whole when the replayed candidates could not be loaded', async () => {
    answer.candidates = queried(undefined, 1);

    showing();
    await narrowingTo('Implementation');

    expect(
      screen.getByText('The replayed candidates could not be loaded.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('list', { name: 'Config changes' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(answer.candidates.refetch).toHaveBeenCalled();
  });

  it('opens the impact of a config the station returned to, not its first adoption', async () => {
    const [first] = CHANGES.markers;
    const returned = (runId: string, firstRunAt: string, runs: number) => ({
      ...first,
      runId,
      firstRunAt,
      before: tally({ runs }),
      after: tally({ runs }),
    });
    answer.changes = queried({
      ...CHANGES,
      markers: [
        returned('run_2', '2026-09-20T10:00:00.000Z', 11),
        {
          ...returned('run_3', '2026-09-22T10:00:00.000Z', 12),
          fingerprint: 'a'.repeat(64),
          previousFingerprint: 'b'.repeat(64),
        },
        returned('run_4', '2026-09-24T10:00:00.000Z', 13),
      ],
    });

    showing();

    const rows = [
      ...document.querySelectorAll('[data-slot="change-marker"]'),
    ] as HTMLElement[];
    const newest = rows[0] as HTMLElement;
    await userEvent.click(
      within(newest).getByRole('button', { name: 'Impact' }),
    );

    expect(
      rows.map((row) =>
        within(row)
          .getByRole('button', { name: 'Impact' })
          .getAttribute('aria-pressed'),
      ),
    ).toEqual(['true', 'false', 'false']);
    expect(
      screen.getByRole('complementary', {
        name: 'Impact of the change',
      }),
    ).toHaveTextContent('Runs1313');
  });

  it('names the line each config change was on, leading to it', () => {
    showing();

    const row = within(screen.getByRole('list', { name: 'Config changes' }))
      .getByRole('link', { name: 'Implementation' })
      .closest('[data-slot="change-marker"]') as HTMLElement;

    expect(within(row).getByRole('link', { name: 'Delivery' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1',
    );
  });

  it('keeps the setup filters behind one button that counts and clears them', async () => {
    showing();

    await narrowingTo('Implementation');

    const button = screen.getByRole('button', {
      name: 'Filter the setups, 1 applied',
    });
    expect(button).toHaveTextContent('1');

    await userEvent.click(
      screen.getByRole('button', { name: 'Clear filters' }),
    );

    expect(answer.asked.at(-1)).toEqual({ stationId: null, size: null });
  });
});
