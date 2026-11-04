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
      firstDay: '2026-10-28',
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
function HandedOver() {
  const { state } = useLocation();

  return (
    <>
      <pre data-slot="handed-over">{JSON.stringify(state?.targetStation)}</pre>
      <pre data-slot="handed-prompt">{state?.prompt ?? ''}</pre>
    </>
  );
}

const renderAt = (stationId: string, tab = 'activity') =>
  render(
    <MemoryRouter
      initialEntries={[
        `/w/acme/team/team_1/lines/line_1/stations/${stationId}${tab && `/${tab}`}`,
      ]}
    >
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/lines/:lineId/stations/:stationId/:tab?"
          element={<Station />}
        />
        <Route path="/w/:slug/team/:teamId/agent" element={<HandedOver />} />
      </Routes>
    </MemoryRouter>,
  );

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
      screen.getByRole('navigation', { name: 'Breadcrumb' }),
    ).toHaveTextContent(/Platform\s*Default\s*Triage/);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Triage' }),
    ).toBeInTheDocument();
  });

  it('walks back to the team and the board from the breadcrumbs, leaving the station unlinked', () => {
    renderAt('station_1');

    const crumbs = within(
      screen.getByRole('navigation', { name: 'Breadcrumb' }),
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
    expect(overview).toHaveTextContent('Runs');
    expect(overview).toHaveTextContent('Latest runs on this config');
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

  it('offers the config and the activity as tabs, opening on the config', () => {
    renderAt('station_2', '');

    const tabs = within(screen.getByRole('navigation', { name: 'Station' }));

    expect(tabs.getAllByRole('link').map((each) => each.textContent)).toEqual([
      'Config',
      'Activity',
    ]);
    expect(tabs.getByRole('link', { name: 'Config' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(tabs.getByRole('link', { name: 'Activity' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_2/activity',
    );
    expect(screen.getByRole('region', { name: 'Config' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'What needs attention' }),
    ).not.toBeInTheDocument();
  });

  it('shows the activity on its own tab', () => {
    renderAt('station_2', 'activity');

    expect(
      within(screen.getByRole('navigation', { name: 'Station' })).getByRole(
        'link',
        { name: 'Activity' },
      ),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      screen.getByRole('heading', { name: 'What needs attention' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Config' }),
    ).not.toBeInTheDocument();
  });

  it('says so when the station has no such tab', () => {
    renderAt('station_2', 'improve');

    expect(
      screen.getByRole('heading', { name: 'Station not found' }),
    ).toBeInTheDocument();
  });

  describe('its overview', () => {
    it('sums up the latest runs on the live config, linking to the station in Insights', () => {
      renderAt('station_2');

      expect(
        [...document.querySelectorAll('[data-slot="insights-tile"]')]
          .slice(0, 4)
          .map((stat) => stat.textContent),
      ).toEqual([
        'Runs42',
        'Failed12% of runs',
        'Accepted2867% of runs',
        'Sent back37% of runs',
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
    it('shows what is worth improving at the station', () => {
      renderAt('station_2');

      const attention = sectionTitled('What needs attention');

      expect(attention).toHaveTextContent('All signals are healthy');
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
        within(sectionTitled('What needs attention'))
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
        document.querySelector('[data-slot="signals-healthy"]'),
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

      expect(sectionTitled('What needs attention')).toHaveTextContent(
        'All signals are healthy',
      );
    });

    it('hands the station to the agent when nothing needs attention', async () => {
      const user = userEvent.setup();
      renderAt('station_2');

      await user.click(
        within(sectionTitled('What needs attention')).getByRole('link', {
          name: 'Ask the agent',
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
    const properties = () =>
      within(screen.getByRole('complementary', { name: 'Properties' }));

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

      renderAt('station_2', 'config');

      expect(
        screen.getByRole('link', { name: 'Pull request' }),
      ).toHaveAttribute('href', 'https://github.com/acme/config/pull/42');
    });

    it('offers no pull request where none brought the config', () => {
      renderAt('station_2', 'config');

      expect(
        screen.queryByRole('link', { name: 'Pull request' }),
      ).not.toBeInTheDocument();
    });

    it('says since when the config is live, with its fingerprint on hover, linking to its history', async () => {
      const user = userEvent.setup();
      renderAt('station_2', 'config');

      const live = document.querySelector(
        '[data-slot="live-config"]',
      ) as HTMLElement;

      expect(live).toHaveTextContent('SinceOct 28');
      expect(
        properties().getByRole('link', { name: 'History' }),
      ).toHaveAttribute('href', `${INSIGHTS}?tab=stations&stationId=station_2`);

      await user.hover(within(live).getByText('Oct 28'));

      expect(await screen.findByText('Config aaaaaaaa')).toBeInTheDocument();
    });

    it('lists the station’s alerts in the order they were written, one row each', () => {
      renderAt('station_2', 'config');

      const rows = within(
        screen.getByRole('list', { name: 'Alert rules' }),
      ).getAllByRole('listitem');

      expect(rows.map((each) => each.getAttribute('aria-label'))).toEqual([
        'Alerts when the sent-back rate rises 20 points or more over 20 runs',
        'Alerts when the cost per run goes above $2.00 over 10 runs',
        'Alerts when the accepted rate falls 10 points or more over 20 runs',
      ]);
      expect(rows[0]).toHaveTextContent(
        'Sent-back raterises 20 points or moreover 20 runs',
      );
    });

    it('says how far the judge agrees with people, linking to its agreement in Insights', () => {
      renderAt('station_2', 'config');

      expect(
        document.querySelector('[data-slot="judge-calibration"]'),
      ).toHaveTextContent('0.71Strong');
      expect(
        screen.getByRole('link', { name: 'Agreement history' }),
      ).toHaveAttribute(
        'href',
        `${INSIGHTS}?tab=stations&stationId=station_2#judge`,
      );
    });

    it('leaves out how far the judge agrees with people where its agreement could not load', () => {
      judged.mockReturnValue(undefined);
      judgeFailing.mockReturnValue(true);

      renderAt('station_2', 'config');

      expect(
        document.querySelector('[data-slot="judge-calibration"]'),
      ).not.toBeInTheDocument();
      expect(sectionTitled('Judge')).toHaveTextContent(
        'AgreementSorry, it couldn’t be loaded.Minimum agreement0.60',
      );
    });

    it('shows no alerts and no judge calibration where none are set', () => {
      renderAt('station_1', 'config');

      expect(
        screen.queryByRole('link', { name: 'Agreement history' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Alert rules' }),
      ).not.toBeInTheDocument();
    });

    it('shows the harness, model and effort the station runs on', () => {
      renderAt('station_2', 'config');

      expect(
        document.querySelector('[data-slot="station-agent"]'),
      ).toHaveTextContent('Claude Code');
      expect(properties().getByText('Sonnet')).toBeInTheDocument();
      expect(
        screen.getByRole('img', { name: 'Effort: High, 2 of 2' }),
      ).toBeInTheDocument();
    });

    it('says no agent works the station where no harness is set', () => {
      renderAt('station_1', 'config');

      expect(
        document.querySelector('[data-slot="station-agent"]'),
      ).toHaveTextContent('No agent');
    });

    it('shows the skills the station enables for its runs', () => {
      renderAt('station_2', 'config');

      expect(
        within(screen.getByRole('list', { name: 'Skills' }))
          .getAllByRole('listitem')
          .map((each) => each.textContent),
      ).toEqual(['our-migrations', 'grafana-dashboards']);
    });

    it('lists no skills where a station enables none', () => {
      renderAt('station_1', 'config');

      expect(
        screen.queryByRole('list', { name: 'Skills' }),
      ).not.toBeInTheDocument();
    });

    it('renders the prompt rather than its markdown, without letting it be written', () => {
      renderAt('station_2', 'config');

      expect(screen.getByLabelText('Agent prompt')).toHaveAttribute(
        'contenteditable',
        'false',
      );
      expect(screen.getByRole('heading', { name: 'Role' })).toBeInTheDocument();
      expect(screen.getByText('Sort the queue')).toBeInTheDocument();
      expect(screen.queryByText(/^## Role/)).not.toBeInTheDocument();
    });

    it('says so where a station has no prompt', () => {
      renderAt('station_1', 'config');

      expect(screen.getByText('No prompt.')).toBeInTheDocument();
    });

    it('shows the sample rate of the station’s judge, and the minimum agreement it needs', () => {
      renderAt('station_2', 'config');

      const judge = sectionTitled('Judge');

      expect(judge).toHaveTextContent('Scores20% of runs');
      expect(judge).toHaveTextContent('Minimum agreement0.60');
    });

    it('shows the rubric read-only in the judge section', async () => {
      renderAt('station_2', 'config');

      expect(
        await screen.findByLabelText('The judge’s rubric'),
      ).toHaveAttribute('contenteditable', 'false');
      expect(
        screen.getByRole('heading', { name: 'A good run' }),
      ).toBeInTheDocument();
    });

    it('says only people score runs where no judge is set', () => {
      renderAt('station_1', 'config');

      expect(sectionTitled('Judge')).toHaveTextContent(
        'No judge. Only people score runs here.',
      );
    });

    it('says how often Spotlight improves the station and what a search costs, with the rest on hover', async () => {
      const user = userEvent.setup();
      renderAt('station_2', 'config');

      const improvement = document.querySelector(
        '[data-slot="search-policy"]',
      ) as HTMLElement;

      expect(improvement).toHaveTextContent(
        'SearchesEvery 7 daysBudgetUp to $10 a search',
      );

      await user.hover(
        sectionTitled('Automatic improvement').querySelector('svg.lucide-info')
          ?.parentElement as Element,
      );

      expect(await screen.findByText('Cooldown')).toBeInTheDocument();
    });

    it('shows no automatic improvement at the ends of the line', () => {
      for (const end of ['station_0', 'station_3']) {
        const { unmount } = renderAt(end);

        expect(
          document.querySelector('[data-slot="search-policy"]'),
        ).not.toBeInTheDocument();
        unmount();
      }
    });

    it('says automatic improvement is off where it is off', () => {
      renderAt('station_1', 'config');

      expect(
        document.querySelector('[data-slot="search-policy"]'),
      ).toHaveTextContent('SearchesOff');
    });

    it('names the line of the station and its repositories', () => {
      renderAt('station_2', 'config');

      expect(properties().getByText('Default')).toBeInTheDocument();
      expect(
        properties().getByRole('link', { name: 'usespotlightai/spotlight' }),
      ).toBeInTheDocument();
      expect(properties().queryByText(/replay_check/)).not.toBeInTheDocument();
    });
  });
});
