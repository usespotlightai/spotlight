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
vi.mock('@/components/features/agent/AgentChats', () => ({
  AgentChats: () => <p>The team’s chats</p>,
}));
vi.mock('@/components/features/runs/TeamRuns', () => ({
  TeamRuns: () => <p>The team’s runs</p>,
}));
vi.mock('@/components/features/trace/list/TraceList', () => ({
  TraceList: () => null,
}));
vi.mock('@/components/features/insights/TeamInsights', () => ({
  TeamInsights: () => <p>The team’s insights</p>,
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
  it('opens the team’s chats with its agent under an Agent breadcrumb', () => {
    renderAt('agent');

    expect(
      screen.getByRole('heading', { name: /Platform\s*Agent/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('The team’s chats')).toBeInTheDocument();
  });

  it('opens the team’s insights under an Insights breadcrumb, with a period to pick', () => {
    renderAt('insights?period=7d');

    expect(
      screen.getByRole('heading', { name: /Platform\s*Insights/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('The team’s insights')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Time range' }),
    ).toHaveTextContent('Past 7 days');
  });

  it('sends a section it does not know on to the runs', async () => {
    renderAt('nowhere');

    expect(await screen.findByText('The team’s runs')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Platform\s*Runs/ }),
    ).toBeInTheDocument();
  });
});
