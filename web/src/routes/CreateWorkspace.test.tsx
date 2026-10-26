import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { wasCreatedHere } from '@/lib/setup-status';
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
};
vi.mock('@/hooks/api/useCreateWorkspace', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/api/useCreateWorkspace')>()),
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

type User = ReturnType<typeof userEvent.setup>;

const reachSurvey = async (user: User, teamName = 'Platform') => {
  await user.type(screen.getByLabelText('Workspace name'), 'Acme Inc.');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.type(screen.getByLabelText('Team name'), teamName);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
};

const chooseRole = async (user: User, role: string) => {
  await user.click(screen.getByRole('button', { name: /^Role:/ }));
  await user.click(await screen.findByRole('menuitemradio', { name: role }));
};

beforeEach(() => {
  createWorkspace.mockReset();
  createState.isPending = false;
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

    await user.type(screen.getByLabelText('Workspace name'), 'Acme Inc.');

    expect(screen.getByLabelText('Workspace URL')).toHaveValue('acme-inc');
  });

  it('stops deriving the URL once it is edited by hand', async () => {
    const user = userEvent.setup();
    renderPage();

    const name = screen.getByLabelText('Workspace name');
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

    await user.type(screen.getByLabelText('Workspace name'), 'Acme');

    expect(submit).toBeEnabled();
  });

  it('needs the team name before creating anything', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Workspace name'), 'Acme Inc.');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByLabelText('Team name')).toBeInTheDocument();
    expect(screen.queryByLabelText('Workspace name')).not.toBeInTheDocument();
    expect(createWorkspace).not.toHaveBeenCalled();
  });

  it('keeps the second step blocked until the team is named', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Workspace name'), 'Acme Inc.');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    await user.type(screen.getByLabelText('Team name'), 'Platform');

    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });

  it('asks for the role and the referral source after the team', async () => {
    const user = userEvent.setup();
    renderPage();

    await reachSurvey(user);

    expect(screen.getByText('What is your role?')).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Where did you hear about us\?/),
    ).toBeInTheDocument();
    expect(createWorkspace).not.toHaveBeenCalled();
  });

  it('keeps the last step blocked until a role is chosen', async () => {
    const user = userEvent.setup();
    renderPage();

    await reachSurvey(user);

    expect(
      screen.getByRole('button', { name: 'Create workspace' }),
    ).toBeDisabled();

    await chooseRole(user, 'Founder');

    expect(
      screen.getByRole('button', { name: 'Create workspace' }),
    ).toBeEnabled();
  });

  it('keeps the team name when stepped back from the survey', async () => {
    const user = userEvent.setup();
    renderPage();

    await reachSurvey(user);
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByLabelText('Team name')).toHaveValue('Platform');
  });

  it('keeps the workspace name when stepped back', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Workspace name'), 'Acme Inc.');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByLabelText('Workspace name')).toHaveValue('Acme Inc.');
    expect(screen.getByLabelText('Workspace URL')).toHaveValue('acme-inc');
  });

  it('submits the trimmed names and the normalised slug', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Workspace name'), '  Acme Inc.  ');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Team name'), '  Platform  ');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await chooseRole(user, 'Engineering');
    await user.type(
      screen.getByLabelText(/Where did you hear about us\?/),
      '  Hacker News  ',
    );
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));

    expect(createWorkspace).toHaveBeenCalledWith(
      {
        name: 'Acme Inc.',
        slug: 'acme-inc',
        teamName: 'Platform',
        survey: { jobFunction: 'engineering', referralSource: 'Hacker News' },
      },
      expect.anything(),
    );
  });

  it('sends no referral source when it is left blank', async () => {
    const user = userEvent.setup();
    renderPage();

    await reachSurvey(user);
    await chooseRole(user, 'Data');
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));

    expect(createWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        survey: { jobFunction: 'data', referralSource: null },
      }),
      expect.anything(),
    );
  });

  it('blocks a second submit while one is in flight', async () => {
    const user = userEvent.setup();
    renderPage();

    await reachSurvey(user);
    createState.isPending = true;
    await chooseRole(user, 'Founder');

    expect(
      screen.getByRole('button', { name: 'Creating workspace…' }),
    ).toBeDisabled();
  });

  it('lands in the inbox', async () => {
    const user = userEvent.setup();
    renderPage();

    await reachSurvey(user);
    await chooseRole(user, 'Founder');
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
    expect(wasCreatedHere('acme-inc')).toBe(true);
  });
});
