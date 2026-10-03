import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Insights } from '@/routes/Insights';

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: { teams: [{ id: 'team_1', name: 'Platform' }] },
    isPending: false,
  }),
}));
vi.mock('@/components/features/insights/TeamInsights', () => ({
  TeamInsights: () => <p>The team’s insights</p>,
}));

describe('Insights', () => {
  it('opens the team’s insights under an Insights breadcrumb, with a period to pick', () => {
    render(
      <MemoryRouter initialEntries={['/w/acme/team/team_1/insights?period=7d']}>
        <Routes>
          <Route path="/w/:slug/team/:teamId/insights" element={<Insights />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: /Platform\s*Insights/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('The team’s insights')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Time range' }),
    ).toHaveTextContent('Past 7 days');
  });
});
