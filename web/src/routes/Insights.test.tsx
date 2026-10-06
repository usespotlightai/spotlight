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
vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({
    data: [
      {
        id: 'line_1',
        key: 'delivery',
        name: 'Delivery',
        repositories: [],
        reactions: [],
        stations: [
          {
            id: 'station_impl',
            key: 'implementation',
            name: 'Implementation',
            kind: 'work',
            color: '#000',
            position: 0,
          },
        ],
      },
    ],
  }),
}));
vi.mock('@/components/features/insights/TeamInsights', () => ({
  TeamInsights: () => <p>The team’s insights</p>,
}));

describe('Insights', () => {
  const showing = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/w/:slug/team/:teamId/insights" element={<Insights />} />
        </Routes>
      </MemoryRouter>,
    );

  it('names the tab and the station shown in the breadcrumb, leading back to each', () => {
    showing('/w/acme/team/team_1/insights?tab=stations&stationId=station_impl');

    expect(
      screen.getByRole('heading', {
        name: /Platform\s*Insights\s*Stations\s*Implementation/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Stations' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=stations',
    );
    expect(screen.getByRole('link', { name: 'Insights' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights',
    );
  });

  it('opens the team’s insights under an Insights breadcrumb, with a period to pick', () => {
    render(
      <MemoryRouter initialEntries={['/w/acme/team/team_1/insights?period=7d']}>
        <Routes>
          <Route path="/w/:slug/team/:teamId/insights" element={<Insights />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: /Platform\s*Insights\s*Overview/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('The team’s insights')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Time range' }),
    ).toHaveTextContent('Past 7 days');
  });
});
