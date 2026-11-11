import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  NOTICES,
  type NoticesPort,
} from '@work/application/ports/notices.port';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
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
        data: { topic: 'inbox', ids: {} },
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
        watching.of('changed').some(
          (each) =>
            JSON.stringify(each.data) ===
            JSON.stringify({
              topic: 'task',
              ids: { taskId: team.list.id.value },
            }),
        ),
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
        data: { topic: 'inbox', ids: {} },
      });
    } finally {
      watching.close();
    }
  });
});
