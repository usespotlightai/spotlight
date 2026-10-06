import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Station } from '@/routes/Station';

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
      judge: {
        rubric: '## A good run\n\n- Changes only what it must',
        claims: [],
        passShare: 1,
        sample: 0.2,
        trust: 0.6,
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
    },
  ],
  repositories: ['usespotlightai/spotlight'],
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

vi.mock('@/hooks/api/useStationOutcomes', () => ({
  useStationOutcomes: () => ({
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

const sets = vi.fn();
const setsFailing = vi.fn();
const refetchSets = vi.fn();

vi.mock('@/hooks/api/useReplaySets', () => ({
  useReplaySets: () => ({
    data: sets(),
    isPending: sets() === undefined,
    errorUpdateCount: setsFailing() ? 1 : 0,
    error: null,
    isFetching: false,
    refetch: refetchSets,
  }),
}));

vi.mock('@/hooks/api/useSearches', () => ({
  useSearches: () => ({
    data: [],
    isPending: false,
    errorUpdateCount: 0,
  }),
}));

vi.mock('@/hooks/api/useSearchEstimate', () => ({
  useSearchEstimate: () => ({ data: undefined, isFetching: false }),
}));

vi.mock('@/hooks/api/useStartSearch', () => ({
  useStartSearch: () => ({ mutate: vi.fn(), isPending: false, reset: vi.fn() }),
}));

vi.mock('@/hooks/api/useOpenReplaySet', () => ({
  useOpenReplaySet: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/api/useStationCandidates', () => ({
  useStationCandidates: () => ({
    address: 'core/default/spec',
    addressFailed: false,
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
  withdrawn: 0,
  handedOn: 0,
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
  round: 1,
  cost: null,
  checks: 'passed',
  next: null,
  handedOn: null,
  delivery: null,
});

const OUTCOMES = {
  stationId: 'station_2',
  groups: [
    {
      ran: true,
      firstRunId: 'run_2',
      fingerprint: 'a'.repeat(64),
      config: null,
      changes: [],
      tally: TALLY,
      runs: [run('run_3', 'completed'), run('run_2', 'failed')],
    },
    {
      ran: true,
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

const STANDING = {
  trusted: true,
  measure: 'kappa',
  agreement: 0.71,
  pairs: 24,
  trust: 0.6,
  hiddenBecause: null,
};

const INSIGHTS = '/w/acme/team/team_1/insights';
const STATION = '/w/acme/team/team_1/lines/line_1/stations/station_2';

function HandedOver() {
  const { state } = useLocation();

  return <pre data-slot="handed-over">{JSON.stringify(state?.improving)}</pre>;
}

const renderAt = (stationId: string, tab?: string) =>
  render(
    <MemoryRouter
      initialEntries={[
        `/w/acme/team/team_1/lines/line_1/stations/${stationId}${tab ? `/${tab}` : ''}`,
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

const setting = (label: string) =>
  screen.getByText(label, { selector: 'dt' }).nextElementSibling;

beforeEach(() => {
  lines.mockReturnValue([line]);
  failing.mockReturnValue(false);
  refetch.mockClear();
  outcomes.mockReturnValue(OUTCOMES);
  outcomesFailing.mockReturnValue(false);
  outcomesError.mockReturnValue(null);
  refetchOutcomes.mockClear();
  judged.mockReturnValue({ standing: STANDING });
  judgeFailing.mockReturnValue(false);
  sets.mockReturnValue([]);
  setsFailing.mockReturnValue(false);
  refetchSets.mockClear();
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

    expect(screen.getByRole('link', { name: /Platform/ })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1',
    );
    expect(screen.getByRole('link', { name: 'Default' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1',
    );
    expect(
      screen.queryByRole('link', { name: 'Triage' }),
    ).not.toBeInTheDocument();
  });

  it('paints its icon the colour the station carries', () => {
    renderAt('station_1');

    expect(
      document.querySelector('[data-slot="station-icon"] circle'),
    ).toHaveAttribute('stroke', '#93a1b5');
  });

  it('names the agent that works the station under its name', () => {
    renderAt('station_2');

    expect(
      document.querySelector('[data-slot="station-agent"]'),
    ).toHaveTextContent('Claude Code · Sonnet · High effort');
  });

  it('says no agent works the station where no harness is set', () => {
    renderAt('station_1');

    expect(
      document.querySelector('[data-slot="station-agent"]'),
    ).toHaveTextContent('No agent');
  });

  it('holds the shape of the station while the line loads', () => {
    lines.mockReturnValue(undefined);

    renderAt('station_2');

    expect(
      screen.getByRole('status', { name: 'Loading the station' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Station not found')).not.toBeInTheDocument();
  });

  it('says the station could not be loaded, and tries again when asked', async () => {
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

  it('says so when the station has no tab at that address', () => {
    renderAt('station_2', 'statistics');

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
      expect(
        document.querySelector('[data-slot="station-agent"]'),
      ).not.toBeInTheDocument();
    });

    it('says nothing runs where tasks are completed, offering nothing to improve', () => {
      renderAt('station_3', 'improve');

      expect(
        screen.getByText(/the line is done with them/),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'Improve this station' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('its tabs', () => {
    it('offers Overview, Improve and Config, each at its own address', () => {
      renderAt('station_2');

      const tabs = within(screen.getByRole('navigation', { name: 'Station' }));

      expect(tabs.getByRole('link', { name: 'Overview' })).toHaveAttribute(
        'href',
        STATION,
      );
      expect(tabs.getByRole('link', { name: 'Improve' })).toHaveAttribute(
        'href',
        `${STATION}/improve`,
      );
      expect(tabs.getByRole('link', { name: 'Config' })).toHaveAttribute(
        'href',
        `${STATION}/config`,
      );
    });

    it('opens on the overview, marking it as the tab in view', () => {
      renderAt('station_2');

      expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(
        screen.getByRole('heading', { name: 'Recent runs' }),
      ).toBeInTheDocument();
    });

    it('moves to another tab when it is picked', async () => {
      const user = userEvent.setup();
      renderAt('station_2');

      await user.click(screen.getByRole('link', { name: 'Improve' }));

      expect(screen.getByRole('link', { name: 'Improve' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(
        screen.getByRole('heading', { name: 'Talk it through with the agent' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Recent runs' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('its overview', () => {
    it('sums up the latest runs on the config in force, linking to the station in Insights', () => {
      renderAt('station_2');

      expect(
        document.querySelector('[data-slot="station-glance"]'),
      ).toHaveTextContent('Runs42Accepted28Sent back3Failed1');
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

    it('lists the station’s alerts in the order they were written', () => {
      renderAt('station_2');

      expect(
        within(screen.getByRole('list', { name: 'Alerts' }))
          .getAllByRole('listitem')
          .map((each) => each.textContent),
      ).toEqual([
        'Alerts when the sent-back rate rises 20 points or more over 20 runs',
        'Alerts when the cost per run goes above 2.00 over 10 runs',
        'Alerts when the accepted rate falls 10 points or more over 20 runs',
      ]);
    });

    it('says in a line how far the judge is trusted, linking to its agreement in Insights', () => {
      renderAt('station_2');

      expect(
        document.querySelector('[data-slot="judge-standing"]'),
      ).toHaveTextContent('Trusted. Cohen’s kappa: 0.71 over 24 runs');
      expect(
        screen.getByRole('link', { name: 'How it agrees with people' }),
      ).toHaveAttribute(
        'href',
        `${INSIGHTS}?tab=stations&stationId=station_2#judge`,
      );
    });

    it('leaves the judge out where its agreement could not load', () => {
      judged.mockReturnValue(undefined);
      judgeFailing.mockReturnValue(true);

      renderAt('station_2');

      expect(
        screen.queryByRole('heading', { name: 'Judge' }),
      ).not.toBeInTheDocument();
    });

    it('shows no judge or alerts where none are set', () => {
      renderAt('station_1');

      expect(
        screen.queryByRole('heading', { name: 'Judge' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Alerts you when' }),
      ).not.toBeInTheDocument();
    });

    it('lists its recent runs newest first, each linking to the run', () => {
      renderAt('station_2');

      const runs = within(screen.getByRole('list', { name: 'Recent runs' }));

      expect(
        runs
          .getAllByRole('link')
          .map((each) => [each.textContent, each.getAttribute('href')]),
      ).toEqual([
        ['Completed', '/w/acme/team/team_1/runs/run_3'],
        ['Failed', '/w/acme/team/team_1/runs/run_2'],
        ['Stopped', '/w/acme/team/team_1/runs/run_1'],
      ]);
    });

    it('links to all the station’s runs in Insights', () => {
      renderAt('station_2');

      expect(screen.getByRole('link', { name: 'All runs' })).toHaveAttribute(
        'href',
        `${INSIGHTS}?tab=runs&stationId=station_2`,
      );
    });

    it('holds the place of its runs while they load', () => {
      outcomes.mockReturnValue(undefined);

      renderAt('station_2');

      expect(
        screen.getByRole('status', { name: 'Loading the station’s runs' }),
      ).toBeInTheDocument();
    });

    it('says its runs could not be loaded, and tries again when asked', async () => {
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

  describe('its improve tab', () => {
    it('lays out the ways to improve the station as numbered steps', () => {
      renderAt('station_2', 'improve');

      expect(
        screen
          .getAllByRole('heading', { level: 3 })
          .map((each) => each.textContent),
      ).toEqual([
        'Talk it through with the agent',
        'Pick past runs to replay',
        'Propose candidates',
        'Or let a search find one',
      ]);
    });

    it('hands the station to the agent to improve', async () => {
      const user = userEvent.setup();
      renderAt('station_2', 'improve');

      await user.click(
        screen.getByRole('link', { name: 'Improve this station' }),
      );

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

    it('says no replay set is open yet, and offers to open one', () => {
      renderAt('station_2', 'improve');

      expect(screen.getByText('No replay sets yet')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Open a replay set' }),
      ).toBeInTheDocument();
    });

    it('holds the place of the replay sets while they load', () => {
      sets.mockReturnValue(undefined);

      renderAt('station_2', 'improve');

      expect(
        screen.getByRole('status', { name: 'Loading the replay sets' }),
      ).toBeInTheDocument();
    });

    it('says the replay sets could not be loaded, and tries again when asked', async () => {
      const user = userEvent.setup();
      sets.mockReturnValue(undefined);
      setsFailing.mockReturnValue(true);

      renderAt('station_2', 'improve');

      expect(screen.getByRole('alert')).toHaveTextContent(
        'The station’s replay sets could not be loaded.',
      );

      await user.click(screen.getByRole('button', { name: 'Try again' }));

      expect(refetchSets).toHaveBeenCalled();
    });

    it('shows how to propose a candidate with the CLI, at the station’s address', () => {
      renderAt('station_2', 'improve');

      expect(screen.getByText('No candidates yet')).toBeInTheDocument();
      expect(
        screen.getByText('Propose a candidate with the CLI'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'spotlight replay propose --station core/default/spec --name <name> <station.json>',
        ),
      ).toBeInTheDocument();
    });

    it('offers to search once there is a replay set to search on', () => {
      renderAt('station_2', 'improve');

      expect(screen.getByText('No searches yet')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Open a replay set first' }),
      ).toHaveAttribute('href', '#replays');
    });
  });

  describe('its config', () => {
    it('says it is set in Terraform, pointing to Improve to try a change', () => {
      renderAt('station_2', 'config');

      expect(screen.getByText(/Set in Terraform/)).toBeInTheDocument();
      expect(
        within(
          screen.getByText(/Set in Terraform/).closest('p') as HTMLElement,
        ).getByRole('link', { name: 'Improve' }),
      ).toHaveAttribute('href', `${STATION}/improve`);
    });

    it('shows the harness, model and effort the station runs on', () => {
      renderAt('station_2', 'config');

      expect(setting('Harness')).toHaveTextContent('Claude Code');
      expect(setting('Model')).toHaveTextContent('Sonnet');
      expect(setting('Effort')).toHaveTextContent('High effort');
    });

    it('says no agent works the station where no harness is set', () => {
      renderAt('station_1', 'config');

      expect(setting('Harness')).toHaveTextContent('No agent');
      expect(screen.queryByText('Model')).not.toBeInTheDocument();
    });

    it('shows the skills the station gives its runs', () => {
      renderAt('station_2', 'config');

      expect(
        within(screen.getByRole('list', { name: 'Skills' }))
          .getAllByRole('listitem')
          .map((each) => each.textContent),
      ).toEqual(['our-migrations', 'grafana-dashboards']);
    });

    it('says so where a station gives no skills', () => {
      renderAt('station_1', 'config');

      expect(setting('Skills')).toHaveTextContent('None');
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

    it('shows how much of the station’s work its judge scores, and how far it must be trusted', () => {
      renderAt('station_2', 'config');

      expect(setting('Judges')).toHaveTextContent('20% of runs');
      expect(setting('Minimum agreement to trust')).toHaveTextContent('0.60');
    });

    it('keeps the rubric folded away until asked, then shows it without letting it be written', async () => {
      const user = userEvent.setup();
      renderAt('station_2', 'config');

      const rubric = screen.getByRole('button', { name: 'Rubric' });

      expect(rubric).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByLabelText('Rubric')).not.toBeInTheDocument();

      await user.click(rubric);

      expect(rubric).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByLabelText('Rubric')).toHaveAttribute(
        'contenteditable',
        'false',
      );
      expect(
        screen.getByRole('heading', { name: 'A good run' }),
      ).toBeInTheDocument();
    });

    it('says only people score runs where no judge is set', () => {
      renderAt('station_1', 'config');

      expect(
        screen.getByText('No judge. Only people score runs here.'),
      ).toBeInTheDocument();
    });

    it('shows what the station takes from its line, linking to the line', () => {
      renderAt('station_2', 'config');

      const fromLine = within(sectionTitled('From the line'));

      expect(fromLine.getByRole('link', { name: 'Default' })).toHaveAttribute(
        'href',
        '/w/acme/team/team_1/lines/line_1',
      );
      expect(
        fromLine.getByText('usespotlightai/spotlight'),
      ).toBeInTheDocument();
      expect(
        fromLine.getByText(/Line names no Terraform source/),
      ).toBeInTheDocument();
      expect(
        fromLine.getByText(/Line sets no replay_check/),
      ).toBeInTheDocument();
    });
  });
});
