import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceIndex } from '@/routes/WorkspaceIndex';

const workspace = vi.fn();

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: workspace(),
    isPending: workspace() === undefined,
    errorUpdateCount: 0,
  }),
}));

const renderIndex = () =>
  render(
    <MemoryRouter initialEntries={['/w/acme']}>
      <Routes>
        <Route path="/w/:slug" element={<WorkspaceIndex />} />
        <Route path="/w/:slug/team/:teamId" element={<p>team page</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  workspace.mockReset();
});

describe('WorkspaceIndex', () => {
  it('holds the bar of the page while the workspace loads', () => {
    workspace.mockReturnValue(undefined);

    const { container } = renderIndex();

    expect(
      screen.getByRole('status', { name: 'Loading the workspace' }),
    ).toBeInTheDocument();
    expect(container.querySelector('header')).toBeInTheDocument();
  });

  it('sends the caller to the first team', () => {
    workspace.mockReturnValue({
      name: 'Acme',
      teams: [{ id: 'team_1', name: 'Platform' }],
    });

    renderIndex();

    expect(screen.getByText('team page')).toBeInTheDocument();
  });

  it('says so when the workspace has no teams', () => {
    workspace.mockReturnValue({ name: 'Acme', teams: [] });

    renderIndex();

    expect(
      screen.getByText('This workspace has no teams yet.'),
    ).toBeInTheDocument();
  });
});
