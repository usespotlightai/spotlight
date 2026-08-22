import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { CreateWorkspace } from '@/routes/CreateWorkspace';

vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({
    data: { user: { email: 'dev@example.com' } },
    isPending: false,
  }),
}));

const signOut = vi.fn();
vi.mock('@/hooks/api/useSignOut', () => ({
  useSignOut: () => ({ mutate: signOut, isPending: false }),
}));

const renderPage = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={['/workspaces/new']}>
        <CreateWorkspace />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('CreateWorkspace', () => {
  it('shows who is signed in', () => {
    renderPage();

    expect(screen.getByText('dev@example.com')).toBeInTheDocument();
  });

  it('signs the user out', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Log out' }));

    expect(signOut).toHaveBeenCalled();
  });

  it('derives the URL from the workspace name', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Workspace Name'), 'Acme Inc.');

    expect(screen.getByLabelText('Workspace URL')).toHaveValue('acme-inc');
  });

  it('stops deriving the URL once it is edited by hand', async () => {
    const user = userEvent.setup();
    renderPage();

    const name = screen.getByLabelText('Workspace Name');
    const url = screen.getByLabelText('Workspace URL');

    await user.type(name, 'Acme');
    await user.clear(url);
    await user.type(url, 'Spot Light');
    await user.type(name, ' Inc.');

    expect(url).toHaveValue('spot-light');
  });

  it('keeps submission blocked until both fields are filled', async () => {
    const user = userEvent.setup();
    renderPage();

    const submit = screen.getByRole('button', { name: 'Create workspace' });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Workspace Name'), 'Acme');

    expect(submit).toBeEnabled();
  });
});
