import { randomUUID } from 'node:crypto';

import {
  MEMBER_MAIL,
  type MemberMailToSend,
} from '@identity/application/ports/member-mail.port';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { firstOf } from '@shared-kernel/domain/item-at';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './support/app';
import { bodyOf } from './support/body';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import { insertStations } from './support/stations';
import { seatTeam } from './support/team';

interface Member {
  readonly id: string;
  readonly role: string;
  readonly suspendedAt: string | null;
  readonly mayBeSuspended: boolean;
  readonly mayBeUnsuspended: boolean;
  readonly mayLeave: boolean;
  readonly teams: { id: string }[];
}

describe('suspending and leaving a workspace (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let seat: Awaited<ReturnType<typeof seatTeam>>;
  const sent: MemberMailToSend[] = [];
  const workspaceId = `suspension-${randomUUID().slice(0, 8)}`;
  const lineId = `${workspaceId}-line`;

  const as = (user: string) => ({
    get: (path: string) => served(app).get(path).set(TEST_USER_HEADER, user),
    put: (path: string) => served(app).put(path).set(TEST_USER_HEADER, user),
    post: (path: string, body: object = {}) =>
      served(app).post(path).set(TEST_USER_HEADER, user).send(body),
    delete: (path: string) =>
      served(app).delete(path).set(TEST_USER_HEADER, user),
  });
  const workspace = `/api/workspaces/${workspaceId}`;
  const suspension = (id: string) => `${workspace}/members/${id}/suspension`;
  const rosterOf = async (viewer: string): Promise<Member[]> =>
    bodyOf<Member[]>(await as(viewer).get(`${workspace}/members`).expect(200));
  const memberNamed = async (viewer: string, id: string) =>
    (await rosterOf(viewer)).find((each) => each.id === id);

  beforeAll(async () => {
    app = await openApp((module) =>
      module.overrideProvider(MEMBER_MAIL).useValue({
        send: async (mail: MemberMailToSend) => {
          sent.push(mail);
        },
      }),
    );
    db = app.get<DrizzleDatabase>(DRIZZLE);
    seat = await seatTeam(db, workspaceId);
    await db.insert(schema.line).values({
      id: lineId,
      workspaceId,
      teamId: workspaceId,
      key: 'default',
      name: 'Default',
      defaultAssignee: `${seat.member}@example.com`,
    });
    await insertStations(db, [
      {
        id: `${lineId}-backlog`,
        workspaceId,
        lineId,
        key: 'backlog',
        name: 'Backlog',
        position: 0,
        kind: 'backlog',
      },
      {
        id: `${lineId}-completed`,
        workspaceId,
        lineId,
        key: 'completed',
        name: 'Completed',
        position: 1,
        kind: 'completed',
      },
    ]);
  });

  afterAll(async () => {
    await seat.unseat();
    await app.close();
  });

  it('offers the owner what they may do, and a member nothing', async () => {
    expect(await memberNamed(seat.owner, seat.member)).toMatchObject({
      suspendedAt: null,
      mayBeSuspended: true,
      mayBeUnsuspended: false,
      mayLeave: false,
    });
    expect(await memberNamed(seat.owner, seat.owner)).toMatchObject({
      mayBeSuspended: false,
      mayLeave: false,
    });
    expect(await memberNamed(seat.member, seat.owner)).toMatchObject({
      mayBeSuspended: false,
    });
    expect(await memberNamed(seat.member, seat.member)).toMatchObject({
      mayLeave: true,
    });
  });

  it('denies a member who suspends the owner, and the last owner who suspends or leaves', async () => {
    await as(seat.member).put(suspension(seat.owner)).expect(403);
    await as(seat.owner).put(suspension(seat.owner)).expect(409);
    await as(seat.owner).post(`${workspace}/leave`).expect(409);
  });

  it('cuts a suspended member off at once, but keeps them listed with their teams', async () => {
    await as(seat.owner).put(suspension(seat.member)).expect(204);

    await as(seat.member).get(workspace).expect(404);
    await as(seat.member).get(`${workspace}/members`).expect(404);

    expect(await memberNamed(seat.owner, seat.member)).toMatchObject({
      role: 'member',
      suspendedAt: expect.any(String) as unknown,
      mayBeSuspended: false,
      mayBeUnsuspended: true,
      teams: [{ id: workspaceId }],
    });
  });

  it('emails the suspended person, and clears them as the default assignee of a line', async () => {
    await eventually(async () => sent.length > 0);

    expect(sent[0]).toMatchObject({
      kind: 'suspended',
      to: `${seat.member}@example.com`,
      workspaceName: workspaceId,
      by: 'Ada',
    });
    await eventually(async () => {
      const line = firstOf(
        await db
          .select({ assignee: schema.line.defaultAssignee })
          .from(schema.line)
          .where(eq(schema.line.id, lineId)),
      );

      return line?.assignee === null;
    });
  });

  it('counts a suspended member as already in, so they cannot be invited', async () => {
    const answer = await as(seat.owner)
      .post(`${workspace}/invites`, {
        emails: [`${seat.member}@example.com`],
        role: 'member',
        teamIds: [],
      })
      .expect(200);

    expect(answer.body).toEqual({
      outcomes: [
        { email: `${seat.member}@example.com`, outcome: 'already-a-member' },
      ],
    });
  });

  it('gives back the access and the role at unsuspension, and emails them', async () => {
    await as(seat.member).delete(suspension(seat.member)).expect(404);
    await as(seat.owner).delete(suspension(seat.member)).expect(204);

    expect(await memberNamed(seat.member, seat.member)).toMatchObject({
      role: 'member',
      suspendedAt: null,
      teams: [{ id: workspaceId }],
    });
    await eventually(async () =>
      sent.some((each) => each.kind === 'unsuspended'),
    );
  });

  it('lets a member leave, stay listed, and be taken back by the owner', async () => {
    await as(seat.member).post(`${workspace}/leave`).expect(204);
    await as(seat.member).get(workspace).expect(404);

    expect(await memberNamed(seat.owner, seat.member)).toMatchObject({
      suspendedAt: expect.any(String) as unknown,
    });
    await eventually(async () => sent.some((each) => each.kind === 'left'));

    await as(seat.owner).delete(suspension(seat.member)).expect(204);
    await as(seat.member).get(workspace).expect(200);
  });
});
