import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamGeneral } from '@/routes/TeamGeneral';

const workspace = vi.fn();
const members = vi.fn();
const everyone = vi.fn();
const changeRole = vi.fn();
const invite = vi.fn();
const add = vi.fn();
const adding = vi.fn();

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

vi.mock('@/hooks/api/useWorkspaceMembers', () => ({
  useWorkspaceMembers: () => query(everyone()),
}));

vi.mock('@/hooks/api/useAddTeamMember', () => ({
  useAddTeamMember: () => ({
    mutate: add,
    reset: vi.fn(),
    isPending: false,
    isError: adding() === 'failed',
  }),
}));

vi.mock('@/hooks/api/useInviteToWorkspace', () => ({
  useInviteToWorkspace: () => ({
    mutate: invite,
    reset: vi.fn(),
    isPending: false,
    isError: false,
  }),
}));

vi.mock('@/hooks/api/useChangeMemberRole', () => ({
  useChangeMemberRole: () => ({
    mutate: changeRole,
    isPending: false,
    variables: undefined,
  }),
}));

const showing = () =>
  render(
    <MemoryRouter initialEntries={['/w/acme/settings/team/team_1/general']}>
      <Routes>
        <Route
          path="/w/:slug/settings/team/:teamId/general"
          element={<TeamGeneral />}
        />
      </Routes>
    </MemoryRouter>,
  );

const workspaceMember = (
  id: string,
  name: string,
  teams: { id: string; name: string }[],
) => ({
  id,
  name,
  email: `${name.split(' ')[0]?.toLowerCase()}@example.com`,
  image: null,
  role: 'member',
  teams,
  joinedAt: '2026-09-01T09:00:00.000Z',
  mayBeSetTo: [],
});

const openAdd = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Add a member' }));
  await screen.findByRole('menu');
};

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
    role: 'owner',
    teams: [
      { id: 'team_1', name: 'Platform' },
      { id: 'team_2', name: 'Growth' },
    ],
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
  everyone.mockReturnValue([
    workspaceMember('user_1', 'Leon Liang', [
      { id: 'team_1', name: 'Platform' },
    ]),
    workspaceMember('user_2', 'Ada Lovelace', [
      { id: 'team_1', name: 'Platform' },
    ]),
    workspaceMember('user_3', 'Grace Hopper', [
      { id: 'team_2', name: 'Growth' },
    ]),
    workspaceMember('user_4', 'Lena Park', []),
  ]);
  adding.mockReturnValue('idle');
  settingsFailing.mockReturnValue(false);
  membersFailing.mockReturnValue(false);
  refetchSettings.mockClear();
  refetchMembers.mockClear();
  invite.mockReset();
  add.mockReset();
  changeRole.mockReset();
});

describe('TeamGeneral', () => {
  it('shows the team name without offering to change it', () => {
    showing();

    expect(screen.getByText('Platform')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
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

    expect(
      screen.getByText('No members yet. Add one to get started.'),
    ).toBeInTheDocument();
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

  it('offers nothing to say where the team is configured', () => {
    showing();

    expect(
      screen.queryByText('Configuration repository'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Move configuration' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the shape of the team while it loads, keeping what never changes', () => {
    workspace.mockReturnValue(undefined);
    members.mockReturnValue(undefined);
    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the team name' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading the members' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Team name')).toBeInTheDocument();
    expect(
      screen.queryByText('No members yet. Add one to get started.'),
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
    expect(screen.queryByText('Team name')).not.toBeInTheDocument();

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
      screen.queryByText('No members yet. Add one to get started.'),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetchMembers).toHaveBeenCalled();
  });

  it('says the team has no one yet, leaving adding to the section’s own button', async () => {
    members.mockReturnValue([]);
    showing();

    expect(
      screen.getByText('No members yet. Add one to get started.'),
    ).toBeInTheDocument();

    await openAdd();

    expect(
      screen.getByRole('menuitem', { name: 'Invite someone new' }),
    ).toBeInTheDocument();
  });

  it('offers the workspace’s members who are not on the team yet', async () => {
    showing();

    await openAdd();

    expect(
      screen.getByRole('menuitem', { name: /^Grace Hopper/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /^Lena Park/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: /^Ada Lovelace/ }),
    ).not.toBeInTheDocument();
  });

  it('adds the member picked to the team', async () => {
    showing();

    await openAdd();
    await userEvent.click(screen.getByRole('menuitem', { name: /^Lena Park/ }));

    expect(add).toHaveBeenCalledWith('user_4');
  });

  it('says so when everyone in the workspace is on the team', async () => {
    everyone.mockReturnValue([
      workspaceMember('user_1', 'Leon Liang', [
        { id: 'team_1', name: 'Platform' },
      ]),
    ]);
    showing();

    await openAdd();

    expect(
      screen.getByText('Everyone in the workspace is on this team.'),
    ).toBeInTheDocument();
  });

  it('says when a member could not be added', () => {
    adding.mockReturnValue('failed');
    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sorry, the member couldn’t be added.',
    );
  });

  it('invites someone new with this team already chosen', async () => {
    showing();

    await openAdd();
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Invite someone new' }),
    );
    const dialog = await screen.findByRole('dialog');

    expect(
      within(dialog).getByRole('button', { name: 'Teams: Platform' }),
    ).toBeInTheDocument();

    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Email addresses' }),
      'ada@example.com',
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Send invites' }),
    );

    expect(invite).toHaveBeenCalledWith(
      { emails: ['ada@example.com'], role: 'member', teamIds: ['team_1'] },
      expect.anything(),
    );
  });

  it('leaves adding people to the workspace’s admins', () => {
    workspace.mockReturnValue({
      id: 'ws_1',
      name: 'Acme',
      slug: 'acme',
      role: 'member',
      teams: [{ id: 'team_1', name: 'Platform' }],
    });
    members.mockReturnValue([]);
    showing();

    expect(
      screen.queryByRole('button', { name: 'Add a member' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('No members yet. Please ask an admin to add people.'),
    ).toBeInTheDocument();
  });
});
