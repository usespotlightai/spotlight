import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Station } from '@/routes/Station';

const line = {
  id: 'line_1',
  key: 'default',
  name: 'Default',
  stations: [
    {
      id: 'station_0',
      name: 'Backlog',
      position: 0,
      color: '#a3a8b0',
      kind: 'backlog',
      skills: [],
      alerts: [],
    },
    {
      id: 'station_1',
      name: 'Triage',
      position: 1,
      color: '#93a1b5',
      description: 'Where new work lands.',
      kind: 'work',
      skills: [],
      alerts: [],
    },
    {
      id: 'station_2',
      key: 'spec',
      name: 'Spec',
      position: 2,
      color: '#5c66d9',
      harness: 'claude-code',
      agentPrompt: '## Role\n\n- Sort the queue\n- Ask when unsure',
      kind: 'work',
      skills: ['our-migrations', 'grafana-dashboards'],
      judge: {
        rubric: '## A good run\n\n- Changes only what it must',
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
      { id: 'claude-code', name: 'Claude Code' },
      { id: 'other', name: 'Other Harness' },
    ],
  }),
}));
vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({
    data: [{ fullName: 'usespotlightai/spotlight' }, { fullName: 'acme/web' }],
  }),
}));

vi.mock('@/hooks/api/useStationOutcomes', () => ({
  useStationOutcomes: () => ({
    data: { stationId: 'station_2', groups: [] },
    isPending: false,
    errorUpdateCount: 0,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

const judged = vi.fn();
const judgeFailing = vi.fn();
const judgeError = vi.fn();
const refetchJudge = vi.fn();

vi.mock('@/hooks/api/useStationJudge', () => ({
  useStationJudge: () => ({
    data: judged(),
    isPending: judged() === undefined,
    errorUpdateCount: judgeFailing() ? 1 : 0,
    error: judgeError(),
    isFetching: false,
    refetch: refetchJudge,
  }),
}));

const TRUSTED = {
  trusted: true,
  measure: 'kappa',
  agreement: 0.71,
  pairs: 24,
  trust: 0.6,
  hiddenBecause: null,
};

const AGREEMENT = {
  stationId: 'station_2',
  judge: {
    rubricVersion: 'c'.repeat(64),
    kind: 'yes-no',
    sample: 0.2,
    trust: 0.6,
  },
  standing: TRUSTED,
  coverage: { runs: 50, both: 24, judgeOnly: 6, peopleOnly: 14, neither: 6 },
  versions: [
    {
      rubricVersion: 'c'.repeat(64),
      kind: 'yes-no',
      current: true,
      judged: 30,
      agreement: {
        pairs: 24,
        observed: 0.875,
        kappa: 0.71,
        spearman: null,
        mae: null,
      },
      confusion: {
        labels: ['no', 'yes'],
        cells: [
          [6, 2],
          [1, 15],
        ],
      },
      trend: [
        {
          day: '2026-09-29',
          judged: 4,
          judge: 0.75,
          labelled: 3,
          people: 0.67,
        },
      ],
      firstAt: '2026-09-29T09:00:00.000Z',
      lastAt: '2026-09-29T09:00:00.000Z',
    },
    {
      rubricVersion: 'd'.repeat(64),
      kind: 'number',
      current: false,
      judged: 12,
      agreement: {
        pairs: 9,
        observed: 0.33,
        kappa: null,
        spearman: 0.42,
        mae: 1.1,
      },
      confusion: {
        labels: ['1', '2', '3', '4', '5'],
        cells: [
          [1, 0, 0, 0, 0],
          [0, 1, 1, 0, 0],
          [0, 1, 0, 1, 0],
          [0, 0, 1, 1, 1],
          [0, 0, 0, 1, 0],
        ],
      },
      trend: [],
      firstAt: '2026-09-20T09:00:00.000Z',
      lastAt: '2026-09-21T09:00:00.000Z',
    },
  ],
};

function HandedOver() {
  const { state } = useLocation();

  return <pre data-slot="handed-over">{JSON.stringify(state?.improving)}</pre>;
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

beforeEach(() => {
  lines.mockReturnValue([line]);
  failing.mockReturnValue(false);
  refetch.mockClear();
  judged.mockReturnValue(AGREEMENT);
  judgeFailing.mockReturnValue(false);
  judgeError.mockReturnValue(null);
  refetchJudge.mockClear();
  localStorage.clear();
});

describe('Station', () => {
  it('opens on the station’s own name', () => {
    renderAt('station_2');

    expect(screen.getByRole('heading', { name: 'Spec' })).toBeInTheDocument();
  });

  it('names the team, the line and the station it is showing', () => {
    renderAt('station_1');

    expect(
      screen.getByRole('heading', { name: /Platform\s*Default\s*Triage/ }),
    ).toBeInTheDocument();
  });

  it('walks back to the team and the board from the breadcrumbs', () => {
    renderAt('station_1');

    expect(screen.getByRole('link', { name: /Platform/ })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1',
    );
    expect(screen.getByRole('link', { name: 'Default' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1',
    );
  });

  it('leaves the station itself unlinked, being the page in view', () => {
    renderAt('station_1');

    expect(
      screen.queryByRole('link', { name: 'Triage' }),
    ).not.toBeInTheDocument();
  });

  it('shows what the station is for', () => {
    renderAt('station_1');

    expect(screen.getByText('Where new work lands.')).toBeInTheDocument();
  });

  it('offers nothing to change', () => {
    renderAt('station_2');

    expect(screen.queryByLabelText('Station name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Harness')).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: /propose/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the backlog neither a harness nor a prompt', () => {
    renderAt('station_0');

    expect(screen.queryByLabelText('Harness')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agent prompt')).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing runs at a backlog/)).toBeInTheDocument();
  });

  it('shows what is completed neither a harness nor a prompt', () => {
    renderAt('station_3');

    expect(screen.queryByLabelText('Harness')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agent prompt')).not.toBeInTheDocument();
    expect(screen.getByText(/the line is done with them/)).toBeInTheDocument();
  });

  it('renders the agent prompt rather than showing its markdown', () => {
    renderAt('station_2');

    expect(screen.getByRole('heading', { name: 'Role' })).toBeInTheDocument();
    expect(screen.getByText('Sort the queue')).toBeInTheDocument();
    expect(screen.queryByText(/^## Role/)).not.toBeInTheDocument();
  });

  it('shows the agent prompt without letting it be written', () => {
    renderAt('station_2');

    expect(screen.getByLabelText('Agent prompt')).toHaveAttribute(
      'contenteditable',
      'false',
    );
  });

  it('says so where a station has no prompt', () => {
    renderAt('station_1');

    expect(screen.getByText('No agent prompt.')).toBeInTheDocument();
  });

  it('shows the harness the station runs on', () => {
    renderAt('station_2');

    expect(screen.getByLabelText('Harness')).toHaveTextContent('Claude Code');
  });

  it('says nobody works the station where no harness is set', () => {
    renderAt('station_1');

    expect(screen.getByLabelText('Harness')).toHaveTextContent('Nobody');
  });

  it('shows the repositories the line works in', () => {
    renderAt('station_1');

    expect(screen.getByText('usespotlightai/spotlight')).toBeInTheDocument();
  });

  it('shows the skills the station gives its runs', () => {
    renderAt('station_2');

    expect(
      within(screen.getByRole('list', { name: 'Skills' }))
        .getAllByRole('listitem')
        .map((each) => each.textContent),
    ).toEqual(['our-migrations', 'grafana-dashboards']);
  });

  it('says so where a station gives no skills', () => {
    renderAt('station_1');

    expect(screen.getByText('No skills.')).toBeInTheDocument();
  });

  it('shows how much of the station’s work its judge scores, and how far it must be trusted', () => {
    renderAt('station_2');

    expect(screen.getByRole('heading', { name: 'Judge' })).toBeInTheDocument();
    expect(screen.getByText('20% of runs')).toBeInTheDocument();
    expect(
      screen.getByText('agreement with people of 0.60 or more'),
    ).toBeInTheDocument();
  });

  it('keeps the rubric folded away until asked, then shows it without letting it be written', async () => {
    const user = userEvent.setup();
    renderAt('station_2');

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

  it('lists the station’s alerts in the order they were written', () => {
    renderAt('station_2');

    expect(
      within(screen.getByRole('list', { name: 'Alerts' }))
        .getAllByRole('listitem')
        .map((each) => each.textContent),
    ).toEqual([
      'Sent-back rate up 20 points in the last 20 runs, against the 20 before',
      'Cost per run above $2.00 across the last 10 runs',
      'Accepted rate down 10 points in the last 20 runs, against the 20 before',
    ]);
  });

  it('shows no judge or alerts where none are set', () => {
    renderAt('station_1');

    expect(
      screen.queryByRole('heading', { name: 'Judge' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Alerts' }),
    ).not.toBeInTheDocument();
  });

  it('marks how far along the line the station stands', () => {
    renderAt('station_1');

    expect(
      document.querySelector('[data-slot="station-icon"]'),
    ).toBeInTheDocument();
  });

  it('paints its icon the colour the station carries', () => {
    renderAt('station_1');

    expect(
      document.querySelector('[data-slot="station-icon"] circle'),
    ).toHaveAttribute('stroke', '#93a1b5');
  });

  it('holds the shape of the station while the line loads, keeping what never changes', () => {
    lines.mockReturnValue(undefined);

    renderAt('station_2');

    expect(
      screen.getByRole('status', { name: 'Loading the station' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Agent prompt' }),
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
    expect(screen.queryByText('Station not found')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('lists how the station’s runs turned out below what it is told', () => {
    renderAt('station_2');

    expect(
      screen.getByRole('heading', { name: 'How its runs turned out' }),
    ).toBeInTheDocument();
  });

  it('lists no runs where nothing runs', () => {
    renderAt('station_0');

    expect(
      screen.queryByRole('heading', { name: 'How its runs turned out' }),
    ).not.toBeInTheDocument();
  });

  it('hands the station to the agent to improve', async () => {
    const user = userEvent.setup();
    renderAt('station_2');

    await user.click(
      screen.getByRole('link', { name: 'Improve this station' }),
    );

    expect(
      JSON.parse(
        document.querySelector('[data-slot="handed-over"]')?.textContent ?? '',
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

  it('offers nothing to improve where nothing runs', () => {
    renderAt('station_3');

    expect(
      screen.queryByRole('link', { name: 'Improve this station' }),
    ).not.toBeInTheDocument();
  });

  it('says so when there is no station at that address', () => {
    renderAt('station_missing');

    expect(
      screen.getByRole('heading', { name: 'Station not found' }),
    ).toBeInTheDocument();
  });

  describe('its judge', () => {
    it('says the judge is trusted, and how often it agrees with people', () => {
      renderAt('station_2');

      expect(
        document.querySelector('[data-slot="judge-standing"]'),
      ).toHaveTextContent('Trusted: Cohen’s kappa is 0.71 over 24 runs');
    });

    it('says why the judge’s scores are hidden when it agrees too seldom', () => {
      judged.mockReturnValue({
        ...AGREEMENT,
        standing: {
          ...TRUSTED,
          trusted: false,
          agreement: 0.38,
          hiddenBecause: 'below-trust',
        },
      });

      renderAt('station_2');

      expect(
        document.querySelector('[data-slot="judge-standing"]'),
      ).toHaveTextContent(
        'Hidden: Cohen’s kappa is 0.38, below the 0.60 it needs.',
      );
    });

    it('lays out agreement rubric by rubric, the current one first', () => {
      renderAt('station_2');

      const versions = within(
        screen.getByRole('list', { name: 'Agreement by rubric' }),
      ).getAllByRole('listitem');
      expect(versions).toHaveLength(2);
      expect(versions[0]).toHaveTextContent('Current');
      expect(versions[0]).toHaveTextContent('Agreed88%');
      expect(versions[1]).toHaveTextContent('Spearman’s ρ0.42');
      expect(versions[1]).toHaveTextContent('Mean error1.10');
    });

    it('counts runs in a confusion matrix, the judge down and people across', () => {
      renderAt('station_2');

      const [matrix] = screen.getAllByRole('table');
      expect(
        within(matrix as HTMLElement)
          .getAllByRole('cell')
          .map((each) => each.textContent),
      ).toEqual(['6', '2', '1', '15']);
    });

    it('counts the runs with both scores and those with only one', () => {
      renderAt('station_2');

      expect(
        document.querySelector('[data-slot="judge-coverage"]'),
      ).toHaveTextContent('Both scores24Judge only6People only14Neither6');
    });

    it('holds the judge’s place while its agreement loads', () => {
      judged.mockReturnValue(undefined);

      renderAt('station_2');

      expect(
        screen.getByRole('status', {
          name: 'Loading how the judge agrees with people',
        }),
      ).toBeInTheDocument();
    });

    it('offers to try again when its agreement could not load', async () => {
      judged.mockReturnValue(undefined);
      judgeFailing.mockReturnValue(true);

      renderAt('station_2');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

      expect(refetchJudge).toHaveBeenCalled();
    });

    it('tells someone off the team that only its members can see how the judge agrees', () => {
      judged.mockReturnValue(undefined);
      judgeFailing.mockReturnValue(true);
      judgeError.mockReturnValue({ statusCode: 404 });

      renderAt('station_2');

      expect(
        screen.getByText(
          'Only the team’s members can see how the judge agrees with people',
        ),
      ).toBeInTheDocument();
    });

    it('says no run is judged yet, and offers to create a task', () => {
      judged.mockReturnValue({ ...AGREEMENT, versions: [] });

      renderAt('station_2');

      const empty = screen.getByText('No judged runs yet').closest('div')
        ?.parentElement as HTMLElement;
      expect(
        within(empty).getByRole('link', { name: 'Create a task' }),
      ).toBeInTheDocument();
    });
  });
});
