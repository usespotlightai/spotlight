import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceMembers } from '@/routes/WorkspaceMembers';

const workspace = vi.fn();
const members = vi.fn();
const invites = vi.fn();
const membersFailing = vi.fn();
const refetchMembers = vi.fn();
const askedMembers = vi.fn();
const changeRole = vi.fn();
const changing = vi.fn();
const resend = vi.fn();
const resending = vi.fn();
const revoke = vi.fn();
const revoking = vi.fn();

const query = (data: unknown, failing = false, refetch = vi.fn()) => ({
  data,
  isPending: data === undefined,
  errorUpdateCount: failing ? 1 : 0,
  isFetching: false,
  refetch,
});

const mutation = (mutate: (...args: unknown[]) => void, state: string) => ({
  mutate,
  reset: vi.fn(),
  isPending: state === 'pending',
  isError: state === 'failed',
  isSuccess: state === 'done',
  error: state === 'failed' ? new Error('') : null,
  variables: undefined,
});

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({ data: workspace() }),
}));

vi.mock('@/hooks/api/useWorkspaceMembers', () => ({
  useWorkspaceMembers: (slug: string | undefined) => {
    askedMembers(slug);
    return query(members(), membersFailing(), refetchMembers);
  },
}));

vi.mock('@/hooks/api/useWorkspaceInvites', () => ({
  useWorkspaceInvites: () => query(invites()),
}));

vi.mock('@/hooks/api/useChangeMemberRole', () => ({
  useChangeMemberRole: () => mutation(changeRole, changing()),
}));

vi.mock('@/hooks/api/useResendInvite', () => ({
  useResendInvite: () => mutation(resend, resending()),
}));

vi.mock('@/hooks/api/useRevokeInvite', () => ({
  useRevokeInvite: () => mutation(revoke, revoking()),
}));

vi.mock('@/hooks/api/useInviteToWorkspace', () => ({
  useInviteToWorkspace: () => mutation(vi.fn(), 'idle'),
}));

const PLATFORM = { id: 'team_1', name: 'Platform' };

const GROWTH = { id: 'team_2', name: 'Growth' };

const member = (over: Record<string, unknown>) => ({
  id: 'user_1',
  name: 'Sam Rivera',
  email: 'sam@example.com',
  image: null,
  role: 'owner',
  teams: [PLATFORM, GROWTH],
  joinedAt: '2026-05-01T09:00:00.000Z',
  mayBeSetTo: [],
  ...over,
});

const pendingInvite = (over: Record<string, unknown> = {}) => ({
  id: 'invite_1',
  email: 'jordan.lee@acme.dev',
  role: 'member',
  teams: [PLATFORM],
  invitedBy: { id: 'user_1', name: 'Sam Rivera', image: null },
  invitedAt: new Date(Date.now() - 86_400_000).toISOString(),
  expiresAt: new Date(Date.now() + 6 * 86_400_000 - 60_000).toISOString(),
  ...over,
});

function Where() {
  const { search } = useLocation();
  return <p data-testid="where">{search}</p>;
}

const showing = (at = '/w/acme/settings/members') =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/w/:slug" element={<p>the workspace</p>} />
        <Route
          path="/w/:slug/settings/members"
          element={
            <>
              <WorkspaceMembers />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

const membersList = () => screen.getByRole('list', { name: 'Members' });

const invitesList = () => screen.getByRole('list', { name: 'Pending invites' });

const actOnInvite = async (action: string) => {
  await userEvent.click(
    screen.getByRole('button', { name: 'Actions for jordan.lee@acme.dev' }),
  );
  await userEvent.click(await screen.findByRole('menuitem', { name: action }));
};

beforeEach(() => {
  workspace.mockReturnValue({
    id: 'ws_1',
    slug: 'acme',
    role: 'owner',
    teams: [PLATFORM, GROWTH],
  });
  members.mockReturnValue([
    member({}),
    member({
      id: 'user_2',
      name: 'Priya Nair',
      email: 'priya.nair@acme.dev',
      role: 'admin',
      teams: [GROWTH],
      mayBeSetTo: ['owner', 'member'],
    }),
    member({
      id: 'user_3',
      name: 'Maya Chen',
      email: 'maya.chen@acme.dev',
      role: 'member',
      teams: [PLATFORM],
      mayBeSetTo: ['admin'],
    }),
    member({
      id: 'user_4',
      name: 'Lena Park',
      email: 'lena.park@acme.dev',
      role: 'member',
      teams: [],
      mayBeSetTo: ['owner', 'admin'],
    }),
  ]);
  invites.mockReturnValue([pendingInvite()]);
  membersFailing.mockReturnValue(false);
  changing.mockReturnValue('idle');
  resending.mockReturnValue('idle');
  revoking.mockReturnValue('idle');
  for (const each of [
    refetchMembers,
    askedMembers,
    changeRole,
    resend,
    revoke,
  ]) {
    each.mockReset();
  }
});

describe('WorkspaceMembers', () => {
  it('lists everyone with their address, teams and role', () => {
    showing();

    const list = membersList();

    expect(
      screen.getByRole('heading', { name: /Members\s*4/ }),
    ).toBeInTheDocument();
    expect(within(list).getByText('Maya Chen')).toBeInTheDocument();
    expect(
      within(list).getByText('maya.chen@acme.dev · Platform'),
    ).toBeInTheDocument();
    expect(
      within(list).getByText('lena.park@acme.dev · No team'),
    ).toBeInTheDocument();
    expect(within(list).getByText('Owner')).toBeInTheDocument();
    expect(within(list).getByText('Admin')).toBeInTheDocument();
  });

  it('lists the pending invites with their role, teams, sender and expiry', () => {
    showing();

    const list = invitesList();

    expect(
      screen.getByRole('heading', { name: /Pending invites\s*1/ }),
    ).toBeInTheDocument();
    expect(within(list).getByText('jordan.lee@acme.dev')).toBeInTheDocument();
    expect(
      within(list).getByText(
        'Platform · Invited by Sam Rivera · Expires in 6 days',
      ),
    ).toBeInTheDocument();
    expect(within(list).getByText('Member')).toBeInTheDocument();
  });

  it('says someone who has left sent an invite whose sender’s account is gone', () => {
    invites.mockReturnValue([pendingInvite({ invitedBy: null })]);
    showing();

    expect(
      within(invitesList()).getByText(
        'Platform · Invited by someone who has left · Expires in 6 days',
      ),
    ).toBeInTheDocument();
  });

  it('leaves the pending invites out while nobody is invited', () => {
    invites.mockReturnValue([]);
    showing();

    expect(
      screen.queryByRole('heading', { name: /Pending invites/ }),
    ).not.toBeInTheDocument();
  });

  it('shows only the role filtered for, without the invites', () => {
    showing('/w/acme/settings/members?show=member');

    const list = membersList();

    expect(
      screen.getByRole('heading', { name: /Members\s*2/ }),
    ).toBeInTheDocument();
    expect(within(list).getByText('Maya Chen')).toBeInTheDocument();
    expect(within(list).queryByText('Sam Rivera')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('list', { name: 'Pending invites' }),
    ).not.toBeInTheDocument();
  });

  it('shows only the pending invites when they are filtered for', () => {
    showing('/w/acme/settings/members?show=invited');

    expect(
      screen.queryByRole('list', { name: 'Members' }),
    ).not.toBeInTheDocument();
    expect(
      within(invitesList()).getByText('jordan.lee@acme.dev'),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Invite people' }),
    ).toBeInTheDocument();
  });

  it('says no pending invites when they are filtered for and there are none', () => {
    invites.mockReturnValue([]);
    showing('/w/acme/settings/members?show=invited');

    expect(screen.getByText('No pending invites.')).toBeInTheDocument();
  });

  it('says no one matches a role nobody has', () => {
    members.mockReturnValue([member({})]);
    showing('/w/acme/settings/members?show=admin');

    expect(
      screen.getByText(
        'No admins match. Please clear the filter to see everyone.',
      ),
    ).toBeInTheDocument();
  });

  it('filters from the filter menu into the address', async () => {
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Filter members' }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Show: Everyone' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: 'Admins' }),
    );

    expect(screen.getByTestId('where')).toHaveTextContent('?show=admin');
    expect(
      screen.getByRole('heading', { name: /Admins\s*1/ }),
    ).toBeInTheDocument();
  });

  it('changes a member’s role to one it may be set to', async () => {
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Actions for Maya Chen' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Change role' }),
    );
    const offered = await screen.findAllByRole('menuitemradio');

    expect(offered.map((each) => each.textContent)).toEqual([
      'Admin',
      'Member',
    ]);

    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Admin' }));

    expect(changeRole).toHaveBeenCalledWith({
      userId: 'user_3',
      role: 'admin',
    });
  });

  it('offers no actions for a member whose role may not be changed', () => {
    showing();

    expect(
      screen.queryByRole('button', { name: 'Actions for Sam Rivera' }),
    ).not.toBeInTheDocument();
  });

  it('says when a role could not be changed', () => {
    changing.mockReturnValue('failed');
    members.mockReturnValue([
      member({ id: 'user_3', name: 'Maya Chen', mayBeSetTo: ['admin'] }),
    ]);
    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sorry, the role couldn’t be changed.',
    );
  });

  it('sends an invite again', async () => {
    showing();

    await actOnInvite('Resend invite');

    expect(resend).toHaveBeenCalledWith('invite_1');
  });

  it('says an invite was sent again', () => {
    resending.mockReturnValue('done');
    showing();

    expect(within(invitesList()).getByRole('status')).toHaveTextContent(
      'Sent again',
    );
  });

  it('says when an invite could not be sent again', () => {
    resending.mockReturnValue('failed');
    showing();

    expect(within(invitesList()).getByRole('alert')).toHaveTextContent(
      'Sorry, the invite couldn’t be sent again.',
    );
  });

  it('revokes an invite', async () => {
    showing();

    await actOnInvite('Revoke invite');

    expect(revoke).toHaveBeenCalledWith('invite_1');
  });

  it('says when an invite could not be revoked', () => {
    revoking.mockReturnValue('failed');
    showing();

    expect(within(invitesList()).getByRole('alert')).toHaveTextContent(
      'Sorry, the invite couldn’t be revoked.',
    );
  });

  it('opens the invite dialog', async () => {
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Invite people' }),
    );

    expect(
      within(await screen.findByRole('dialog')).getByRole('heading', {
        name: 'Invite people',
      }),
    ).toBeInTheDocument();
  });

  it('sends somebody who is not an admin back to the workspace, unread', () => {
    workspace.mockReturnValue({
      id: 'ws_1',
      slug: 'acme',
      role: 'member',
      teams: [],
    });
    showing();

    expect(screen.getByText('the workspace')).toBeInTheDocument();
    expect(askedMembers).not.toHaveBeenCalledWith('acme');
  });

  it('keeps the shape of the list while it loads', () => {
    members.mockReturnValue(undefined);
    invites.mockReturnValue(undefined);
    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the members' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading the pending invites' }),
    ).toBeInTheDocument();
  });

  it('says the members could not be loaded, and tries again when asked', async () => {
    members.mockReturnValue(undefined);
    membersFailing.mockReturnValue(true);
    showing();

    expect(within(membersList()).getByRole('alert')).toHaveTextContent(
      'Members could not be loaded.',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetchMembers).toHaveBeenCalled();
  });
});
