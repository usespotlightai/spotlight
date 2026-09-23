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

const settingsFailing = vi.fn();
const membersFailing = vi.fn();
const refetchSettings = vi.fn();
const refetchMembers = vi.fn();

const query = (
  data: unknown,
  failing = false,
  refetch: () => void = vi.fn(),
) => ({
  data,
  isPending: data === undefined,
  errorUpdateCount: failing ? 1 : 0,
  isFetching: false,
  refetch,
});

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => query(workspace(), settingsFailing(), refetchSettings),
}));

vi.mock('@/hooks/api/useMembers', () => ({
  useMembers: () => query(members(), membersFailing(), refetchMembers),
}));

vi.mock('@/hooks/api/useInvites', () => ({
  useInvites: () => query(invites()),
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
  invites.mockReturnValue([]);
  settingsFailing.mockReturnValue(false);
  membersFailing.mockReturnValue(false);
  refetchSettings.mockClear();
  refetchMembers.mockClear();
  rename.mockReset();
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

  it('offers nothing to say where the team is configured', () => {
    showing();

    expect(
      screen.queryByText('Configuration repository'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Move configuration' }),
    ).not.toBeInTheDocument();
  });

  it('holds the shape of the team while it loads, keeping what never changes', () => {
    workspace.mockReturnValue(undefined);
    members.mockReturnValue(undefined);
    invites.mockReturnValue(undefined);
    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the team name' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading the members' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Team name')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add a member' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('No one is on this team yet.'),
    ).not.toBeInTheDocument();
  });

  it('renders nothing where the workspace has no such team', () => {
    workspace.mockReturnValue({ id: 'ws_1', slug: 'acme', teams: [] });
    const { container } = showing();

    expect(container).toBeEmptyDOMElement();
  });

  it('says the team’s settings could not be loaded, and tries again when asked', async () => {
    workspace.mockReturnValue(undefined);
    settingsFailing.mockReturnValue(true);
    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The team’s settings could not be loaded.',
    );
    expect(screen.queryByLabelText('Team name')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetchSettings).toHaveBeenCalled();
  });

  it('says the members could not be loaded, rather than that there are none, and tries again when asked', async () => {
    members.mockReturnValue(undefined);
    membersFailing.mockReturnValue(true);
    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Members could not be loaded.',
    );
    expect(
      screen.queryByText('No one is on this team yet.'),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetchMembers).toHaveBeenCalled();
  });

  it('offers to invite the first member where the team has none', async () => {
    members.mockReturnValue([]);
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Invite the first member' }),
    );

    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
  });
});
