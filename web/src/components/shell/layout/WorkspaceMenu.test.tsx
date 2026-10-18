import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent, {
  PointerEventsCheckLevel,
} from '@testing-library/user-event';
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

const renderMenu = (noneOnline = false, admin = true) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <WorkspaceMenu
          name="Acme Inc."
          slug="acme-inc"
          admin={admin}
          noneOnline={noneOnline}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const open = async (admin = true) => {
  const user = userEvent.setup({
    pointerEventsCheck: PointerEventsCheckLevel.Never,
  });
  renderMenu(false, admin);
  await user.click(screen.getByRole('button', { name: /Acme Inc\./ }));
  await screen.findByRole('menu');
  return user;
};

const openWorkspaces = async () => {
  const user = await open();
  await user.click(screen.getByRole('menuitem', { name: 'Switch workspace' }));
  await screen.findByRole('menuitemradio', { name: /Acme Inc\./ });
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
    await openWorkspaces();

    expect(screen.getByText('dev@example.com')).toBeInTheDocument();
  });

  it('marks the workspace currently being viewed', async () => {
    await openWorkspaces();

    expect(
      screen.getByRole('menuitemradio', { name: /Acme Inc\./ }),
    ).toBeChecked();
    expect(
      screen.getByRole('menuitemradio', { name: /Örebro Co/ }),
    ).not.toBeChecked();
  });

  it('switches to another workspace', async () => {
    const user = await openWorkspaces();

    screen.getByRole('menuitemradio', { name: /Örebro Co/ }).focus();
    await user.keyboard('{Enter}');

    expect(navigate).toHaveBeenCalledWith('/w/orebro-co');
  });

  it('stays put when the current workspace is chosen again', async () => {
    const user = await openWorkspaces();

    screen.getByRole('menuitemradio', { name: /Acme Inc\./ }).focus();
    await user.keyboard('{Enter}');

    expect(navigate).not.toHaveBeenCalled();
  });

  it('leads to the workspace settings', async () => {
    await open();

    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/w/acme-inc/settings',
    );
  });

  it('leads an admin to the workspace’s members', async () => {
    await open();

    expect(
      screen.getByRole('menuitem', { name: 'Invite and manage members' }),
    ).toHaveAttribute('href', '/w/acme-inc/settings/members');
  });

  it('offers no member management to somebody who is not an admin', async () => {
    await open(false);

    expect(
      screen.queryByRole('menuitem', { name: 'Invite and manage members' }),
    ).not.toBeInTheDocument();
  });

  it('flags the menu and its settings when no host is online', async () => {
    const user = userEvent.setup();
    renderMenu(true);

    expect(
      screen.getByRole('img', { name: 'No host is online' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Acme Inc\./ }));

    expect(
      within(
        await screen.findByRole('menuitem', { name: /Settings/ }),
      ).getByRole('img', { name: 'No host is online' }),
    ).toBeInTheDocument();
  });

  it('opens workspace creation in a new tab', async () => {
    await openWorkspaces();

    const create = screen.getByRole('menuitem', {
      name: 'Create or join a workspace…',
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
