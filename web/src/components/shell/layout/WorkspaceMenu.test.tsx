import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent, {
  PointerEventsCheckLevel,
} from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const renderMenu = (admin = true) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <WorkspaceMenu name="Acme Inc." slug="acme-inc" admin={admin} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const open = async (admin = true) => {
  const user = userEvent.setup({
    pointerEventsCheck: PointerEventsCheckLevel.Never,
  });
  renderMenu(admin);
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

const stubMedia = (dark: boolean) =>
  vi.stubGlobal('matchMedia', () => ({
    matches: dark,
    addEventListener() {},
    removeEventListener() {},
  }));

const chooseTheme = async (name: string) => {
  const user = await open();
  await user.click(screen.getByRole('radio', { name }));
  return user;
};

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  stubMedia(false);
  navigate.mockReset();
  signOut.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WorkspaceMenu', () => {
  it('lists Theme before Settings', async () => {
    await open();

    const theme = screen.getByRole('radiogroup', { name: 'Theme' });
    const settings = screen.getByRole('menuitem', { name: 'Settings' });

    expect(
      theme.compareDocumentPosition(settings) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('marks System as the theme by default', async () => {
    await open();

    expect(screen.getByRole('radio', { name: 'System' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('moves the checked mark to the chosen theme', async () => {
    await chooseTheme('Dark');

    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'System' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('keeps the menu open after a theme is chosen', async () => {
    await chooseTheme('Dark');

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeVisible();
  });

  it('moves between themes with the arrow keys', async () => {
    const user = await chooseTheme('Light');

    await user.keyboard('{ArrowRight}');

    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('turns dark on and stores the choice', async () => {
    await chooseTheme('Dark');

    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('turns dark off and stores the choice', async () => {
    document.documentElement.classList.add('dark');
    await chooseTheme('Light');

    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('follows the system preference for System', async () => {
    localStorage.setItem('theme', 'light');
    stubMedia(true);
    await chooseTheme('System');

    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('system');
  });

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
