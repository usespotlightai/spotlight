import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '@/routes/Agent';

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: { teams: [{ id: 'team_1', name: 'Platform' }] },
    isPending: false,
  }),
}));
vi.mock('@/components/features/agent/AgentChats', () => ({
  AgentChats: () => <p>The team’s chats</p>,
}));

describe('Agent', () => {
  it('opens the team’s chats with its agent under an Agent breadcrumb', () => {
    render(
      <MemoryRouter initialEntries={['/w/acme/team/team_1/agent']}>
        <Routes>
          <Route path="/w/:slug/team/:teamId/agent" element={<Agent />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: /Platform\s*Agent/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Platform/ })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1',
    );
    expect(screen.getByText('The team’s chats')).toBeInTheDocument();
  });
});
