import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Station } from '@/routes/Station';

const SEARCH = {
  enabled: true,
  monthlyCeiling: 50,
  currency: 'USD',
  ceiling: 10,
  period: '7d',
  onAlert: true,
  cooldown: '3d',
  agent: null,
  iterations: null,
  repeats: null,
  objective: null,
};

const line = {
  id: 'line_1',
  key: 'default',
  name: 'Default',
  reactions: [],
  source: null,
  replayCheck: null,
  stations: [
    {
      id: 'station_0',
      name: 'Backlog',
      position: 0,
      color: '#a3a8b0',
      kind: 'backlog',
      skills: [],
      alerts: [],
      judge: null,
      search: null,
    },
    {
      id: 'station_1',
      key: 'triage',
      name: 'Triage',
      position: 1,
      color: '#93a1b5',
      description: 'Where new work lands.',
      kind: 'work',
      skills: [],
      alerts: [],
      judge: null,
      search: { ...SEARCH, enabled: false },
    },
    {
      id: 'station_2',
      key: 'spec',
      name: 'Spec',
      position: 2,
      color: '#5c66d9',
      harness: 'claude-code',
      model: 'sonnet',
      effort: 'high',
      agentPrompt: '## Role\n\n- Sort the queue\n- Ask when unsure',
      kind: 'work',
      skills: ['our-migrations', 'grafana-dashboards'],
      search: SEARCH,
      judge: {
        rubric: '## A good run\n\n- Changes only what it must',
        claims: [],
        passThreshold: 1,
        sample: 0.2,
        minAgreement: 0.6,
      },
      alerts: [
        {
          measure: 'sent_back_rate',
          risesBy: 0.2,
          above: null,
          fallsBy: null,
          below: null,
          over: 20,
        },
        {
          measure: 'cost_per_run',
          risesBy: null,
          above: 2,
          fallsBy: null,
          below: null,
          over: 10,
        },
        {
          measure: 'accepted_rate',
          risesBy: null,
          above: null,
          fallsBy: 0.1,
          below: null,
          over: 20,
        },
      ],
    },
    {
      id: 'station_3',
      name: 'Completed',
      position: 3,
      color: '#a3a8b0',
      kind: 'completed',
      skills: [],
      alerts: [],
      judge: null,
      search: null,
    },
  ],
  repositories: [
    {
      fullName: 'usespotlightai/spotlight',
      host: 'github',
      url: 'https://github.com/usespotlightai/spotlight',
    },
  ],
};

const lines = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();

vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({
    data: lines(),
    isPending: lines() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch,
  }),
}));

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: { teams: [{ id: 'team_1', name: 'Platform' }] },
    isPending: false,
  }),
}));

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({
    data: [
      {
        id: 'claude-code',
        name: 'Claude Code',
        models: [{ id: 'sonnet', name: 'Sonnet' }],
        defaultModel: 'sonnet',
        efforts: ['low', 'high'],
      },
    ],
  }),
}));

const outcomes = vi.fn();
const outcomesFailing = vi.fn();
const outcomesError = vi.fn();
const refetchOutcomes = vi.fn();

vi.mock('@/hooks/api/useStationInsights', () => ({
  useStationInsights: () => ({
    data: outcomes(),
    isPending: outcomes() === undefined,
    errorUpdateCount: outcomesFailing() ? 1 : 0,
    error: outcomesError(),
    isFetching: false,
    refetch: refetchOutcomes,
  }),
}));

const judged = vi.fn();
const judgeFailing = vi.fn();

const worthImproving = vi.fn();

vi.mock('@/hooks/api/useInsightsOverview', () => ({
  useInsightsOverview: () => ({
    data: { worthImproving: worthImproving() },
    isPending: false,
    errorUpdateCount: 0,
  }),
}));

vi.mock('@/hooks/api/useStationJudge', () => ({
  useStationJudge: () => ({
    data: judged(),
    isPending: judged() === undefined,
    errorUpdateCount: judgeFailing() ? 1 : 0,
    error: null,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

const improvement = vi.fn();

vi.mock('@/hooks/api/useStationImprovement', () => ({
  useStationImprovement: () => ({
    data: improvement(),
    isPending: improvement() === undefined,
    errorUpdateCount: 0,
  }),
}));

const IMPROVEMENT = {
  status: 'waiting',
  searchId: null,
  pickPhase: null,
  pullRequestUrl: null,
  improvedAt: null,
  skip: null,
  pullRequestFailure: null,
  minimumTasks: 5,
  setId: 'set_1',
  lastStartedAt: null,
  checkAfter: '2026-10-30T09:00:00.000Z',
};

vi.mock('@/hooks/api/useStationCandidates', () => ({
  useStationCandidates: () => ({
    path: 'core/default/spec',
    pathFailed: false,
    candidates: { data: [], isPending: false, errorUpdateCount: 0 },
  }),
}));

const TALLY = {
  runs: 42,
  failed: 1,
  stopped: 0,
  checksPassed: 30,
  checksFailed: 2,
  accepted: 28,
  sentBack: 3,
  cancelled: 0,
  passed: 0,
  merged: 20,
  cost: null,
  medianMs: null,
  p90Ms: null,
  unpriced: 0,
  mixedCurrencies: false,
};

const run = (runId: string, ending: string) => ({
  runId,
  taskId: `task_${runId}`,
  endedAt: new Date().toISOString(),
  ending,
  failure: null,
  visit: 1,
  usage: null,
  checks: 'passed',
  firstHumanAction: null,
  passed: null,
  pullRequestState: null,
});

const OUTCOMES = {
  stationId: 'station_2',
  groups: [
    {
      ran: true,
      pullRequest: null,
      firstRunId: 'run_2',
      fingerprint: 'a'.repeat(64),
      config: null,
      changes: [],
      tally: TALLY,
      runs: [run('run_3', 'completed'), run('run_2', 'failed')],
    },
    {
      ran: true,
      pullRequest: null,
      firstRunId: 'run_1',
      fingerprint: 'b'.repeat(64),
      config: null,
      changes: [],
      tally: TALLY,
      runs: [run('run_1', 'stopped')],
    },
  ],
  inForce: { tally: TALLY },
};

const CALIBRATION = {
  qualified: true,
  measure: 'kappa',
  agreement: 0.71,
  pairs: 24,
  minAgreement: 0.6,
  hiddenReason: null,
};

const INSIGHTS = '/w/acme/team/team_1/insights';
const STATION = '/w/acme/team/team_1/lines/line_1/stations/station_2';

function HandedOver() {
  const { state } = useLocation();

  return (
    <>
      <pre data-slot="handed-over">{JSON.stringify(state?.targetStation)}</pre>
      <pre data-slot="handed-prompt">{state?.prompt ?? ''}</pre>
    </>
  );
}

const renderAt = (stationId: string) =>
  render(
    <MemoryRouter
      initialEntries={[
        `/w/acme/team/team_1/lines/line_1/stations/${stationId}`,
      ]}
    >
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/lines/:lineId/stations/:stationId"
          element={<Station />}
        />
        <Route path="/w/:slug/team/:teamId/agent" element={<HandedOver />} />
      </Routes>
    </MemoryRouter>,
  );

const laidOut = ({ track, slide }: { track: number; slide: number }) => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(track);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(
    slide - 8,
  );
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(
    function (this: HTMLElement) {
      return [...(this.parentElement?.children ?? [])].indexOf(this) * slide;
    },
  );
};

const sectionTitled = (title: string) =>
  screen
    .getByRole('heading', { name: title })
    .closest('section') as HTMLElement;

beforeEach(() => {
  lines.mockReturnValue([line]);
  failing.mockReturnValue(false);
  refetch.mockClear();
  outcomes.mockReturnValue(OUTCOMES);
  outcomesFailing.mockReturnValue(false);
  outcomesError.mockReturnValue(null);
  refetchOutcomes.mockClear();
  judged.mockReturnValue({ calibration: CALIBRATION });
  worthImproving.mockReturnValue([]);
  judgeFailing.mockReturnValue(false);
  improvement.mockReturnValue(IMPROVEMENT);
  localStorage.clear();
});

describe('Station', () => {
  it('opens on the station’s own name and what it is for', () => {
    renderAt('station_1');

    expect(screen.getByRole('heading', { name: 'Triage' })).toBeInTheDocument();
    expect(screen.getByText('Where new work lands.')).toBeInTheDocument();
  });

  it('names the team, the line and the station it is showing', () => {
    renderAt('station_1');

    expect(
      screen.getByRole('heading', { name: /Platform\s*Default\s*Triage/ }),
    ).toBeInTheDocument();
  });

  it('walks back to the team and the board from the breadcrumbs, leaving the station unlinked', () => {
    renderAt('station_1');

    const crumbs = within(
      screen.getByRole('heading', { name: /Platform\s*Default\s*Triage/ }),
    );

    expect(crumbs.getByRole('link', { name: /Platform/ })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1',
    );
    expect(crumbs.getByRole('link', { name: 'Default' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1',
    );
    expect(
      crumbs.queryByRole('link', { name: 'Triage' }),
    ).not.toBeInTheDocument();
  });

  it('paints its icon the colour the station carries', () => {
    renderAt('station_1');

    expect(
      document.querySelector('[data-slot="station-icon"] circle'),
    ).toHaveAttribute('stroke', '#93a1b5');
  });

  it('keeps the shape of the station while the line loads', () => {
    lines.mockReturnValue(undefined);

    renderAt('station_2');

    expect(
      screen.getByRole('status', { name: 'Loading the station' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Station not found')).not.toBeInTheDocument();
  });

  it('keeps the shape of the overview while the line loads', () => {
    lines.mockReturnValue(undefined);

    renderAt('station_2');

    const overview = screen.getByRole('status', {
      name: 'Loading the station',
    });
    expect(overview).toHaveTextContent('What needs attention');
    expect(overview).toHaveTextContent('Config');
    expect(overview).toHaveTextContent('Latest runs on this config');
    expect(
      within(overview).queryByRole('status', {
        name: 'Loading the improvement status',
      }),
    ).not.toBeInTheDocument();
  });

  it('keeps the shape of the overview until the improvement status lands', () => {
    improvement.mockReturnValue(undefined);

    renderAt('station_2');

    expect(
      screen.getByRole('status', { name: 'Loading the station overview' }),
    ).toBeInTheDocument();
  });

  it('says the station could not be loaded, and tries again on request', async () => {
    const user = userEvent.setup();
    lines.mockReturnValue(undefined);
    failing.mockReturnValue(true);

    renderAt('station_2');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The station could not be loaded.',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('says so when there is no station at that address', () => {
    renderAt('station_missing');

    expect(
      screen.getByRole('heading', { name: 'Station not found' }),
    ).toBeInTheDocument();
  });

  describe('its ends', () => {
    it('says nothing runs at the backlog, offering no tabs', () => {
      renderAt('station_0');

      expect(screen.getByText(/Nothing runs at a backlog/)).toBeInTheDocument();
      expect(
        screen.queryByRole('navigation', { name: 'Station' }),
      ).not.toBeInTheDocument();
    });

    it('says nothing runs where tasks are completed, offering nothing to improve', () => {
      renderAt('station_3');

      expect(
        screen.getByText(/the line is done with them/),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Worth improving' }),
      ).not.toBeInTheDocument();
    });
  });

  it('offers the overview as its one tab, opening on what needs attention', () => {
    renderAt('station_2');

    const tabs = within(screen.getByRole('navigation', { name: 'Station' }));

    expect(tabs.getAllByRole('link')).toHaveLength(1);
    expect(tabs.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(tabs.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_2',
    );
    expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent(
      'What needs attention',
    );
    expect(
      screen.getByRole('heading', { name: 'Recent runs' }),
    ).toBeInTheDocument();
  });

  describe('its overview', () => {
    it('sums up the latest runs on the live config, linking to the station in Insights', () => {
      renderAt('station_2');

      expect(
        [...document.querySelectorAll('[data-slot="summary-tile"]')]
          .slice(0, 4)
          .map((tile) => tile.textContent),
      ).toEqual([
        'Runs42',
        'Accepted28of 42 runs',
        'Sent back3of 42 runs',
        'Failed1of 42 runs',
      ]);
      expect(
        within(sectionTitled('Latest runs on this config')).getByRole('link', {
          name: 'See in Insights',
        }),
      ).toHaveAttribute('href', `${INSIGHTS}?tab=stations&stationId=station_2`);
    });

    it('sums up nothing where no run has run a config yet', () => {
      outcomes.mockReturnValue({ ...OUTCOMES, inForce: null });

      renderAt('station_2');

      expect(
        screen.queryByRole('heading', { name: 'Latest runs on this config' }),
      ).not.toBeInTheDocument();
    });

    it('offers no paging where every alert fits', () => {
      renderAt('station_2');

      expect(
        screen.queryByRole('button', { name: 'Next alert rule' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /^Show page/ }),
      ).not.toBeInTheDocument();
    });

    it('pages through the station’s alerts where they overflow', async () => {
      const user = userEvent.setup();
      laidOut({ track: 200, slide: 180 });
      renderAt('station_2');

      const previous = screen.getByRole('button', {
        name: 'Previous alert rule',
      });
      const next = screen.getByRole('button', { name: 'Next alert rule' });

      expect(previous).toBeDisabled();

      await user.click(next);
      await user.click(next);

      expect(next).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Show page 3 of 3' }),
      ).toHaveAttribute('aria-current', 'true');
    });

    it('counts only the pages the track can scroll to', () => {
      laidOut({ track: 450, slide: 180 });
      renderAt('station_2');

      expect(
        screen.getAllByRole('button', { name: /^Show page/ }),
      ).toHaveLength(2);
    });

    it('links to the pull request that brought the live config', () => {
      outcomes.mockReturnValue({
        ...OUTCOMES,
        groups: OUTCOMES.groups.map((group, at) =>
          at === 0
            ? {
                ...group,
                pullRequest: { url: 'https://github.com/acme/config/pull/42' },
              }
            : group,
        ),
      });

      renderAt('station_2');

      expect(
        within(sectionTitled('Config fingerprint')).getByRole('link', {
          name: 'View pull request',
        }),
      ).toHaveAttribute('href', 'https://github.com/acme/config/pull/42');
    });

    it('offers no pull request where none brought the config', () => {
      renderAt('station_2');

      expect(
        screen.queryByRole('link', { name: 'View pull request' }),
      ).not.toBeInTheDocument();
    });

    it('says which config fingerprint is live, linking to its history', () => {
      renderAt('station_2');

      const fingerprint = within(sectionTitled('Config fingerprint'));

      expect(fingerprint.getByText('Config aaaaaaaa')).toBeInTheDocument();
      expect(
        fingerprint.getByRole('link', { name: 'History' }),
      ).toHaveAttribute('href', `${INSIGHTS}?tab=stations&stationId=station_2`);
    });

    it('lists the station’s alerts in the order they were written', () => {
      renderAt('station_2');

      expect(
        within(screen.getByRole('list', { name: 'Alert rules' }))
          .getAllByRole('listitem')
          .map((each) => each.getAttribute('aria-label')),
      ).toEqual([
        'Alerts when the sent-back rate rises 20 points or more over 20 runs',
        'Alerts when the cost per run goes above 2.00 over 10 runs',
        'Alerts when the accepted rate falls 10 points or more over 20 runs',
      ]);
    });

    it('says how far the judge agrees with people, linking to its agreement in Insights', () => {
      renderAt('station_2');

      expect(
        document.querySelector('[data-slot="judge-calibration"]'),
      ).toHaveTextContent('Cohen’s kappa0.71Qualified above 0.60 over 24 runs');
      expect(
        screen.getByRole('link', { name: 'How it agrees with people' }),
      ).toHaveAttribute(
        'href',
        `${INSIGHTS}?tab=stations&stationId=station_2#judge`,
      );
    });

    it('leaves out how far the judge agrees with people where its agreement could not load', () => {
      judged.mockReturnValue(undefined);
      judgeFailing.mockReturnValue(true);

      renderAt('station_2');

      expect(
        document.querySelector('[data-slot="judge-calibration"]'),
      ).not.toBeInTheDocument();
      expect(sectionTitled('Judge')).toHaveTextContent(
        'Qualified from 0.60 agreement',
      );
    });

    it('shows no alerts and no judge calibration where none are set', () => {
      renderAt('station_1');

      expect(
        screen.queryByRole('link', { name: 'How it agrees with people' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: /^Alert rules/ }),
      ).not.toBeInTheDocument();
    });

    it('lists the recent runs of the live config newest first, each linking to the run', () => {
      renderAt('station_2');

      const runs = within(screen.getByRole('list', { name: 'Recent runs' }));

      expect(
        runs
          .getAllByRole('link')
          .map((each) => [each.textContent, each.getAttribute('href')]),
      ).toEqual([
        ['Completed', '/w/acme/team/team_1/runs/run_3'],
        ['Failed', '/w/acme/team/team_1/runs/run_2'],
      ]);
    });

    it('links to all the station’s runs in Insights', () => {
      renderAt('station_2');

      expect(screen.getByRole('link', { name: 'All runs' })).toHaveAttribute(
        'href',
        `${INSIGHTS}?tab=traces&stationId=station_2`,
      );
    });

    it('keeps the place of its runs while they load', () => {
      outcomes.mockReturnValue(undefined);

      renderAt('station_2');

      expect(
        screen.getByRole('status', { name: 'Loading the station’s runs' }),
      ).toBeInTheDocument();
    });

    it('says its runs could not be loaded, and tries again on request', async () => {
      const user = userEvent.setup();
      outcomes.mockReturnValue(undefined);
      outcomesFailing.mockReturnValue(true);

      renderAt('station_2');

      expect(screen.getByRole('alert')).toHaveTextContent(
        'The station’s runs could not be loaded.',
      );

      await user.click(screen.getByRole('button', { name: 'Try again' }));

      expect(refetchOutcomes).toHaveBeenCalled();
    });

    it('tells someone off the team that only its members can see its runs', () => {
      outcomes.mockReturnValue(undefined);
      outcomesFailing.mockReturnValue(true);
      outcomesError.mockReturnValue({ statusCode: 404 });

      renderAt('station_2');

      expect(
        screen.getByText('Only team members can see this station’s runs'),
      ).toBeInTheDocument();
    });

    it('says no run has reached the station yet, and offers to create a task', () => {
      outcomes.mockReturnValue({
        stationId: 'station_2',
        groups: [],
        inForce: null,
      });

      renderAt('station_2');

      const runs = sectionTitled('Recent runs');

      expect(within(runs).getByText('No runs yet')).toBeInTheDocument();
      expect(
        within(runs).getByRole('link', { name: 'Create a task' }),
      ).toHaveAttribute('href', '/w/acme/team/team_1/lines/line_1');
      expect(
        screen.queryByRole('link', { name: 'All runs' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('what needs attention', () => {
    it('says what Spotlight does to improve the station beside the signals', () => {
      renderAt('station_2');

      const attention = sectionTitled('What needs attention');

      expect(
        within(attention).getByRole('link', {
          name: 'Waiting for next check',
        }),
      ).toHaveAttribute('href', `${STATION}/replay-sets/set_1`);
      expect(
        within(attention).getByRole('heading', { name: 'Worth improving' }),
      ).toBeInTheDocument();
    });

    it('shows what got worse at the station against before and the team', () => {
      worthImproving.mockReturnValue([
        {
          lineId: 'line_1',
          stationId: 'station_2',
          runs: 20,
          worstBy: 2.5,
          mixedCurrencies: false,
          signals: [
            {
              signal: 'sent-back',
              now: 0.3,
              before: 0.1,
              team: 0.12,
              rose: true,
              trails: true,
              flaggedAbove: 0.2,
            },
          ],
        },
      ]);

      renderAt('station_2');

      expect(
        within(sectionTitled('Worth improving'))
          .getAllByRole('img')
          .map((each) => each.getAttribute('aria-label')),
      ).toEqual([expect.stringMatching(/^Sent back 30%/)]);
    });

    it('opens a chat with the agent about one signal, handing over the station and what needs attention', async () => {
      const user = userEvent.setup();
      worthImproving.mockReturnValue([
        {
          lineId: 'line_1',
          stationId: 'station_2',
          runs: 20,
          worstBy: 2.5,
          mixedCurrencies: false,
          signals: [
            {
              signal: 'sent-back',
              now: 0.3,
              before: 0.1,
              team: 0.12,
              rose: true,
              trails: true,
              flaggedAbove: 0.2,
            },
          ],
        },
      ]);

      renderAt('station_2');

      await user.click(
        within(
          screen.getByRole('list', { name: 'Signals worth improving' }),
        ).getByRole('link', { name: 'Ask the agent' }),
      );

      expect(
        screen.queryByRole('link', { name: 'Review with agent' }),
      ).not.toBeInTheDocument();
      expect(
        document.querySelector('[data-slot="handed-prompt"]'),
      ).toHaveTextContent(
        /^Sent back 30%.*What should change at this station\?$/,
      );
      expect(
        JSON.parse(
          document.querySelector('[data-slot="handed-over"]')?.textContent ??
            '',
        ),
      ).toMatchObject({ stationId: 'station_2' });
    });

    it('says when nothing needs attention', () => {
      renderAt('station_2');

      expect(sectionTitled('Worth improving')).toHaveTextContent(
        'All signals are healthy',
      );
    });

    it('hands the station to the agent when nothing needs attention', async () => {
      const user = userEvent.setup();
      renderAt('station_2');

      await user.click(
        within(sectionTitled('Worth improving')).getByRole('link', {
          name: 'Review with agent',
        }),
      );

      expect(
        document.querySelector('[data-slot="handed-prompt"]'),
      ).toBeEmptyDOMElement();

      expect(
        JSON.parse(
          document.querySelector('[data-slot="handed-over"]')?.textContent ??
            '',
        ),
      ).toEqual({
        lineId: 'line_1',
        lineKey: 'default',
        lineName: 'Default',
        stationId: 'station_2',
        stationKey: 'spec',
        stationName: 'Spec',
      });
    });
  });

  describe('its config', () => {
    it('shows the harness, model and effort the station runs on', () => {
      renderAt('station_2');

      expect(
        document.querySelector('[data-slot="station-agent"]'),
      ).toHaveTextContent('SonnetClaude Code');
      expect(
        screen.getByRole('list', { name: 'Effort: High, 2 of 2' }),
      ).toBeInTheDocument();
    });

    it('says no agent works the station where no harness is set', () => {
      renderAt('station_1');

      expect(
        document.querySelector('[data-slot="station-agent"]'),
      ).toHaveTextContent('No agent');
    });

    it('shows the skills the station enables for its runs', () => {
      renderAt('station_2');

      expect(
        within(screen.getByRole('list', { name: 'Skills' }))
          .getAllByRole('listitem')
          .map((each) => each.textContent),
      ).toEqual(['our-migrations', 'grafana-dashboards']);
    });

    it('lists no skills where a station enables none', () => {
      renderAt('station_1');

      expect(
        screen.queryByRole('list', { name: 'Skills' }),
      ).not.toBeInTheDocument();
    });

    it('renders the prompt rather than its markdown, without letting it be written', () => {
      renderAt('station_2');

      expect(screen.getByLabelText('Agent prompt')).toHaveAttribute(
        'contenteditable',
        'false',
      );
      expect(screen.getByRole('heading', { name: 'Role' })).toBeInTheDocument();
      expect(screen.getByText('Sort the queue')).toBeInTheDocument();
      expect(screen.queryByText(/^## Role/)).not.toBeInTheDocument();
    });

    it('says so where a station has no prompt', () => {
      renderAt('station_1');

      expect(screen.getByText('No prompt.')).toBeInTheDocument();
    });

    it('shows how much of the station’s work its judge scores, and the minimum agreement it needs', () => {
      renderAt('station_2');

      const judge = sectionTitled('Judge');

      expect(judge).toHaveTextContent('20%of runs judged');
      expect(
        within(judge).getByRole('img', {
          name: 'Cohen’s kappa 0.71. Minimum required: 0.60',
        }),
      ).toBeInTheDocument();
    });

    it('keeps the rubric collapsed until requested, then shows it without letting it be written', async () => {
      const user = userEvent.setup();
      renderAt('station_2');

      const rubric = screen.getByRole('button', { name: 'Show rubric' });

      expect(rubric).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByLabelText('Rubric')).not.toBeInTheDocument();

      await user.click(rubric);

      expect(rubric).toHaveAttribute('aria-expanded', 'true');
      expect(rubric).toHaveTextContent('Hide rubric');
      expect(screen.getByLabelText('Rubric')).toHaveAttribute(
        'contenteditable',
        'false',
      );
      expect(
        screen.getByRole('heading', { name: 'A good run' }),
      ).toBeInTheDocument();
    });

    it('says only people score runs where no judge is set', () => {
      renderAt('station_1');

      expect(sectionTitled('Judge')).toHaveTextContent(
        'No judgeOnly people score runs here.',
      );
    });

    it('says how Spotlight improves the station on its own, with the rest on hover', async () => {
      const user = userEvent.setup();
      renderAt('station_2');

      const improvement = sectionTitled('Automatic improvement');

      expect(improvement).toHaveTextContent(
        'OnUp to $10 a search · every 7 days',
      );

      await user.hover(
        improvement.querySelector('[data-slot="search-policy"]') as Element,
      );

      expect(
        await screen.findByText('Line ceiling a month'),
      ).toBeInTheDocument();
    });

    it('shows no automatic improvement at the ends of the line', () => {
      for (const end of ['station_0', 'station_3']) {
        const { unmount } = renderAt(end);

        expect(
          screen.queryByRole('heading', { name: 'Automatic improvement' }),
        ).not.toBeInTheDocument();
        unmount();
      }
    });

    it('says no search runs where automatic improvement is off', () => {
      renderAt('station_1');

      expect(sectionTitled('Automatic improvement')).toHaveTextContent(
        'OffNo automatic searches',
      );
    });

    it('names the line of the station and its repositories', () => {
      renderAt('station_2');

      const fromLine = within(sectionTitled('Line'));

      expect(fromLine.getByText('Default')).toBeInTheDocument();
      expect(
        fromLine.getByText('usespotlightai/spotlight'),
      ).toBeInTheDocument();
      expect(fromLine.queryByText(/replay_check/)).not.toBeInTheDocument();
    });
  });
});
