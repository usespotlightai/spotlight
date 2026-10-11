import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceGeneral } from '@/routes/WorkspaceGeneral';

const workspace = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: workspace(),
    isPending: workspace() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch,
  }),
}));

const showing = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/w/acme-inc/settings/general']}>
        <Routes>
          <Route
            path="/w/:slug/settings/general"
            element={<WorkspaceGeneral />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  workspace.mockReturnValue({
    id: 'ws_1',
    name: 'Acme Inc.',
    slug: 'acme-inc',
  });
  failing.mockReturnValue(false);
  refetch.mockClear();
});

describe('WorkspaceGeneral', () => {
  it('names the workspace and where it lives', () => {
    showing();

    expect(
      screen.getByRole('heading', { level: 1, name: 'General' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Acme Inc.')).toBeVisible();
    expect(screen.getByText('usespotlight.ai/w/acme-inc')).toBeVisible();
  });

  it('holds the place of the name while the workspace loads', () => {
    workspace.mockReturnValue(undefined);

    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the workspace name' }),
    ).toBeInTheDocument();
  });

  it('says the settings could not be loaded, and tries again when asked', async () => {
    workspace.mockReturnValue(undefined);
    failing.mockReturnValue(true);

    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The workspace’s settings could not be loaded.',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });
});
