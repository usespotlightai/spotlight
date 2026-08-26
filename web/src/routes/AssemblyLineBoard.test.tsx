import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const sections = () =>
  Array.from(document.querySelectorAll('[data-slot="station-section"]'));

describe('AssemblyLineBoard', () => {
  beforeEach(() => localStorage.clear());

  it('gives every station its own section, in board order', () => {
    renderAt('line_1');

    expect(sections()).toHaveLength(4);
    expect(
      sections().map((section) => section.querySelector('a')?.textContent),
    ).toEqual(['Triage', 'Spec', 'Implementation', 'Code Review']);
  });

  it('names the team and the line it is showing', () => {
    renderAt('line_1');

    expect(
      screen.getByRole('heading', { name: /Platform\s*Default/ }),
    ).toBeInTheDocument();
  });

  it('folds a station away and leaves the others open', async () => {
    const user = userEvent.setup();
    renderAt('line_1');

    await user.click(screen.getByRole('button', { name: 'Triage' }));

    expect(screen.getByRole('button', { name: 'Triage' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Spec' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('walks back to the team from the breadcrumbs', () => {
    renderAt('line_1');

    expect(screen.getByRole('link', { name: /Platform/ })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1',
    );
  });

  it('opens a station from its title', () => {
    renderAt('line_1');

    expect(screen.getByRole('link', { name: 'Triage' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_1',
    );
  });

  it('folds from the chevron rather than the title, which navigates', async () => {
    const user = userEvent.setup();
    renderAt('line_1');

    await user.click(screen.getByRole('button', { name: 'Spec' }));

    expect(screen.getByRole('button', { name: 'Spec' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('link', { name: 'Spec' })).toBeInTheDocument();
  });

  it('says so when there is no line at that address', () => {
    renderAt('line_missing');

    expect(sections()).toHaveLength(0);
    expect(
      screen.getByRole('heading', { name: 'Assembly line not found' }),
    ).toBeInTheDocument();
  });
});
