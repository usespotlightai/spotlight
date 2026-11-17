import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { liveChannel } from '@platform/persistence/drizzle/schemas/live.schema';
import {
  NOTICES,
  type NoticesPort,
} from '@work/application/ports/notices.port';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import { E2E_REDIS_URL, watchedLive } from './support/live';
import { createTeam } from './support/team';

type Team = Awaited<ReturnType<typeof createTeam>>;

const teamIn = (app: INestApplication) =>
  createTeam(
    app.get(DRIZZLE),
    app.get(DrizzleTaskRepository),
    `live-${randomUUID().slice(0, 8)}`,
  );

const sequencesOn = (
  watching: ReturnType<typeof watchedLive>,
  channel: string,
): number[] =>
  watching
    .of('changed')
    .map((each) => each.data as { channel?: string; sequence?: number })
    .filter((data) => data.channel === channel)
    .map((data) => data.sequence ?? 0);

const headOf = async (app: INestApplication, channel: string) => {
  const [row] = await app
    .get<DrizzleDatabase>(DRIZZLE)
    .select({ lastSequence: liveChannel.lastSequence })
    .from(liveChannel)
    .where(eq(liveChannel.channel, channel));

  return row?.lastSequence ?? 0;
};

const noticeIn = (app: INestApplication, team: Team, subject: string) =>
  app.get<NoticesPort>(NOTICES).create({
    workspaceId: team.workspaceId,
    teamId: team.teamId,
    addressee: team.owner,
    form: 'advice',
    subject,
    link: 'insights',
    linkLabel: 'Open Insights',
    externalLink: null,
    headline: 'The station drifted',
    points: ['The pass rate fell by 12 points.'],
  });

describe('live changes on one instance', () => {
  let app: INestApplication;
  let team: Team;

  beforeAll(async () => {
    app = await openApp();
    team = await teamIn(app);
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('tells a member what changed in the workspace, and a stranger nothing', async () => {
    const member = watchedLive(app, team.owner.value);
    const stranger = watchedLive(app, randomUUID());

    try {
      await eventually(async () => member.of('ready').length === 1);
      await eventually(async () => stranger.of('ready').length === 1);
      expect(member.status()).toBe(200);

      await noticeIn(app, team, `drift-${randomUUID()}`);

      await eventually(async () => member.of('changed').length > 0);
      await eventually(async () => member.of('notification').length > 0);

      expect(member.of('changed')).toContainEqual({
        type: 'changed',
        data: {
          topic: 'inbox',
          ids: {},
          channel: `workspace:${team.workspaceId.value}`,
          sequence: expect.any(Number) as unknown,
        },
      });
      expect(member.of('notification')[0]?.data).toMatchObject({
        kind: 'notice',
        title: 'The station drifted',
      });
      expect(stranger.heard.map((each) => each.type)).toEqual(['ready']);
    } finally {
      member.close();
      stranger.close();
    }
  });

  it('sends again the changes a member missed since the sequence they give', async () => {
    const channel = `workspace:${team.workspaceId.value}`;
    const first = watchedLive(app, team.owner.value);
    let applied: number;

    try {
      await eventually(async () => first.of('ready').length === 1);
      await noticeIn(app, team, `drift-${randomUUID()}`);
      await eventually(async () => sequencesOn(first, channel).length > 0);
      applied = Math.max(...sequencesOn(first, channel));
    } finally {
      first.close();
    }

    await noticeIn(app, team, `drift-${randomUUID()}`);
    await eventually(async () => (await headOf(app, channel)) > applied);

    const second = watchedLive(app, team.owner.value, [
      `${channel}@${applied}`,
    ]);

    try {
      await eventually(async () => second.of('ready').length === 1);

      const ready = second.heard.findIndex((each) => each.type === 'ready');
      const before = second.heard.slice(0, ready);
      const replayed = before
        .map((each) => each.data as { channel?: string; sequence?: number })
        .filter((data) => data.channel === channel)
        .map((data) => data.sequence ?? 0);

      expect(before.every((each) => each.type === 'changed')).toBe(true);
      expect(replayed[0]).toBe(applied + 1);
      expect(replayed).toEqual(replayed.map((_, index) => applied + 1 + index));
      expect(second.of('ready')[0]?.data).toMatchObject({
        complete: false,
        heads: { [channel]: Math.max(...replayed) },
      });
    } finally {
      second.close();
    }
  });

  it('says on a write the sequences of the changes it made', async () => {
    const assigned = await served(app)
      .put(
        `/api/teams/${team.teamId.value}/tasks/${team.list.id.value}/assignee`,
      )
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ assigneeId: null });

    expect(assigned.status).toBeLessThan(300);
    expect(assigned.headers['spotlight-live-sequences']).toMatch(
      new RegExp(`(^|,)workspace:${team.workspaceId.value}@\\d+(,|$)`),
    );
  });
});

describe.skipIf(!E2E_REDIS_URL)('live changes across two instances', () => {
  let first: INestApplication;
  let second: INestApplication;
  let team: Team;

  beforeAll(async () => {
    first = await openApp((module) => module, {
      env: { REDIS_URL: E2E_REDIS_URL },
    });
    second = await openApp((module) => module, {
      env: { REDIS_URL: E2E_REDIS_URL },
      sharingDatabaseOf: first,
    });
    team = await teamIn(first);
  }, 60_000);

  afterAll(async () => {
    await second?.close();
    await first?.close();
  });

  it('tells a stream on one instance about a task changed through the other', async () => {
    const watching = watchedLive(second, team.owner.value);

    try {
      await eventually(async () => watching.of('ready').length === 1);

      const assigned = await served(first)
        .put(
          `/api/teams/${team.teamId.value}/tasks/${team.list.id.value}/assignee`,
        )
        .set(TEST_USER_HEADER, team.owner.value)
        .send({ assigneeId: null });
      expect(assigned.status).toBeLessThan(300);

      await eventually(async () =>
        watching.of('changed').some((each) => {
          const data = each.data as { topic?: string; ids?: unknown };

          return (
            data.topic === 'task' &&
            JSON.stringify(data.ids) ===
              JSON.stringify({ taskId: team.list.id.value })
          );
        }),
      );
    } finally {
      watching.close();
    }
  });

  it('reaches a stream on one instance with a change committed on the other', async () => {
    const watching = watchedLive(second, team.owner.value);

    try {
      await eventually(async () => watching.of('ready').length === 1);

      await noticeIn(first, team, `drift-${randomUUID()}`);

      await eventually(async () => watching.of('changed').length > 0);
      await eventually(async () => watching.of('notification').length > 0);

      expect(watching.of('changed')).toContainEqual({
        type: 'changed',
        data: expect.objectContaining({ topic: 'inbox', ids: {} }) as unknown,
      });
    } finally {
      watching.close();
    }
  });
});
