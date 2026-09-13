import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamGeneral } from '@/routes/TeamGeneral';

const workspace = vi.fn();
const members = vi.fn();
const invites = vi.fn();
const changeRole = vi.fn();
const invite = vi.fn();
const revoke = vi.fn();
const rename = vi.fn();
const configuration = vi.fn();
const onboarding = vi.fn();
const move = vi.fn();
const moved = vi.fn();

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({ data: workspace() }),
}));

vi.mock('@/hooks/api/useMembers', () => ({
  useMembers: () => ({ data: members() }),
}));

vi.mock('@/hooks/api/useInvites', () => ({
  useInvites: () => ({ data: invites() }),
}));

vi.mock('@/hooks/api/useInviteToTeam', () => ({
  useInviteToTeam: () => ({
    mutate: invite,
    reset: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('@/hooks/api/useRevokeInvite', () => ({
  useRevokeInvite: () => ({ mutate: revoke, isPending: false }),
}));

vi.mock('@/hooks/api/useChangeMemberRole', () => ({
  useChangeMemberRole: () => ({
    mutate: changeRole,
    isPending: false,
    isError: false,
    error: null,
    variables: undefined,
  }),
}));

vi.mock('@/hooks/api/useRenameTeam', () => ({
  useRenameTeam: () => ({ mutate: rename, isPending: false }),
}));

vi.mock('@/hooks/api/useConfiguration', () => ({
  useConfiguration: () => ({ data: configuration() }),
}));

vi.mock('@/hooks/api/useOnboarding', () => ({
  useOnboarding: () => ({ data: onboarding() }),
}));

vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({
    data: [{ fullName: 'acme/api' }, { fullName: 'acme/config' }],
  }),
}));

vi.mock('@/hooks/api/useMoveConfiguration', () => ({
  useMoveConfiguration: () => ({
    mutate: move,
    reset: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...moved(),
  }),
}));

const showing = () =>
  render(
    <MemoryRouter initialEntries={['/w/acme/team/team_1/settings/general']}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/settings/general"
          element={<TeamGeneral />}
        />
      </Routes>
    </MemoryRouter>,
  );

const moving = async () =>
  userEvent.click(screen.getByRole('button', { name: 'Move configuration' }));

const openRoleOf = async (name: string) => {
  await userEvent.click(
    screen.getByRole('button', { name: `Role of ${name}` }),
  );
  await screen.findByRole('menu');
};

beforeEach(() => {
  workspace.mockReturnValue({
    id: 'ws_1',
    name: 'Acme',
    slug: 'acme',
    teams: [{ id: 'team_1', name: 'Platform' }],
  });
  members.mockReturnValue([
    {
      id: 'user_1',
      name: 'Leon Liang',
      image: null,
      role: 'owner',
      mayBeSetTo: [],
    },
    {
      id: 'user_2',
      name: 'Ada Lovelace',
      image: null,
      role: 'member',
      mayBeSetTo: ['owner', 'admin', 'member'],
    },
  ]);
  configuration.mockReturnValue({
    repository: 'acme/config',
    readsFrom: 'acme/config',
    movingTo: null,
  });
  onboarding.mockReturnValue({
    connectedToGitHub: true,
    repositoryOwner: 'acme',
  });
  invites.mockReturnValue([]);
  moved.mockReturnValue({ isSuccess: false, data: undefined });
  rename.mockReset();
  move.mockReset();
  invite.mockReset();
  revoke.mockReset();
  changeRole.mockReset();
});

describe('TeamGeneral', () => {
  it('shows the team name', () => {
    showing();

    expect(screen.getByLabelText('Team name')).toHaveValue('Platform');
  });

  it('renames the team once edited and left', async () => {
    showing();

    const field = screen.getByLabelText('Team name');
    await userEvent.clear(field);
    await userEvent.type(field, 'Platform Team');
    await userEvent.tab();

    expect(rename).toHaveBeenCalledWith('Platform Team', expect.anything());
  });

  it('does not rename when the name is left unchanged', async () => {
    showing();

    const field = screen.getByLabelText('Team name');
    await userEvent.click(field);
    await userEvent.tab();

    expect(rename).not.toHaveBeenCalled();
  });

  it('lists the members with a count', () => {
    showing();

    expect(
      screen.getByRole('heading', { name: /Members\s*2/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Leon Liang')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('says so when the team has no members', () => {
    members.mockReturnValue([]);
    showing();

    expect(screen.getByText('No one is on this team yet.')).toBeInTheDocument();
  });

  it('shows what each member is in the workspace', () => {
    showing();

    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Role of Ada Lovelace' }),
    ).toHaveTextContent('Member');
  });

  it('sets the role an owner picks', async () => {
    showing();

    await openRoleOf('Ada Lovelace');
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Admin' }));

    expect(changeRole).toHaveBeenCalledWith({
      userId: 'user_2',
      role: 'admin',
    });
  });

  it('leaves the last owner alone', () => {
    showing();

    expect(
      screen.queryByRole('button', { name: 'Role of Leon Liang' }),
    ).not.toBeInTheDocument();
  });

  it('shows a role as plain text where none may be given', () => {
    members.mockReturnValue([
      {
        id: 'user_2',
        name: 'Ada Lovelace',
        image: null,
        role: 'member',
        mayBeSetTo: [],
      },
    ]);
    showing();

    expect(
      screen.queryByRole('button', { name: 'Role of Ada Lovelace' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('offers only the roles it was told may be given', async () => {
    members.mockReturnValue([
      {
        id: 'user_2',
        name: 'Ada Lovelace',
        image: null,
        role: 'member',
        mayBeSetTo: ['admin', 'member'],
      },
    ]);
    showing();

    await openRoleOf('Ada Lovelace');

    expect(
      screen.getByRole('menuitemradio', { name: 'Admin' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', { name: 'Owner' }),
    ).not.toBeInTheDocument();
  });

  it('lists the invited apart from the members', () => {
    invites.mockReturnValue([
      {
        id: 'invite_1',
        email: 'ada@example.com',
        invitedBy: 'Leon Liang',
        invitedAt: '2026-09-12T09:00:00.000Z',
        expiresAt: '2026-09-26T09:00:00.000Z',
      },
    ]);
    showing();

    expect(
      screen.getByRole('heading', { name: /Members\s*2/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Invited\s*1/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('Invited by Leon Liang')).toBeInTheDocument();
  });

  it('shows no Invited section while nobody is outstanding', () => {
    showing();

    expect(
      screen.queryByRole('heading', { name: /Invited/ }),
    ).not.toBeInTheDocument();
  });

  it('invites the address typed', async () => {
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Add a member' }));
    await userEvent.type(
      screen.getByLabelText('Email address'),
      'ada@example.com',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Send invitation' }),
    );

    expect(invite).toHaveBeenCalledWith('ada@example.com', expect.anything());
  });

  it('sends nothing while the address is empty', async () => {
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Add a member' }));

    expect(
      screen.getByRole('button', { name: 'Send invitation' }),
    ).toBeDisabled();
  });

  it('takes an invitation back', async () => {
    invites.mockReturnValue([
      {
        id: 'invite_1',
        email: 'ada@example.com',
        invitedBy: 'Leon Liang',
        invitedAt: '2026-09-12T09:00:00.000Z',
        expiresAt: '2026-09-26T09:00:00.000Z',
      },
    ]);
    showing();

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Unsend the invitation to ada@example.com',
      }),
    );

    expect(revoke).toHaveBeenCalledWith('invite_1');
  });

  it('shows the repository the team reads its configuration from', () => {
    showing();

    expect(screen.getByText('acme/config')).toBeInTheDocument();
    expect(screen.queryByLabelText('Repository')).not.toBeInTheDocument();
  });

  it('says where the configuration is moving while that is under way', () => {
    configuration.mockReturnValue({
      repository: 'acme/config',
      readsFrom: 'acme/config',
      movingTo: 'acme/other',
    });
    showing();

    expect(screen.getByText('acme/config')).toBeInTheDocument();
    expect(
      screen.getByText('Moving to acme/other once its pull request merges.'),
    ).toBeInTheDocument();
  });

  it('moves the configuration to the repository named', async () => {
    showing();

    await moving();

    await userEvent.type(screen.getByLabelText('Repository'), 'other');
    await userEvent.click(screen.getByRole('button', { name: 'Move' }));

    expect(move).toHaveBeenCalledWith('acme/other');
  });

  it('links the pull request that carries the configuration', async () => {
    moved.mockReturnValue({
      isSuccess: true,
      data: {
        kind: 'carried',
        url: 'https://github.com/acme/other/pull/4',
      },
      variables: 'acme/other',
    });
    showing();

    await moving();

    expect(
      screen.getByRole('link', { name: 'View pull request' }),
    ).toHaveAttribute('href', 'https://github.com/acme/other/pull/4');
    expect(
      screen.getByText(/The team reads from there once it merges\./),
    ).toBeInTheDocument();
  });

  it('says a repository already holding configuration is read from now', async () => {
    moved.mockReturnValue({
      isSuccess: true,
      data: { kind: 'adopted', url: null },
      variables: 'acme/other',
    });
    showing();

    await moving();

    expect(
      screen.getByText(
        'acme/other already holds Spotlight configuration, so this team reads from it now. Nothing was written over it.',
      ),
    ).toBeInTheDocument();
  });

  it('asks to connect GitHub before a repository can be chosen', () => {
    onboarding.mockReturnValue({
      connectedToGitHub: false,
      repositoryOwner: null,
    });
    showing();

    expect(
      screen.queryByRole('button', { name: 'Move configuration' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Connect GitHub to choose one.'),
    ).toBeInTheDocument();
  });

  it('renders nothing until the team is known', () => {
    workspace.mockReturnValue(undefined);
    const { container } = showing();

    expect(container).toBeEmptyDOMElement();
  });
});
