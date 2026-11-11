import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { NotificationDto } from '@notifications/application/dto/notification.dto';
import {
  LIVE_FEED,
  type LiveFeedPort,
  personChannel,
} from '@platform/live/live-feed.port';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  NOTICES,
  type NoticesPort,
} from '@work/application/ports/notices.port';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import { createTeam } from './support/team';

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/e2e-browser';
const KEYS = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) };

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;

const noticeAbout = (subject: string, headline: string) =>
  app.get<NoticesPort>(NOTICES).create({
    workspaceId: team.workspaceId,
    teamId: team.teamId,
    addressee: team.owner,
    form: 'advice',
    subject,
    link: 'insights',
    linkLabel: 'Open Insights',
    externalLink: null,
    headline,
    points: ['The pass rate fell by 12 points.'],
  });

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `notify-${randomUUID().slice(0, 8)}`,
  );
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe('notifications about new inbox items', () => {
  it('streams a new notice to the person it is for, once', async () => {
    const seen: NotificationDto[] = [];
    const stop = app
      .get<LiveFeedPort>(LIVE_FEED)
      .subscribe([personChannel(team.owner.value)], (message) => {
        if (message.type === 'notification') {
          seen.push(message.data as unknown as NotificationDto);
        }
      });

    try {
      await noticeAbout('drift-1', 'The station drifted');

      const notification = await eventually(async () => seen[0]);

      expect(notification).toMatchObject({
        kind: 'notice',
        title: 'The station drifted',
        body: 'The pass rate fell by 12 points.',
      });
      expect(notification?.path).toMatch(
        new RegExp(`^/w/${team.slug}/inbox/notices/`),
      );

      await noticeAbout('drift-2', 'The station drifted again');
      await eventually(async () => seen.length === 2);

      expect(seen.map((each) => each.title)).toEqual([
        'The station drifted',
        'The station drifted again',
      ]);
    } finally {
      stop();
    }
  });

  it('keeps a browser subscription for its person only', async () => {
    const other = randomUUID();

    const refused = await served(app)
      .put('/api/me/push-subscriptions')
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ endpoint: 'https://169.254.169.254/latest', keys: KEYS });
    expect(refused.status).toBe(422);

    const added = await served(app)
      .put('/api/me/push-subscriptions')
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ endpoint: ENDPOINT, keys: KEYS });
    expect(added.status).toBe(204);

    const foreign = await served(app)
      .delete('/api/me/push-subscriptions')
      .set(TEST_USER_HEADER, other)
      .send({ endpoint: ENDPOINT });
    expect(foreign.status).toBe(404);

    const removed = await served(app)
      .delete('/api/me/push-subscriptions')
      .set(TEST_USER_HEADER, team.owner.value)
      .send({ endpoint: ENDPOINT });
    expect(removed.status).toBe(204);
  });

  it('says that this Spotlight sends no Web Push without a VAPID key', async () => {
    const key = await served(app)
      .get('/api/me/notifications/push-key')
      .set(TEST_USER_HEADER, team.owner.value);

    expect(key.status).toBe(200);
    expect(key.body).toEqual({ publicKey: null });
  });
});
