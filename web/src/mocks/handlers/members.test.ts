import { describe, expect, it } from 'vitest';
import {
  acceptInvite,
  addTeamMember,
  changeMemberRole,
  inviteToWorkspace,
  listMembers,
  listWorkspaceInvites,
  listWorkspaceMembers,
  readInvite,
  resendInvite,
  revokeInvite,
} from '@/lib/api';
import { setScenario } from '@/mocks/scenario';
import { serveMockApi } from '@/mocks/testing';
import { GROWTH_ID, PLATFORM_ID, SLUG } from '@/mocks/world';

const slug = { path: { slug: SLUG }, throwOnError: true } as const;

const members = async () => (await listWorkspaceMembers(slug)).data;

const invites = async () => (await listWorkspaceInvites(slug)).data;

describe('the mock members', () => {
  serveMockApi();

  it('answers everyone in the workspace with their teams', async () => {
    const everyone = await members();
    const lena = everyone.find((each) => each.name === 'Lena Park');
    const sam = everyone.find((each) => each.name === 'Sam Rivera');

    expect(everyone.map((each) => each.role)).toEqual([
      'owner',
      'admin',
      'member',
      'member',
      'member',
    ]);
    expect(sam?.teams.map((each) => each.name)).toEqual(['Platform', 'Growth']);
    expect(sam?.mayBeSetTo).toEqual([]);
    expect(lena?.teams).toEqual([]);
  });

  it('answers the pending invites with who sent them', async () => {
    const pending = await invites();

    expect(pending.map((each) => each.email)).toContain('jordan.lee@acme.dev');
    expect(
      pending.find((each) => each.email === 'jordan.lee@acme.dev')?.invitedBy,
    ).toMatchObject({ name: 'Sam Rivera' });
    expect(
      pending.find((each) => each.email === 'dana.wright@contractors.io')
        ?.invitedBy,
    ).toBeNull();
    expect(
      pending.every(
        (each) => Date.parse(each.expiresAt) > Date.parse(each.invitedAt),
      ),
    ).toBe(true);
  });

  it('tells each address apart when inviting', async () => {
    const { data } = await inviteToWorkspace({
      ...slug,
      body: {
        emails: ['Jordan.Lee@acme.dev', 'maya.chen@acme.dev', 'ines@acme.dev'],
        role: 'admin',
        teamIds: [GROWTH_ID],
      },
    });
    const added = (await invites()).find(
      (each) => each.email === 'ines@acme.dev',
    );

    expect(data.outcomes.map((each) => each.outcome)).toEqual([
      'sent-again',
      'already-a-member',
      'invited',
    ]);
    expect(added).toMatchObject({ role: 'admin', teams: [{ id: GROWTH_ID }] });
  });

  it('keeps an invite whose email bounced, and says it was not sent', async () => {
    const { data } = await inviteToWorkspace({
      ...slug,
      body: { emails: ['bounce@acme.dev'], role: 'member', teamIds: [] },
    });

    expect(data.outcomes).toEqual([
      { email: 'bounce@acme.dev', outcome: 'not-sent' },
    ]);
    expect(
      (await invites()).some((each) => each.email === 'bounce@acme.dev'),
    ).toBe(true);
  });

  it('resends and revokes an invite', async () => {
    const { data: sent } = await resendInvite({
      path: { slug: SLUG, inviteId: 'invite_dana' },
      throwOnError: true,
    });
    await revokeInvite({
      path: { slug: SLUG, inviteId: 'invite_jordan' },
      throwOnError: true,
    });

    expect(sent.invitedBy?.name).toBe('Sam Rivera');
    expect((await invites()).map((each) => each.id)).not.toContain(
      'invite_jordan',
    );
  });

  it('adds a workspace member to a team', async () => {
    await addTeamMember({
      path: { teamId: PLATFORM_ID },
      body: { userId: 'user_5' },
      throwOnError: true,
    });
    const { data: platform } = await listMembers({
      path: { teamId: PLATFORM_ID },
      throwOnError: true,
    });
    const lena = (await members()).find((each) => each.id === 'user_5');

    expect(platform.map((each) => each.name)).toContain('Lena Park');
    expect(lena?.teams.map((each) => each.name)).toEqual(['Platform']);
  });

  it('changes a role everywhere the member shows', async () => {
    await changeMemberRole({
      path: { slug: SLUG, userId: 'user_2' },
      body: { role: 'admin' },
      throwOnError: true,
    });
    const { data: platform } = await listMembers({
      path: { teamId: PLATFORM_ID },
      throwOnError: true,
    });

    expect((await members()).find((each) => each.id === 'user_2')?.role).toBe(
      'admin',
    );
    expect(platform.find((each) => each.id === 'user_2')?.role).toBe('admin');
  });

  it('reads an invite link and accepts it once', async () => {
    const { data: offer } = await readInvite({
      path: { token: 'invite_platform' },
      throwOnError: true,
    });
    const { data: joined } = await acceptInvite({
      path: { token: 'invite_platform' },
      throwOnError: true,
    });
    const again = await acceptInvite({ path: { token: 'invite_platform' } });

    expect(offer).toMatchObject({
      workspaceName: 'Acme',
      role: 'member',
      teamNames: ['Platform'],
      standing: 'open',
    });
    expect(joined).toEqual({ workspaceSlug: SLUG });
    expect(again.response?.status).toBe(409);
  });

  it('lets a member read the members but change nobody, and hides the invites', async () => {
    setScenario({ account: 'member' });
    const everyone = await members();
    const { response } = await listWorkspaceInvites({ path: { slug: SLUG } });

    expect(everyone).toHaveLength(5);
    expect(everyone.every((each) => each.mayBeSetTo.length === 0)).toBe(true);
    expect(response?.status).toBe(404);
  });

  it('answers a stale invite row as the server does once the invite was accepted', async () => {
    await acceptInvite({
      path: { token: 'invite_platform' },
      throwOnError: true,
    });
    const at = { path: { slug: SLUG, inviteId: 'invite_jordan' } };
    const resent = await resendInvite(at);
    const revoked = await revokeInvite(at);

    expect(resent.response?.status).toBe(409);
    expect(resent.error).toMatchObject({
      detail: 'This invite has already been accepted.',
    });
    expect(revoked.response?.status).toBe(409);
    expect((await invites()).map((each) => each.id)).not.toContain(
      'invite_jordan',
    );
  });

  it('answers a revoked invite sent again with a conflict, and revoking it again with nothing', async () => {
    const at = { path: { slug: SLUG, inviteId: 'invite_jordan' } };
    await revokeInvite({ ...at, throwOnError: true });

    expect((await resendInvite(at)).error).toMatchObject({
      detail: 'This invite has been revoked.',
    });
    expect((await revokeInvite(at)).response?.status).toBe(204);
  });

  it('hides inviting, resending and revoking from a member, as the server does', async () => {
    setScenario({ account: 'member' });
    const at = { path: { slug: SLUG, inviteId: 'invite_jordan' } };
    const invited = await inviteToWorkspace({
      path: { slug: SLUG },
      body: { emails: ['ada@acme.dev'], role: 'member', teamIds: [] },
    });

    expect(invited.response?.status).toBe(404);
    expect((await resendInvite(at)).response?.status).toBe(404);
    expect((await revokeInvite(at)).response?.status).toBe(404);
  });

  it('refuses a member changing a role, and adding someone already on the team', async () => {
    const added = await addTeamMember({
      path: { teamId: PLATFORM_ID },
      body: { userId: 'user_1' },
    });
    setScenario({ account: 'member' });
    const changed = await changeMemberRole({
      path: { slug: SLUG, userId: 'user_2' },
      body: { role: 'admin' },
    });

    expect(added.error).toMatchObject({
      status: 409,
      detail: 'Platform already includes this person.',
    });
    expect(changed.error).toMatchObject({
      status: 403,
      detail: 'Only an owner or an admin can set roles.',
    });
  });

  it('refuses an invite for an address that is not one', async () => {
    const { response } = await inviteToWorkspace({
      path: { slug: SLUG },
      body: { emails: ['ada'], role: 'member', teamIds: [] },
    });

    expect(response?.status).toBe(422);
  });
});

describe('the mock members of a fresh workspace', () => {
  serveMockApi('empty');

  it('answers no pending invites and no invite links', async () => {
    const { response } = await readInvite({
      path: { token: 'invite_platform' },
    });

    expect(await invites()).toEqual([]);
    expect(response?.status).toBe(404);
  });
});
