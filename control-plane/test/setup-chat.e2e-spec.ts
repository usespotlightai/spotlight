import { randomUUID } from 'node:crypto';
import {
  RUN_TOKENS,
  type RunTokensPort,
} from '@identity/application/ports/run-tokens.port';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  CHAT_READER,
  type ChatReaderPort,
} from '@work/application/ports/chat-reader.port';
import {
  LINE_READER,
  type LineReaderPort,
} from '@work/application/ports/line-reader.port';
import {
  TASK_READER,
  type TaskReaderPort,
} from '@work/application/ports/task-reader.port';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ConfigHome } from '@work/domain/value-objects/config-home.vo';
import { DrizzleChatRepository } from '@work/infrastructure/persistence/drizzle/repositories/chat.repository';
import { eq } from 'drizzle-orm';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { openApp, served } from './support/app';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const NOW = new Date('2026-10-11T09:00:00.000Z');

const PULL_REQUEST = 'https://github.com/acme/infra/pull/12';

describe('setting a team up as code (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let held: string;
  let owner: string;
  let unseat: () => Promise<void>;

  const chats = () => app.get(DrizzleChatRepository);
  const reader = () => app.get<ChatReaderPort>(CHAT_READER);
  const runTokens = () => app.get<RunTokensPort>(RUN_TOKENS);

  const settingUp = (runId: string) =>
    Chat.start({
      workspaceId: WorkspaceId.of(held),
      teamId: TeamId.of(held),
      startedBy: UserId.of(owner),
      harness: HarnessId.of('claude-code'),
      body: ChatMessageBody.of('Set up our configuration.'),
      setup: ConfigHome.of({ repository: 'acme/infra', folder: 'spotlight' }),
      now: NOW,
      newId: () => randomUUID(),
    }).handedTo(RunId.of(runId), NOW);

  const exported = (token: string) =>
    served(app)
      .get(`/api/resources/workspaces/${held}/export`)
      .set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    held = `setup-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(db, held);
    owner = seat.owner;
    unseat = seat.unseat;
  });

  afterEach(async () => {
    await db.delete(schema.chat).where(eq(schema.chat.workspaceId, held));
    await db
      .delete(schema.workspaceToken)
      .where(eq(schema.workspaceToken.workspaceId, held));
    await unseat();
  });

  it('keeps where a setup chat writes the configuration, and the pull request it opens', async () => {
    const runId = randomUUID();
    const chat = settingUp(runId);

    await chats().add(chat);
    await expect(reader().setupOf(TeamId.of(held))).resolves.toEqual({
      id: chat.id.value,
      pullRequest: null,
    });

    const found = await chats().find(chat.id);
    expect(found?.setup?.repository.value).toBe('acme/infra');
    expect(found?.setup?.folder).toBe('spotlight');

    await chats().save(
      (found as Chat).setupOpened(
        RunId.of(runId),
        Branch.of('spotlight-configuration'),
        PullRequestUrl.of(PULL_REQUEST),
        NOW,
      ),
    );

    await expect(reader().setupOf(TeamId.of(held))).resolves.toEqual({
      id: chat.id.value,
      pullRequest: PULL_REQUEST,
    });
  });

  it('words the review invitation with the policy’s defaults for a line kept before they existed', async () => {
    await db.insert(schema.line).values({
      id: randomUUID(),
      workspaceId: held,
      teamId: held,
      key: 'review',
      name: 'Review',
      role: 'review',
      reviews: {
        start: 'mentioned',
        mention: '@spotlight',
        skip: { spotlight: true, drafts: true, authors: [] },
      } as never,
    });

    await expect(
      app.get<LineReaderPort>(LINE_READER).reviewInvitationOf(TeamId.of(held)),
    ).resolves.toEqual({
      label: 'spotlight',
      mention: '@spotlight',
      repository: null,
    });
  });

  it('answers no setup chat for a team that started none', async () => {
    await expect(reader().setupOf(TeamId.of(held))).resolves.toBeNull();
  });

  it('says when each source first opened a task for the team, leaving out people', async () => {
    const lineId = randomUUID();
    const stationId = randomUUID();
    await db.insert(schema.line).values({
      id: lineId,
      workspaceId: held,
      teamId: held,
      key: 'delivery',
      name: 'Delivery',
    });
    await db.insert(schema.station).values({
      id: stationId,
      lineId,
      key: 'backlog',
      name: 'Backlog',
      position: 0,
      kind: 'backlog',
    });
    const first = new Date('2026-10-10T08:00:00.000Z');
    const later = new Date('2026-10-10T09:00:00.000Z');
    await db.insert(schema.task).values(
      [
        { openedFrom: 'slack', createdAt: later },
        { openedFrom: 'slack', createdAt: first },
        { openedFrom: 'person', createdAt: first },
      ].map((each) => ({
        id: randomUUID(),
        workspaceId: held,
        stationId,
        title: 'Retry uploads',
        ...each,
      })),
    );

    const opened = await app
      .get<TaskReaderPort>(TASK_READER)
      .firstOpenedFrom(TeamId.of(held));

    expect([...opened.entries()]).toEqual([['slack', first]]);
  });

  it('lets a token minted for a run read the workspace until the run ends', async () => {
    const minted = await runTokens().mintFor({
      workspaceId: held,
      runId: randomUUID(),
      attempt: 1,
      issuedBy: owner,
      scopes: ['plan'],
      expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
    });

    expect((await exported(minted.token)).status).toBe(200);

    const [row] = await db
      .select()
      .from(schema.workspaceToken)
      .where(eq(schema.workspaceToken.id, minted.id));
    expect(row?.tokenHash).not.toBe(minted.token);
    expect(row?.mintedForAttempt).toBe(1);

    await runTokens().revokeFor(held, row?.mintedForRun as string, null);

    expect((await exported(minted.token)).status).toBe(401);
  });

  it('revokes only the attempt that ended', async () => {
    const runId = randomUUID();
    const wanted = {
      workspaceId: held,
      runId,
      issuedBy: owner,
      scopes: ['plan'],
      expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
    };
    const first = await runTokens().mintFor({ ...wanted, attempt: 1 });
    const second = await runTokens().mintFor({ ...wanted, attempt: 2 });

    await runTokens().revokeFor(held, runId, 1);

    expect((await exported(first.token)).status).toBe(401);
    expect((await exported(second.token)).status).toBe(200);
  });
});
