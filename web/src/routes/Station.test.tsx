import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Station } from '@/routes/Station';

const line = {
  id: 'line_1',
  name: 'Default',
  stations: [
    { id: 'station_1', name: 'Triage', position: 0 },
    { id: 'station_2', name: 'Spec', position: 1 },
  ],
};

vi.mock('@/hooks/api/useAssemblyLines', () => ({
  useAssemblyLines: () => ({ data: [line], isPending: false }),
}));
vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: { teams: [{ id: 'team_1', name: 'Platform' }] },
    isPending: false,
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

const storeDraft = (stationId: string, draft: Record<string, string>) =>
  localStorage.setItem(
    'spotlight.station-drafts',
    JSON.stringify({ [stationId]: draft }),
  );

const openPools = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText('Runner pool'));
  await screen.findByRole('menu');
  return user;
};

beforeEach(() => {
  localStorage.clear();
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

  it('renders the agent prompt rather than showing its markdown', () => {
    storeDraft('station_1', {
      agentPrompt: '## Role\n\n- Sort the queue\n- Ask when unsure',
    });
    renderAt('station_1');

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

  it('offers the pools the enrolled runners answer to', async () => {
    renderAt('station_1');
    await openPools();

    expect(
      screen.getByRole('menuitemradio', { name: /default/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', { name: /gpu/ }),
    ).toBeInTheDocument();
  });

  it('shows the pool once one is picked', async () => {
    renderAt('station_1');
    const user = await openPools();

    await user.click(screen.getByRole('menuitemradio', { name: /gpu/ }));

    expect(screen.getByLabelText('Runner pool')).toHaveTextContent('gpu');
  });

  it('keeps each station’s edits to itself', async () => {
    const { unmount } = renderAt('station_1');
    await userEvent.type(screen.getByLabelText('Description'), 'Triage only');
    unmount();

    renderAt('station_2');

    expect(screen.getByLabelText('Description')).toHaveValue('');
    expect(screen.getByLabelText('Station name')).toHaveValue('Spec');
  });

  it('says so when there is no station at that address', () => {
    renderAt('station_missing');

    expect(
      screen.getByRole('heading', { name: 'Station not found' }),
    ).toBeInTheDocument();
  });
});
