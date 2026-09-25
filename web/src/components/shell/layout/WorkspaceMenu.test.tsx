import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceMenu } from '@/components/shell/layout/WorkspaceMenu';

const navigate = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));

const exportWorkspace = vi.fn();
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  exportWorkspace: (options: unknown) => exportWorkspace(options),
}));

const saveFile = vi.fn();
vi.mock('@/lib/download', () => ({
  saveFile: (blob: Blob, name: string) => saveFile(blob, name),
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
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <WorkspaceMenu id="ws_1" name="Acme Inc." slug="acme-inc" />
      </MemoryRouter>
    </QueryClientProvider>,
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
  exportWorkspace.mockReset();
  saveFile.mockReset();
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

  it('downloads the workspace as a Terraform module', async () => {
    exportWorkspace.mockResolvedValue({
      data: { files: [{ path: 'main.tf', content: '' }] },
    });
    const user = await open();

    await user.click(
      screen.getByRole('menuitem', { name: 'Download as Terraform' }),
    );

    await waitFor(() =>
      expect(saveFile).toHaveBeenCalledWith(
        expect.any(Blob),
        'acme-inc-terraform.zip',
      ),
    );
    expect(exportWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ path: { id: 'ws_1' } }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument(),
    );
  });

  it('stays open and offers to try again when the download fails', async () => {
    exportWorkspace.mockRejectedValueOnce(new Error('offline'));
    const user = await open();

    await user.click(
      screen.getByRole('menuitem', { name: 'Download as Terraform' }),
    );

    const retry = await screen.findByRole('menuitem', {
      name: 'Could not download. Try again',
    });
    expect(saveFile).not.toHaveBeenCalled();

    exportWorkspace.mockResolvedValue({ data: { files: [] } });
    await user.click(retry);

    await waitFor(() => expect(saveFile).toHaveBeenCalledOnce());
  });

  it('logs the user out', async () => {
    const user = await open();

    await user.click(screen.getByRole('menuitem', { name: 'Log out' }));

    expect(signOut).toHaveBeenCalled();
  });
});
