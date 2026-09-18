import { render, screen } from '@testing-library/react';
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

const customised = vi.fn();
const setRepositories = vi.fn();

vi.mock('@/hooks/api/useConfiguration', () => ({
  useRereadConfiguration: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/api/useCustomiseStation', () => ({
  useCustomiseStation: () => ({ mutate: customised, mutateAsync: customised }),
}));
vi.mock('@/hooks/api/useSetLineRepositories', () => ({
  useSetLineRepositories: () => ({
    mutate: setRepositories,
    mutateAsync: setRepositories,
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
vi.mock('@/hooks/api/useTeamSkills', () => ({
  useTeamSkills: () => ({
    data: {
      repository: 'acme/config',
      skills: [{ key: 'our-migrations' }, { key: 'grafana-dashboards' }],
    },
  }),
}));
vi.mock('@/hooks/api/useRunners', () => ({
  useRunners: () => ({
    data: [
      { id: 'runner_1', name: 'One', pool: 'default', connected: true },
      { id: 'runner_2', name: 'Two', pool: 'default', connected: true },
      { id: 'runner_3', name: 'Three', pool: 'gpu', connected: false },
    ],
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

const openHarnesses = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('Harness'));
  await screen.findByRole('menu');
  return user;
};

beforeEach(() => {
  lines.mockReturnValue([line]);
  failing.mockReturnValue(false);
  refetch.mockClear();
  localStorage.clear();
  customised.mockClear();
  setRepositories.mockClear();
});

describe('Station', () => {
  it('opens on the station’s own name', () => {
    renderAt('station_2');

    expect(screen.getByLabelText('Station name')).toHaveValue('Spec');
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

  it('takes a new name and follows it in the breadcrumbs', async () => {
    renderAt('station_1');

    await userEvent.type(screen.getByLabelText('Station name'), ' queue');

    expect(screen.getByLabelText('Station name')).toHaveValue('Triage queue');
    expect(
      screen.getByRole('heading', { name: /Triage queue/ }),
    ).toBeInTheDocument();
  });

  it('takes a description, which starts out empty', async () => {
    renderAt('station_1');

    const description = screen.getByLabelText('Description');
    expect(description).toHaveValue('');

    await userEvent.type(description, 'Where new work lands.');

    expect(description).toHaveValue('Where new work lands.');
  });

  it('offers the backlog neither a harness nor a prompt', () => {
    renderAt('station_0');

    expect(screen.queryByLabelText('Harness')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agent prompt')).not.toBeInTheDocument();
  });

  it('offers what is completed neither a harness nor a prompt', () => {
    renderAt('station_3');

    expect(screen.queryByLabelText('Harness')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Agent prompt')).not.toBeInTheDocument();
    expect(screen.getByText(/the line is done with them/)).toBeInTheDocument();
  });

  it('still offers a station both', () => {
    renderAt('station_1');

    expect(screen.getByLabelText('Harness')).toBeInTheDocument();
  });

  it('renders the agent prompt rather than showing its markdown', () => {
    renderAt('station_2');

    expect(screen.getByRole('heading', { name: 'Role' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('listitem').map((each) => each.textContent),
    ).toEqual(['Sort the queue', 'Ask when unsure']);
    expect(screen.queryByText(/^## Role/)).not.toBeInTheDocument();
  });

  it('offers the agent prompt for writing', () => {
    renderAt('station_1');

    expect(screen.getByLabelText('Agent prompt')).toHaveAttribute(
      'contenteditable',
      'true',
    );
  });

  it('shows the repositories the line works in', () => {
    renderAt('station_1');

    expect(
      screen.getByRole('heading', { name: 'Line Repositories' }),
    ).toBeInTheDocument();
    expect(screen.getByText('usespotlightai/spotlight')).toBeInTheDocument();
  });

  it('offers every harness Spotlight knows, and nobody', async () => {
    renderAt('station_1');
    await openHarnesses();

    expect(
      screen.getByRole('menuitemradio', { name: 'Claude Code' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', { name: 'Other Harness' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', { name: 'Nobody' }),
    ).toBeInTheDocument();
  });

  it('shows the harness once one is picked', async () => {
    renderAt('station_1');
    const user = await openHarnesses();

    await user.click(
      screen.getByRole('menuitemradio', { name: 'Other Harness' }),
    );

    expect(screen.getByLabelText('Harness')).toHaveTextContent('Other Harness');
  });

  it('keeps each station’s edits to itself', async () => {
    const { unmount } = renderAt('station_1');
    await userEvent.type(screen.getByLabelText('Description'), 'Triage only');
    unmount();

    renderAt('station_2');

    expect(screen.getByLabelText('Description')).toHaveValue('');
    expect(screen.getByLabelText('Station name')).toHaveValue('Spec');
  });

  const propose = () =>
    userEvent.click(screen.getByRole('button', { name: 'Propose changes' }));

  it('changes nothing on the board until the change is proposed', async () => {
    const user = userEvent.setup();
    renderAt('station_1');

    await user.type(screen.getByLabelText('Station name'), ' queue');

    expect(customised).not.toHaveBeenCalled();
  });

  it('proposes a changed name', async () => {
    const user = userEvent.setup();
    renderAt('station_1');

    await user.type(screen.getByLabelText('Station name'), ' queue');
    await propose();

    expect(customised).toHaveBeenCalledWith({
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_1',
      changes: { name: 'Triage queue' },
    });
  });

  it('proposes only the fields that changed, in one pull request', async () => {
    const user = userEvent.setup();
    renderAt('station_1');

    await user.type(screen.getByLabelText('Description'), 'Where work lands');
    await propose();

    expect(customised).toHaveBeenCalledTimes(1);
    expect(customised).toHaveBeenCalledWith({
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_1',
      changes: { description: 'Where work lands' },
    });
  });

  it('proposes a picked harness', async () => {
    renderAt('station_1');
    const user = await openHarnesses();

    await user.click(
      screen.getByRole('menuitemradio', { name: 'Other Harness' }),
    );
    await propose();

    expect(customised).toHaveBeenCalledWith({
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_1',
      changes: { harness: 'other' },
    });
  });

  it('proposes the line’s repositories as their own change', async () => {
    const user = userEvent.setup();
    renderAt('station_1');

    await user.click(screen.getByLabelText('Repositories'));
    await screen.findByRole('menu');
    await user.click(
      screen.getByRole('menuitemcheckbox', { name: 'acme/web' }),
    );
    await propose();

    expect(setRepositories).toHaveBeenCalledWith({
      teamId: 'team_1',
      lineId: 'line_1',
      repositories: ['usespotlightai/spotlight', 'acme/web'],
    });
    expect(customised).not.toHaveBeenCalled();
  });

  it('proposes the team’s own skills picked for the station', async () => {
    const user = userEvent.setup();
    renderAt('station_1');

    await user.click(screen.getByLabelText('Skills'));
    await screen.findByRole('menu');
    await user.click(
      screen.getByRole('menuitemcheckbox', { name: 'our-migrations' }),
    );
    await propose();

    expect(customised).toHaveBeenCalledWith({
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_1',
      changes: { skills: ['our-migrations'] },
    });
  });

  it('proposes the skills left once one the station has is un-picked', async () => {
    const user = userEvent.setup();
    renderAt('station_2');

    await user.click(screen.getByLabelText('Skills'));
    await screen.findByRole('menu');
    await user.click(
      screen.getByRole('menuitemcheckbox', { name: 'our-migrations' }),
    );
    await propose();

    expect(customised).toHaveBeenCalledWith({
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_2',
      changes: { skills: ['grafana-dashboards'] },
    });
  });

  it('leaves the skills out of a proposal that does not change them', async () => {
    const user = userEvent.setup();
    renderAt('station_2');

    await user.type(screen.getByLabelText('Station name'), ' out');
    await propose();

    expect(customised).toHaveBeenCalledWith({
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_2',
      changes: { name: 'Spec out' },
    });
  });

  it('offers the backlog no skills', () => {
    renderAt('station_0');

    expect(screen.queryByLabelText('Skills')).not.toBeInTheDocument();
  });

  it('proposes an emptied harness, so the station holds its work', async () => {
    renderAt('station_2');
    const user = await openHarnesses();

    await user.click(screen.getByRole('menuitemradio', { name: 'Nobody' }));
    await propose();

    expect(customised).toHaveBeenCalledWith({
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_2',
      changes: { harness: null },
    });
  });

  it('cannot propose a name emptied to nothing', async () => {
    const user = userEvent.setup();
    renderAt('station_1');

    await user.clear(screen.getByLabelText('Station name'));

    expect(
      screen.getByRole('button', { name: 'Propose changes' }),
    ).toBeDisabled();
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

  it('takes the picked colour straight away, without waiting on the save', async () => {
    const user = userEvent.setup();
    renderAt('station_1');

    await user.click(screen.getByRole('button', { name: 'Station colour' }));
    await screen.findByRole('button', { name: '#db5b52' });
    await user.click(screen.getByRole('button', { name: '#db5b52' }));

    expect(
      document.querySelector('[data-slot="station-icon"] circle'),
    ).toHaveAttribute('stroke', '#db5b52');
  });

  it('proposes a repaint from the palette behind its icon', async () => {
    const user = userEvent.setup();
    renderAt('station_1');

    await user.click(screen.getByRole('button', { name: 'Station colour' }));
    await screen.findByRole('button', { name: '#db5b52' });
    await user.click(screen.getByRole('button', { name: '#db5b52' }));
    await propose();

    expect(customised).toHaveBeenCalledWith({
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_1',
      changes: { color: '#db5b52' },
    });
  });

  it('holds the shape of the station while the line loads, keeping what never changes', () => {
    lines.mockReturnValue(undefined);

    renderAt('station_2');

    expect(
      screen.getByRole('status', { name: 'Loading the station' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Line Repositories' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Propose changes' }),
    ).toBeDisabled();
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

  it('says nobody works the station until a harness is picked', () => {
    renderAt('station_1');

    expect(screen.getByLabelText('Harness')).toHaveTextContent('Nobody');
  });
});
