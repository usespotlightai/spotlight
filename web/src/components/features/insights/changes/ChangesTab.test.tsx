import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BeforeAfterHost } from '@/components/features/insights/changes/BeforeAfterHost';
import { ChangesTab } from '@/components/features/insights/changes/ChangesTab';
import { stationNamesOf } from '@/lib/insights';
import type {
  ConfigOrigin,
  InsightsCandidates,
} from '@/lib/insights-candidates';
import type { InsightsChanges, InsightsSetups } from '@/lib/insights-changes';
import { CANDIDATES } from '@/stories/fixtures/insights-candidates';

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

const origins = {
  origins: [] as ConfigOrigin[],
  failed: false,
  retry: vi.fn(),
};

const answer: {
  changes: Held;
  setups: Held;
  candidates: Held;
  asked: unknown[];
} = {
  changes: held(undefined),
  setups: held(undefined),
  candidates: held(undefined),
  asked: [],
};

vi.mock('@/hooks/api/useInsightsChanges', () => ({
  useInsightsChanges: () => answer.changes,
}));
vi.mock('@/hooks/api/useConfigOrigins', () => ({
  useConfigOrigins: () => origins,
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
  truncated: false,
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
          settledBefore: 10,
          settledAfter: 10,
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
  truncated: false,
  stationId: 'station_impl',
  size: null,
  sizes: [
    { size: 'small', mostLines: 50, mostSteps: 20 },
    { size: 'medium', mostLines: 400, mostSteps: 80 },
    { size: 'large', mostLines: null, mostSteps: null },
  ],
  fewestRuns: 3,
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
  judgeWithheld: null,
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

const narrowingTo = async (station: string) => {
  await userEvent.click(
    screen.getByRole('button', { name: 'Station: Every station' }),
  );
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
  answer.changes = held(CHANGES);
  answer.setups = held(SETUPS);
  answer.candidates = held(REPLAYED);
  answer.asked = [];
  origins.origins = [];
  origins.failed = false;
});

describe('the Changes tab', () => {
  it('shows a faithful skeleton while it loads', () => {
    answer.changes = held(undefined);

    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the changes' }),
    ).toBeInTheDocument();
  });

  it('offers to try again where it could not load', async () => {
    answer.changes = held(undefined, 1);

    showing();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(answer.changes.refetch).toHaveBeenCalled();
  });

  it('leads to creating a task where nothing ran', () => {
    answer.changes = held({ ...CHANGES, markers: [], judges: [] });
    answer.setups = held({ ...SETUPS, setups: [], judges: [] });

    showing();

    expect(screen.getByText('No runs in this period')).toBeInTheDocument();
  });

  it('lists each config change with what changed, and opens its before and after', async () => {
    showing();

    const changes = screen.getByRole('list', { name: 'Config changes' });
    const row = within(changes)
      .getByRole('link', { name: 'Implementation' })
      .closest('[data-slot="change-marker"]') as HTMLElement;

    expect(row).toHaveTextContent('Runs before 10');
    expect(row).toHaveTextContent('Runs after 10');
    expect(
      within(row).getByRole('list', { name: 'What changed' }),
    ).toBeInTheDocument();

    await userEvent.click(
      within(row).getByRole('button', { name: 'Before and after' }),
    );

    const panel = screen.getByRole('complementary', {
      name: 'Before and after the change',
    });
    const table = within(panel).getByRole('table', {
      name: 'Runs before and after the change',
    });
    const accepted = within(table).getByRole('row', { name: /Accepted/ });
    expect(accepted).toHaveTextContent('40%80%');
    expect(
      accepted.querySelector('[data-slot="delta"]')?.getAttribute('data-tone'),
    ).toBe('good');
    expect(within(panel).getByText('75% over 4 judged')).toBeInTheDocument();
    expect(
      within(panel).getByRole('link', { name: 'Open the station' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_impl',
    );
    expect(
      within(panel).getByRole('link', { name: /Improve this station/ }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole('link', {
        name: 'How often the judge agrees with people',
      }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=stations&stationId=station_impl#judge',
    );
  });

  it('compares setups in a table, marking the frontier and keeping judge scores to trusted stations', async () => {
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Show table' }));

    const table = screen.getByRole('table', {
      name: 'Harness, model, effort and profile',
    });
    const opus = within(table).getByRole('row', {
      name: /Claude Code · opus · high effort/,
    });

    expect(opus).toHaveTextContent('frontier');
    expect(
      within(table).getByRole('columnheader', { name: 'Judge score' }),
    ).toBeInTheDocument();
    const standings = document.querySelector(
      '[data-slot="judge-standings"]',
    ) as HTMLElement;
    expect(
      within(standings).getByRole('link', { name: 'Implementation' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=stations&stationId=station_impl#judge',
    );
    expect(standings).toHaveTextContent('trusted');
    expect(
      screen.getByText(/Small: up to 50 changed lines/),
    ).toBeInTheDocument();
  });

  it('leaves judge scores out of the table until a station is picked', async () => {
    answer.setups = held({
      ...SETUPS,
      stationId: null,
      judgeWithheld: 'no_station',
      judges: [],
      setups: SETUPS.setups.map((each) => ({
        ...each,
        judge: null,
        outcomes: { ...each.outcomes, judge: null },
      })),
    });

    showing();
    await userEvent.click(screen.getByRole('button', { name: 'Show table' }));

    expect(
      screen.queryByRole('columnheader', { name: 'Judge score' }),
    ).not.toBeInTheDocument();
  });

  it('narrows the comparison by task size', async () => {
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Task size: Every size' }),
    );
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
      /replay success on up to 18 runs of past tasks, not live outcomes. Scored by each candidate’s own checks and judge/,
    );
  });

  it('lists the replayed rows in their own section of the table, leaving out the unpriced', async () => {
    showing();

    await narrowingTo('Implementation');
    await userEvent.click(screen.getByRole('button', { name: 'Show table' }));

    const replayed = screen.getByRole('table', { name: 'Replayed candidates' });
    expect(
      within(replayed).getByRole('row', { name: /Live config, replayed/ }),
    ).toBeInTheDocument();
    expect(
      within(replayed).getByRole('row', { name: /opus-with-migrations-skill/ }),
    ).toHaveTextContent('67% of 7 held-out runs');
    expect(
      within(replayed).queryByRole('row', { name: /cursor-careful-profile/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: 'Harness, model, effort and profile' }),
    ).toBeInTheDocument();
  });

  it('leaves out replayed candidates priced in another currency than the setups', async () => {
    answer.setups = held({ ...SETUPS, currency: 'EUR' });

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
    await userEvent.click(
      screen.getByRole('button', { name: 'Outcome: Accepted' }),
    );
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
    answer.setups = held({
      ...SETUPS,
      setups: SETUPS.setups.map((each) => ({ ...each, costPerRun: null })),
    });

    showing();
    await narrowingTo('Implementation');

    expect(
      document.querySelector('[data-slot="replayed-note"]'),
    ).toHaveTextContent(
      'Replayed candidates aren’t drawn: no live setup has a priced outcome.',
    );
  });

  it('keeps the tab whole when the replayed candidates could not be loaded', async () => {
    answer.candidates = held(undefined, 1);

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

  it('names the candidate a config change came from', () => {
    const [marker] = CHANGES.markers;
    origins.origins = [
      {
        stationId: 'station_impl',
        runId: marker?.runId ?? '',
        fingerprint: marker?.fingerprint ?? '',
        changedAt: marker?.firstRunAt ?? '',
        candidateId: 'candidate_opus_skill',
        name: 'opus-with-migrations-skill',
        kind: 'searched',
        lineId: 'line_1',
        searchId: 'search_1',
        replayId: null,
        createdAt: '2026-09-01T09:00:00.000Z',
        withdrawn: false,
      },
    ];

    showing();

    expect(
      screen.getByRole('link', { name: 'opus-with-migrations-skill' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_impl/searches/search_1#candidate-candidate_opus_skill',
    );
  });

  it('says where the candidates the changes came from could not be loaded, and tries again', async () => {
    origins.failed = true;

    showing();

    expect(screen.getByRole('note')).toHaveTextContent(
      'Sorry, which candidate each change came from could not be loaded.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(origins.retry).toHaveBeenCalled();
  });

  it('names a withdrawn candidate a change came from, without a link', () => {
    const [marker] = CHANGES.markers;
    origins.origins = [
      {
        stationId: 'station_impl',
        runId: marker?.runId ?? '',
        fingerprint: marker?.fingerprint ?? '',
        changedAt: marker?.firstRunAt ?? '',
        candidateId: 'candidate_gone',
        name: 'withdrawn-idea',
        kind: 'proposed',
        lineId: 'line_1',
        searchId: null,
        replayId: null,
        createdAt: '2026-09-01T09:00:00.000Z',
        withdrawn: true,
      },
    ];

    showing();

    const from = screen.getByText('withdrawn-idea').closest('p');
    expect(from).toHaveTextContent('From withdrawn-idea (withdrawn)');
    expect(
      screen.queryByRole('link', { name: 'withdrawn-idea' }),
    ).not.toBeInTheDocument();
  });

  it('opens the before and after of a config the station returned to, not its first adoption', async () => {
    const [first] = CHANGES.markers;
    const returned = (runId: string, firstRunAt: string, runs: number) => ({
      ...first,
      runId,
      firstRunAt,
      before: tally({ runs }),
      after: tally({ runs }),
    });
    answer.changes = held({
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
      within(newest).getByRole('button', { name: 'Before and after' }),
    );

    expect(
      rows.map((row) =>
        within(row)
          .getByRole('button', { name: 'Before and after' })
          .getAttribute('aria-pressed'),
      ),
    ).toEqual(['true', 'false', 'false']);
    expect(
      screen.getByRole('complementary', {
        name: 'Before and after the change',
      }),
    ).toHaveTextContent('Runs1313');
  });
});
