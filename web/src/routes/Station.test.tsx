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
    },
    { id: 'station_1', name: 'Triage', position: 1, color: '#93a1b5' },
    {
      id: 'station_2',
      name: 'Spec',
      position: 2,
      color: '#5c66d9',
      agentPrompt: '## Role\n\n- Sort the queue\n- Ask when unsure',
    },
  ],
};

vi.mock('@/hooks/api/useAssemblyLines', () => ({
  useAssemblyLines: () => ({ data: [line], isPending: false }),
}));
const customised = vi.fn();

vi.mock('@/hooks/api/useCustomiseStation', () => ({
  useCustomiseStation: () => ({ mutate: customised }),
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
  localStorage.clear();
  customised.mockClear();
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

  it('writes a new name back once the field is left', async () => {
    const user = userEvent.setup();
    renderAt('station_1');

    await user.type(screen.getByLabelText('Station name'), ' queue');
    await user.tab();

    expect(customised).toHaveBeenCalledWith({
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_1',
      changes: { name: 'Triage queue' },
    });
  });

  it('writes a description back once the field is left', async () => {
    const user = userEvent.setup();
    renderAt('station_1');

    await user.type(screen.getByLabelText('Description'), 'Where work lands');
    await user.tab();

    expect(customised).toHaveBeenCalledWith({
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_1',
      changes: { description: 'Where work lands' },
    });
  });

  it('writes the harness back as soon as one is picked', async () => {
    renderAt('station_1');
    const user = await openHarnesses();

    await user.click(
      screen.getByRole('menuitemradio', { name: 'Other Harness' }),
    );

    expect(customised).toHaveBeenCalledWith({
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_1',
      changes: { harness: 'other' },
    });
  });

  it('writes an emptied harness back, so the station holds its work', async () => {
    renderAt('station_1');
    const user = await openHarnesses();

    await user.click(screen.getByRole('menuitemradio', { name: 'Nobody' }));

    expect(customised).toHaveBeenCalledWith({
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_1',
      changes: { harness: '' },
    });
  });

  it('holds back a name emptied to nothing, having nowhere to fall back', async () => {
    const user = userEvent.setup();
    renderAt('station_1');

    await user.clear(screen.getByLabelText('Station name'));
    await user.tab();

    expect(customised).not.toHaveBeenCalled();
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

  it('repaints the station from the palette behind its icon', async () => {
    const user = userEvent.setup();
    renderAt('station_1');

    await user.click(screen.getByRole('button', { name: 'Station colour' }));
    await screen.findByRole('button', { name: '#db5b52' });
    await user.click(screen.getByRole('button', { name: '#db5b52' }));

    expect(customised).toHaveBeenCalledWith({
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_1',
      changes: { color: '#db5b52' },
    });
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
