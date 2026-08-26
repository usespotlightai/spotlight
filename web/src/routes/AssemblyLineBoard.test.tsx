import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AssemblyLineBoard } from '@/routes/AssemblyLineBoard';

const line = {
  id: 'line_1',
  name: 'Default',
  stations: [
    { id: 'station_1', name: 'Triage', position: 0 },
    { id: 'station_2', name: 'Spec', position: 1 },
    { id: 'station_3', name: 'Implementation', position: 2 },
    { id: 'station_4', name: 'Code Review', position: 3 },
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

const renderAt = (lineId: string) =>
  render(
    <MemoryRouter initialEntries={[`/w/acme/team/team_1/lines/${lineId}`]}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/lines/:lineId"
          element={<AssemblyLineBoard />}
        />
      </Routes>
    </MemoryRouter>,
  );

const lanes = () =>
  Array.from(document.querySelectorAll('[data-slot="station-lane"]'));

describe('AssemblyLineBoard', () => {
  it('gives every station its own lane, in board order', () => {
    renderAt('line_1');

    expect(lanes()).toHaveLength(4);
    expect(
      lanes().map((lane) => lane.querySelector('h2')?.textContent),
    ).toEqual(['Triage', 'Spec', 'Implementation', 'Code Review']);
  });

  it('names the team and the line it is showing', () => {
    renderAt('line_1');

    expect(
      screen.getByRole('heading', { name: /Platform\s*Default/ }),
    ).toBeInTheDocument();
  });

  it('walks back to the team from the breadcrumbs', () => {
    renderAt('line_1');

    expect(screen.getByRole('link', { name: /Platform/ })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1',
    );
  });

  it('opens a station for customising from its lane menu', async () => {
    const user = userEvent.setup();
    renderAt('line_1');

    await user.click(screen.getByRole('button', { name: 'Triage options' }));
    await screen.findByRole('menu');

    expect(
      screen.getByRole('menuitem', { name: 'Customize station' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_1',
    );
  });

  it('leaves the lane title as a label, not a link', () => {
    renderAt('line_1');

    expect(
      screen.queryByRole('link', { name: 'Triage' }),
    ).not.toBeInTheDocument();
  });

  it('says each lane is empty rather than leaving it blank', () => {
    renderAt('line_1');

    expect(screen.getAllByText('Nothing here')).toHaveLength(4);
  });

  it('says so when there is no line at that address', () => {
    renderAt('line_missing');

    expect(lanes()).toHaveLength(0);
    expect(
      screen.getByRole('heading', { name: 'Assembly line not found' }),
    ).toBeInTheDocument();
  });
});
