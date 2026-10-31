import { randomUUID } from 'node:crypto';
import {
  INVITE_MAIL,
  type InviteToSend,
} from '@identity/application/ports/invite-mail.port';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

interface Member {
  readonly id: string;
  readonly role: string;
  readonly teams: { id: string; name: string }[];
}

describe('inviting people to a workspace (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let seat: Awaited<ReturnType<typeof seatTeam>>;
  const sent: InviteToSend[] = [];
  const workspaceId = `invites-${randomUUID().slice(0, 8)}`;
  const mobile = `${workspaceId}-mobile`;
  const gone = `${workspaceId}-gone`;
  const [ada, grace, alan, mallory, hedy, kay, lin, joan] = [
    1, 2, 3, 4, 5, 6, 7, 8,
  ].map(() => randomUUID());
  const people = [ada, grace, alan, mallory, hedy, kay, lin, joan];
  const emailOf = (id: string) => `${id}@example.com`;

  const http = () => served(app);
  const as = (user: string) => ({
    get: (path: string) => http().get(path).set(TEST_USER_HEADER, user),
    post: (path: string, body: object = {}) =>
      http().post(path).set(TEST_USER_HEADER, user).send(body),
    delete: (path: string) => http().delete(path).set(TEST_USER_HEADER, user),
  });
  const invites = `/api/workspaces/${workspaceId}/invites`;
  const tokenFor = (email: string) =>
    [...sent].reverse().find((each) => each.to === email)?.token ?? '';
  const members = async (): Promise<Member[]> =>
    (
      await as(seat.owner)
        .get(`/api/workspaces/${workspaceId}/members`)
        .expect(200)
    ).body;
  const memberNamed = async (id: string) =>
    (await members()).find((each) => each.id === id);

  beforeAll(async () => {
    app = await openApp((module) =>
      module.overrideProvider(INVITE_MAIL).useValue({
        send: async (invite: InviteToSend) => {
          sent.push(invite);
        },
      }),
    );
    db = app.get<DrizzleDatabase>(DRIZZLE);
    seat = await seatTeam(db, workspaceId);
    await db.insert(schema.user).values(
      people.map((id) => ({
        id,
        name: id,
        email: emailOf(id),
      })),
    );
    await db.insert(schema.team).values([
      { id: mobile, workspaceId, key: 'mobile', name: 'Mobile' },
      { id: gone, workspaceId, key: 'gone', name: 'Gone' },
    ]);
    await db.insert(schema.teamMember).values([
      { teamId: mobile, userId: seat.owner },
      { teamId: gone, userId: seat.owner },
    ]);
  });

  afterAll(async () => {
    await db
      .delete(schema.workspaceToken)
      .where(eq(schema.workspaceToken.workspaceId, workspaceId));
    await seat.unseat();
    await db.delete(schema.user).where(inArray(schema.user.id, people));
    await app.close();
  });

  it('invites several people as admins to two teams in one go, one email each, and reports who is already in', async () => {
    const answer = await as(seat.owner)
      .post(invites, {
        emails: [
          emailOf(ada),
          emailOf(grace),
          emailOf(alan),
          emailOf(seat.member),
        ],
        role: 'admin',
        teamIds: [workspaceId, mobile],
      })
      .expect(200);

    expect(answer.body).toEqual({
      outcomes: [
        { email: emailOf(ada), outcome: 'invited' },
        { email: emailOf(grace), outcome: 'invited' },
        { email: emailOf(alan), outcome: 'invited' },
        { email: emailOf(seat.member), outcome: 'already-a-member' },
      ],
    });
    expect(sent.map((each) => each.to).sort()).toEqual(
      [emailOf(ada), emailOf(grace), emailOf(alan)].sort(),
    );
    expect(sent[0]).toMatchObject({
      workspaceName: workspaceId,
      invitedBy: 'Ada',
      teamNames: expect.arrayContaining([workspaceId, 'Mobile']),
    });
  });

  it('lists the invitations still waiting, with their role, teams and inviter', async () => {
    const listed = (await as(seat.owner).get(invites).expect(200)).body;

    expect(listed).toHaveLength(3);
    expect(listed[0]).toMatchObject({
      role: 'admin',
      invitedBy: { id: seat.owner, name: 'Ada', image: null },
    });
    expect(
      listed[0].teams.map((each: { id: string }) => each.id).sort(),
    ).toEqual([workspaceId, mobile].sort());
  });

  it('shows a member no invitations, and lets them send none', async () => {
    await as(seat.member).get(invites).expect(404);
    await as(seat.member)
      .post(invites, {
        emails: [emailOf(mallory)],
        role: 'member',
        teamIds: [],
      })
      .expect(404);
  });

  it('lets nobody invite an owner', async () => {
    const answer = await as(seat.owner)
      .post(invites, { emails: [emailOf(mallory)], role: 'owner', teamIds: [] })
      .expect(403);

    expect(JSON.stringify(answer.body)).toMatch(/invited as an owner/);
  });

  it('rejects a team from elsewhere', async () => {
    await as(seat.owner)
      .post(invites, {
        emails: [emailOf(mallory)],
        role: 'member',
        teamIds: ['team_elsewhere'],
      })
      .expect(422);
  });

  it('shows anybody with the link the preview of the invitation', async () => {
    const preview = await http()
      .get(`/api/invites/${tokenFor(emailOf(ada))}`)
      .expect(200);

    expect(preview.body).toEqual({
      email: emailOf(ada),
      workspaceName: workspaceId,
      invitedBy: 'Ada',
      role: 'admin',
      teamNames: expect.arrayContaining([workspaceId, 'Mobile']),
      status: 'pending',
    });
  });

  it('denies somebody signed in as anybody else, naming who to sign in as', async () => {
    const answer = await as(mallory)
      .post(`/api/invites/${tokenFor(emailOf(ada))}/accept`)
      .expect(403);

    expect(JSON.stringify(answer.body)).toContain(`sign in as ${emailOf(ada)}`);
  });

  it('lands whoever accepts in the workspace as an admin, on both teams', async () => {
    const answer = await as(ada)
      .post(`/api/invites/${tokenFor(emailOf(ada))}/accept`)
      .expect(200);

    expect(answer.body).toEqual({ workspaceSlug: workspaceId });

    const joined = await eventually(async () => {
      const found = await memberNamed(ada);
      return found && found.teams.length === 2 ? found : null;
    });

    expect(joined.role).toBe('admin');
    expect(joined.teams.map((each) => each.id).sort()).toEqual(
      [workspaceId, mobile].sort(),
    );
    await http()
      .get(`/api/invites/${tokenFor(emailOf(ada))}`)
      .expect(200)
      .expect((read) => expect(read.body.status).toBe('accepted'));
    expect((await as(seat.owner).get(invites).expect(200)).body).toHaveLength(
      2,
    );
  });

  it('reports somebody who joined as already a member when invited again', async () => {
    const answer = await as(seat.owner)
      .post(invites, { emails: [emailOf(ada)], role: 'member', teamIds: [] })
      .expect(200);

    expect(answer.body.outcomes).toEqual([
      { email: emailOf(ada), outcome: 'already-a-member' },
    ]);
  });

  it('lists everyone in the workspace, with their role, teams, and what the caller may set', async () => {
    const everyone = (
      await as(seat.member)
        .get(`/api/workspaces/${workspaceId}/members`)
        .expect(200)
    ).body;
    const bea = (await members()).find(
      (each: Member) => each.id === seat.member,
    );

    expect(everyone.map((each: Member) => each.id).sort()).toEqual(
      [seat.owner, seat.member, ada].sort(),
    );
    expect(everyone[0]).toMatchObject({
      email: expect.stringContaining('@example.com'),
      joinedAt: expect.any(String),
      assignableRoles: [],
    });
    expect(bea).toMatchObject({
      role: 'member',
      assignableRoles: ['owner', 'admin', 'member'],
    });
    await as(mallory).get(`/api/workspaces/${workspaceId}/members`).expect(404);
  });

  it('sends an invitation again with a fresh link, so the old one stops working', async () => {
    const before = tokenFor(emailOf(grace));
    const [invite] = (
      await as(seat.owner).get(invites).expect(200)
    ).body.filter((each: { email: string }) => each.email === emailOf(grace));

    const answer = await as(seat.owner)
      .post(`${invites}/${invite.id}/resend`)
      .expect(200);

    expect(answer.body).toMatchObject({ id: invite.id, role: 'admin' });
    expect(tokenFor(emailOf(grace))).not.toBe(before);
    await http().get(`/api/invites/${before}`).expect(404);
    await http()
      .get(`/api/invites/${tokenFor(emailOf(grace))}`)
      .expect(200);
  });

  it('takes an invitation back, so its link stops working', async () => {
    const [invite] = (
      await as(seat.owner).get(invites).expect(200)
    ).body.filter((each: { email: string }) => each.email === emailOf(alan));

    await as(seat.member).delete(`${invites}/${invite.id}`).expect(404);
    await as(seat.owner).delete(`${invites}/${invite.id}`).expect(204);

    await http()
      .get(`/api/invites/${tokenFor(emailOf(alan))}`)
      .expect(200)
      .expect((read) => expect(read.body.status).toBe('revoked'));
    await as(alan)
      .post(`/api/invites/${tokenFor(emailOf(alan))}/accept`)
      .expect(409);
    await as(seat.owner).post(`${invites}/${invite.id}/resend`).expect(409);
  });

  it('skips a team deleted since the invitation was sent', async () => {
    await as(seat.owner)
      .post(invites, {
        emails: [emailOf(mallory)],
        role: 'member',
        teamIds: [gone, mobile],
      })
      .expect(200);
    await db.delete(schema.team).where(eq(schema.team.id, gone));

    await as(mallory)
      .post(`/api/invites/${tokenFor(emailOf(mallory))}/accept`)
      .expect(200);

    const joined = await eventually(async () => {
      const found = await memberNamed(mallory);
      return found && found.teams.length > 0 ? found : null;
    });

    expect(joined.role).toBe('member');
    expect(joined.teams.map((each) => each.id)).toEqual([mobile]);
  });

  it('puts somebody already in the workspace on a team directly', async () => {
    const team = `/api/teams/${mobile}/members`;

    await as(seat.member).post(team, { userId: seat.member }).expect(404);
    await as(seat.owner).post(team, { userId: seat.member }).expect(204);
    await as(seat.owner).post(team, { userId: seat.member }).expect(409);
    await as(seat.owner).post(team, { userId: grace }).expect(422);

    expect(
      (await memberNamed(seat.member))?.teams.map((each) => each.id).sort(),
    ).toEqual([workspaceId, mobile].sort());
  });

  it('keeps the role of somebody already in the workspace who accepts, and puts them on its teams', async () => {
    await as(seat.owner)
      .post(invites, {
        emails: [emailOf(hedy)],
        role: 'admin',
        teamIds: [mobile],
      })
      .expect(200);
    await db
      .insert(schema.workspaceMember)
      .values({ workspaceId, userId: hedy, role: 'member' });

    await as(hedy)
      .post(`/api/invites/${tokenFor(emailOf(hedy))}/accept`)
      .expect(200);

    const joined = await eventually(async () => {
      const found = await memberNamed(hedy);
      return found && found.teams.length > 0 ? found : null;
    });

    expect(joined.role).toBe('member');
    expect(joined.teams.map((each) => each.id)).toEqual([mobile]);
  });

  it('invites an address again whose accepted invite outlived the account that accepted it', async () => {
    const first = await (async () => {
      await as(seat.owner)
        .post(invites, { emails: [emailOf(kay)], role: 'member', teamIds: [] })
        .expect(200);
      return tokenFor(emailOf(kay));
    })();
    await as(kay).post(`/api/invites/${first}/accept`).expect(200);
    await eventually(async () => (await memberNamed(kay)) ?? null);
    await db.delete(schema.user).where(eq(schema.user.id, kay));

    await http()
      .get(`/api/invites/${first}`)
      .expect(200)
      .expect((read) => expect(read.body.status).toBe('accepted'));
    await as(seat.owner).post(`/api/invites/${first}/accept`).expect(409);
    const answer = await as(seat.owner)
      .post(invites, { emails: [emailOf(kay)], role: 'member', teamIds: [] })
      .expect(200);

    expect(answer.body.outcomes).toEqual([
      { email: emailOf(kay), outcome: 'invited' },
    ]);
    expect(tokenFor(emailOf(kay))).not.toBe(first);
  });

  it('keeps the invitations of somebody whose account was deleted, from nobody', async () => {
    await db
      .insert(schema.workspaceMember)
      .values({ workspaceId, userId: lin, role: 'admin' });
    await as(lin)
      .post(invites, { emails: [emailOf(joan)], role: 'member', teamIds: [] })
      .expect(200);
    await db.delete(schema.user).where(eq(schema.user.id, lin));

    const [remaining] = (
      await as(seat.owner).get(invites).expect(200)
    ).body.filter((each: { email: string }) => each.email === emailOf(joan));

    expect(remaining.invitedBy).toBeNull();
    await http()
      .get(`/api/invites/${tokenFor(emailOf(joan))}`)
      .expect(200)
      .expect((read) => expect(read.body.invitedBy).toBeNull());

    const again = await as(seat.owner)
      .post(`${invites}/${remaining.id}/resend`)
      .expect(200);

    expect(again.body.invitedBy).toMatchObject({ id: seat.owner });
  });

  it('leaves a run-out invitation off the list of those still waiting', async () => {
    const expired = `${randomUUID()}@example.com`;
    await as(seat.owner)
      .post(invites, { emails: [expired], role: 'member', teamIds: [] })
      .expect(200);
    const listed = async () =>
      (await as(seat.owner).get(invites).expect(200)).body.map(
        (each: { email: string }) => each.email,
      );

    expect(await listed()).toContain(expired);

    await db
      .update(schema.workspaceInvite)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.workspaceInvite.email, expired));

    expect(await listed()).not.toContain(expired);
  });

  it('puts nobody on a team by a workspace token', async () => {
    const issued = await http()
      .post(`/api/v1/resources/workspaces/${workspaceId}/tokens`)
      .set(TEST_USER_HEADER, seat.owner)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'team-adder', scopes: ['configure'] })
      .expect(201);

    await http()
      .post(`/api/teams/${mobile}/members`)
      .set(
        'Authorization',
        `Bearer ${issued.headers['spotlight-workspace-token']}`,
      )
      .send({ userId: seat.member })
      .expect(401);
  });
});
