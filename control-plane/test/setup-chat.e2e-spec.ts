import { randomUUID } from 'node:crypto';
import {
  RUN_TOKENS,
  type RunTokensPort,
} from '@identity/application/ports/run-tokens.port';
import { DrizzleWorkspaceTokenRepository } from '@identity/infrastructure/persistence/drizzle/repositories/workspace-token.repository';
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
import { openApp, served, TEST_USER_HEADER } from './support/app';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const NOW = new Date('2026-10-11T09:00:00.000Z');

const PULL_REQUEST = 'https://github.com/acme/infra/pull/12';

describe('setting a team up as code (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let workspaceId: string;
  let owner: string;
  let member: string;
  let unseat: () => Promise<void>;

  const chats = () => app.get(DrizzleChatRepository);
  const reader = () => app.get<ChatReaderPort>(CHAT_READER);
  const runTokens = () => app.get<RunTokensPort>(RUN_TOKENS);

  const settingUp = (runId: string) =>
    Chat.start({
      workspaceId: WorkspaceId.of(workspaceId),
      teamId: TeamId.of(workspaceId),
      startedBy: UserId.of(owner),
      harness: HarnessId.of('claude-code'),
      body: ChatMessageBody.of('Set up our configuration.'),
      setup: ConfigHome.of({ repository: 'acme/infra', folder: 'spotlight' }),
      now: NOW,
      newId: () => randomUUID(),
    }).assignRun(RunId.of(runId), NOW);

  const starting = (setup: unknown) =>
    served(app)
      .post(`/api/teams/${workspaceId}/chats`)
      .set(TEST_USER_HEADER, owner)
      .send({ harness: 'claude-code', body: 'Set us up.', setup });

  const exported = (token: string) =>
    served(app)
      .get(`/api/resources/workspaces/${workspaceId}/export`)
      .set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await openApp();
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    workspaceId = `setup-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(db, workspaceId);
    owner = seat.owner;
    member = seat.member;
    unseat = seat.unseat;
  });

  afterEach(async () => {
    await db
      .delete(schema.chat)
      .where(eq(schema.chat.workspaceId, workspaceId));
    await db
      .delete(schema.workspaceToken)
      .where(eq(schema.workspaceToken.workspaceId, workspaceId));
    await unseat();
  });

  it('keeps where a setup chat writes the configuration, and the pull request it opens', async () => {
    const runId = randomUUID();
    const chat = settingUp(runId);

    await chats().add(chat);
    await expect(reader().setupOf(TeamId.of(workspaceId))).resolves.toEqual({
      id: chat.id.value,
      pullRequest: null,
      startedById: owner,
      startedBy: 'Ada',
    });

    const found = await chats().find(chat.id);
    expect(found?.setup?.repository.value).toBe('acme/infra');
    expect(found?.setup?.folder).toBe('spotlight');

    await chats().save(
      (found as Chat).openSetup(
        RunId.of(runId),
        Branch.of('spotlight-configuration'),
        PullRequestUrl.of(PULL_REQUEST),
        NOW,
      ),
    );

    await expect(
      reader().setupOf(TeamId.of(workspaceId)),
    ).resolves.toMatchObject({
      id: chat.id.value,
      pullRequest: PULL_REQUEST,
    });
  });

  it('answers no setup chat for a team that started none', async () => {
    await expect(reader().setupOf(TeamId.of(workspaceId))).resolves.toBeNull();
  });

  it('lets a token issued for a run read the workspace until the run ends', async () => {
    const issued = await runTokens().issueFor({
      workspaceId,
      runId: randomUUID(),
      attempt: 1,
      issuedBy: owner,
      scopes: ['plan'],
      expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
    });

    expect((await exported(issued.token)).status).toBe(200);

    const [row] = await db
      .select()
      .from(schema.workspaceToken)
      .where(eq(schema.workspaceToken.id, issued.id));
    expect(row?.tokenHash).not.toBe(issued.token);
    expect(row?.runAttempt).toBe(1);

    await runTokens().revokeFor(workspaceId, row?.runId as string, null);

    expect((await exported(issued.token)).status).toBe(401);
  });

  it('revokes only the attempt that ended', async () => {
    const runId = randomUUID();
    const wanted = {
      workspaceId,
      runId,
      issuedBy: owner,
      scopes: ['plan'],
      expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
    };
    const first = await runTokens().issueFor({ ...wanted, attempt: 1 });
    const second = await runTokens().issueFor({ ...wanted, attempt: 2 });

    await runTokens().revokeFor(workspaceId, runId, 1);

    expect((await exported(first.token)).status).toBe(401);
    expect((await exported(second.token)).status).toBe(200);
  });

  it('deletes a run token once it has expired', async () => {
    const expiresAt = new Date(Date.now() + 60 * 1_000);
    const issued = await runTokens().issueFor({
      workspaceId,
      runId: randomUUID(),
      attempt: 1,
      issuedBy: owner,
      scopes: ['plan'],
      expiresAt,
    });
    const expired = async (by: Date) =>
      (
        await app
          .get(DrizzleWorkspaceTokenRepository)
          .issuedAndExpiredBy(by, 10_000)
      ).map((each) => each.id.value);

    expect(await expired(new Date(expiresAt.getTime() - 1))).not.toContain(
      issued.id,
    );
    expect(await expired(expiresAt)).toContain(issued.id);
  });

  it('rejects a setup that names no repository and folder', async () => {
    await starting({ repository: 'acme/infra' }).expect(400);
    await starting('acme/infra').expect(400);
  });

  it('rejects a setup in a repository the GitHub App cannot reach', async () => {
    const rejected = await starting({
      repository: 'acme/infra',
      folder: 'spotlight',
    }).expect(422);

    expect(JSON.stringify(rejected.body)).toContain("can't reach acme/infra");
    await expect(reader().setupOf(TeamId.of(workspaceId))).resolves.toBeNull();
  });

  it('says who started the setup chat, and links it only for them', async () => {
    const chat = settingUp(randomUUID());
    await chats().add(chat);
    const seenBy = async (viewer: string) =>
      (
        await served(app)
          .get(`/api/teams/${workspaceId}/configuration/onboarding`)
          .set(TEST_USER_HEADER, viewer)
          .expect(200)
      ).body;

    await expect(seenBy(owner)).resolves.toMatchObject({
      canSetUp: false,
      setupChat: { id: chat.id.value, pullRequest: null, startedBy: 'Ada' },
    });
    await expect(seenBy(member)).resolves.toMatchObject({
      setupChat: { id: null, startedBy: 'Ada' },
    });
  });
});
