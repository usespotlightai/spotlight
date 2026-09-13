import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamSection } from '@/routes/TeamSection';

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: { teams: [{ id: 'team_1', name: 'Platform' }] },
    isPending: false,
  }),
}));
vi.mock('@/components/features/skills/TeamSkills', () => ({
  TeamSkills: () => <p>The team’s skills</p>,
}));
vi.mock('@/components/features/runs/TeamRuns', () => ({
  TeamRuns: () => <p>The team’s runs</p>,
}));
vi.mock('@/components/features/trace/list/TraceList', () => ({
  TraceList: () => null,
}));

const renderAt = (section: string) =>
  render(
    <MemoryRouter initialEntries={[`/w/acme/team/team_1/${section}`]}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/:section"
          element={<TeamSection />}
        />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
});

describe('TeamSection', () => {
  it('shows the team’s skills under a Skills breadcrumb', () => {
    renderAt('skills');

    expect(
      screen.getByRole('heading', { name: /Platform\s*Skills/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('The team’s skills')).toBeInTheDocument();
  });

  it('sends a section it does not know on to the runs', async () => {
    renderAt('nowhere');

    expect(await screen.findByText('The team’s runs')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Platform\s*Runs/ }),
    ).toBeInTheDocument();
  });
});
