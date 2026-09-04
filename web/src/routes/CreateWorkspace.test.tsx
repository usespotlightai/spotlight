import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateWorkspace } from '@/routes/CreateWorkspace';

vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({
    data: { user: { email: 'dev@example.com' } },
    isPending: false,
  }),
}));

const createWorkspace = vi.fn();
const createState = {
  mutate: createWorkspace,
  isPending: false,
  isError: false,
  error: null as Error | null,
};
vi.mock('@/hooks/api/useCreateWorkspace', () => ({
  useCreateWorkspace: () => createState,
}));

const navigate = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
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

beforeEach(() => {
  createWorkspace.mockReset();
  createState.isPending = false;
  createState.isError = false;
  createState.error = null;
});

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

  it('keeps the first step blocked until the workspace is named', async () => {
    const user = userEvent.setup();
    renderPage();

    const submit = screen.getByRole('button', { name: 'Continue' });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText('Workspace Name'), 'Acme');

    expect(submit).toBeEnabled();
  });

  // Nothing is created by naming the workspace. The team is asked for first.
  it('asks for the team name before creating anything', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Workspace Name'), 'Acme Inc.');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByLabelText('Team Name')).toBeInTheDocument();
    expect(screen.queryByLabelText('Workspace Name')).not.toBeInTheDocument();
    expect(createWorkspace).not.toHaveBeenCalled();
  });

  it('keeps the second step blocked until the team is named', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Workspace Name'), 'Acme Inc.');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      screen.getByRole('button', { name: 'Create workspace' }),
    ).toBeDisabled();

    await user.type(screen.getByLabelText('Team Name'), 'Platform');

    expect(
      screen.getByRole('button', { name: 'Create workspace' }),
    ).toBeEnabled();
  });

  // Going back keeps what was typed: it is one flow, not two forms.
  it('holds on to the workspace name when stepped back', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Workspace Name'), 'Acme Inc.');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByLabelText('Workspace Name')).toHaveValue('Acme Inc.');
    expect(screen.getByLabelText('Workspace URL')).toHaveValue('acme-inc');
  });

  it('submits the trimmed names and the normalised slug', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Workspace Name'), '  Acme Inc.  ');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Team Name'), '  Platform  ');
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));

    expect(createWorkspace).toHaveBeenCalledWith(
      { name: 'Acme Inc.', slug: 'acme-inc', teamName: 'Platform' },
      expect.anything(),
    );
  });

  it('shows why the control-plane refused', () => {
    createState.isError = true;
    createState.error = new Error(
      'The workspace URL "acme-inc" is already taken',
    );

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('already taken');
  });

  it('blocks a second submit while one is in flight', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Workspace Name'), 'Acme Inc.');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    createState.isPending = true;
    await user.type(screen.getByLabelText('Team Name'), 'Platform');

    expect(
      screen.getByRole('button', { name: 'Creating workspace…' }),
    ).toBeDisabled();
  });

  // Opening the team leaves a note there saying what it still needs.
  it('lands in the inbox', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Workspace Name'), 'Acme Inc.');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Team Name'), 'Platform');
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));

    const [, callbacks] = createWorkspace.mock.calls[0];
    callbacks.onSuccess({
      id: 'ws_1',
      name: 'Acme Inc.',
      slug: 'acme-inc',
      teams: [{ id: 'team_1', name: 'Platform' }],
    });

    expect(navigate).toHaveBeenCalledWith('/w/acme-inc/inbox', {
      replace: true,
    });
  });
});
