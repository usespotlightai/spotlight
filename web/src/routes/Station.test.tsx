import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Station } from '@/routes/Station';

const line = {
  id: 'line_1',
  name: 'Default',
  stations: [
    {
      id: 'station_0',
      name: 'Backlog',
      position: 0,
      color: '#a3a8b0',
      kind: 'backlog',
      skills: [],
    },
    {
      id: 'station_1',
      name: 'Triage',
      position: 1,
      color: '#93a1b5',
      description: 'Where new work lands.',
      kind: 'work',
      skills: [],
    },
    {
      id: 'station_2',
      name: 'Spec',
      position: 2,
      color: '#5c66d9',
      harness: 'claude-code',
      agentPrompt: '## Role\n\n- Sort the queue\n- Ask when unsure',
      kind: 'work',
      skills: ['our-migrations', 'grafana-dashboards'],
    },
    {
      id: 'station_3',
      name: 'Completed',
      position: 3,
      color: '#a3a8b0',
      kind: 'completed',
      skills: [],
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
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  lines.mockReturnValue([line]);
  failing.mockReturnValue(false);
  refetch.mockClear();
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

  it('says so when there is no station at that address', () => {
    renderAt('station_missing');

    expect(
      screen.getByRole('heading', { name: 'Station not found' }),
    ).toBeInTheDocument();
  });
});
