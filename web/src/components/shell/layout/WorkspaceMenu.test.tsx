import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceMenu } from '@/components/shell/layout/WorkspaceMenu';

const navigate = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));

const signOut = vi.fn();
vi.mock('@/hooks/api/useSignOut', () => ({
  useSignOut: () => ({ mutate: signOut, isPending: false }),
}));
vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({ data: { user: { email: 'dev@example.com' } } }),
}));
vi.mock('@/hooks/api/useWorkspaces', () => ({
  useWorkspaces: () => ({
    data: [
      { id: 'ws_1', name: 'Acme Inc.', slug: 'acme-inc', role: 'owner' },
      { id: 'ws_2', name: 'Örebro Co', slug: 'orebro-co', role: 'member' },
    ],
    isPending: false,
  }),
}));

const renderMenu = () =>
  render(
    <MemoryRouter>
      <WorkspaceMenu name="Acme Inc." slug="acme-inc" />
    </MemoryRouter>,
  );

const open = async () => {
  const user = userEvent.setup();
  renderMenu();
  await user.click(screen.getByRole('button', { name: /Acme Inc\./ }));
  await screen.findByRole('menu');
  return user;
};

beforeEach(() => {
  navigate.mockReset();
  signOut.mockReset();
});

describe('WorkspaceMenu', () => {
  it('shows the first letter of the workspace as its avatar', () => {
    renderMenu();

    expect(
      screen.getByRole('button', { name: /Acme Inc\./ }),
    ).toHaveTextContent('A');
  });

  it('names the signed-in account', async () => {
    await open();

    expect(screen.getByText('dev@example.com')).toBeInTheDocument();
  });

  it('marks the workspace currently being viewed', async () => {
    await open();

    expect(
      screen.getByRole('menuitemradio', { name: /Acme Inc\./ }),
    ).toBeChecked();
    expect(
      screen.getByRole('menuitemradio', { name: /Örebro Co/ }),
    ).not.toBeChecked();
  });

  it('switches to another workspace', async () => {
    const user = await open();

    await user.click(screen.getByRole('menuitemradio', { name: /Örebro Co/ }));

    expect(navigate).toHaveBeenCalledWith('/w/orebro-co');
  });

  it('stays put when the current workspace is chosen again', async () => {
    const user = await open();

    await user.click(screen.getByRole('menuitemradio', { name: /Acme Inc\./ }));

    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens workspace creation in a new tab', async () => {
    await open();

    const create = screen.getByRole('menuitem', {
      name: 'Create or join a workspace',
    });

    expect(create).toHaveAttribute('href', '/workspaces/new');
    expect(create).toHaveAttribute('target', '_blank');
  });

  it('logs the user out', async () => {
    const user = await open();

    await user.click(screen.getByRole('menuitem', { name: 'Log out' }));

    expect(signOut).toHaveBeenCalled();
  });
});
