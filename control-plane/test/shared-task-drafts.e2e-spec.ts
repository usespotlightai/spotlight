import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import {
  HocuspocusProvider,
  HocuspocusProviderWebsocket,
} from '@hocuspocus/provider';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import {
  LIVE_TASK_DRAFTS,
  type LiveTaskDraftsPort,
} from '@work/application/ports/live-task-drafts.port';
import { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Doc } from 'yjs';
import { openApp, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import { createTeam } from './support/team';

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;
const opened: { destroy(): void }[] = [];

const signedInAs = (userId: string | null, origin?: string) =>
  class extends WebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, {
        protocols,
        headers: {
          ...(userId ? { [TEST_USER_HEADER]: userId } : {}),
          ...(origin ? { origin } : {}),
        },
      } as never);
    }
  };

const join = (userId: string | null, options: { origin?: string } = {}) => {
  const port = ((app.getHttpServer() as Server).address() as { port: number })
    .port;
  const document = new Doc();
  const seen = { synced: false, refused: false };
  const websocketProvider = new HocuspocusProviderWebsocket({
    url: `ws://127.0.0.1:${port}/api/collab`,
    WebSocketPolyfill: signedInAs(userId, options.origin),
  });
  const provider = new HocuspocusProvider({
    websocketProvider,
    name: `task-draft:${team.list.id.value}`,
    document,
    token: 'session',
    onSynced: () => {
      seen.synced = true;
    },
    onAuthenticationFailed: () => {
      seen.refused = true;
    },
  });
  provider.attach();
  opened.push(provider, websocketProvider);

  return { document, provider, seen };
};

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `drafts-${randomUUID().slice(0, 8)}`,
  );
}, 60_000);

afterAll(async () => {
  for (const each of opened) {
    each.destroy();
  }
  await app?.close();
});

describe('the shared draft of a task', () => {
  it('lets two members of the workspace write it together', async () => {
    const ada = join(team.owner.value);
    const again = join(team.owner.value);
    await eventually(async () => ada.seen.synced && again.seen.synced, 10_000);

    ada.document.getText('t').insert(0, 'Cap the retries at 500.');

    await eventually(
      async () =>
        again.document.getText('t').toString() === 'Cap the retries at 500.',
      10_000,
    );
  });

  it('refuses a person who cannot see the workspace', async () => {
    const outsider = join(randomUUID());

    await eventually(async () => outsider.seen.refused, 10_000);
    expect(outsider.seen.synced).toBe(false);
  });

  it('refuses a socket a page of another site opened', async () => {
    const elsewhere = join(team.owner.value, {
      origin: 'https://elsewhere.example',
    });

    await new Promise((done) => setTimeout(done, 1_000));
    expect(elsewhere.seen.synced).toBe(false);
  });

  it('knows who wrote, and tells every writer what was sent', async () => {
    const ada = join(team.owner.value);
    await eventually(async () => ada.seen.synced, 10_000);
    ada.document.getMap('writers').set(team.owner.value, true);
    const live = app.get<LiveTaskDraftsPort>(LIVE_TASK_DRAFTS);

    await eventually(async () => {
      const writers = await live.writers(team.list.id);
      return writers.some((each) => each.equals(team.owner));
    }, 10_000);

    await live.sent(team.list.id, DraftGeneration.of(1), 'Cap it.');

    await eventually(
      async () =>
        ada.document.getMap('meta').get('generation') === 1 &&
        ada.document.getMap('meta').get('sent') === 'Cap it.' &&
        ada.document.getMap('writers').size === 0,
      10_000,
    );
    expect(await live.writers(team.list.id)).toEqual<UserId[]>([]);
  });

  it('keeps the draft once everyone has left', async () => {
    for (const each of opened.splice(0)) {
      each.destroy();
    }

    await eventually(async () => {
      const [row] = await db
        .select()
        .from(schema.taskDraft)
        .where(eq(schema.taskDraft.taskId, team.list.id.value));
      return row?.state != null && row.state.byteLength > 0;
    }, 15_000);
  });
});
