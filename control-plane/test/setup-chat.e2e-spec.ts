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
  let held: string;
  let owner: string;
  let member: string;
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

  const starting = (setup: unknown) =>
    served(app)
      .post(`/api/teams/${held}/chats`)
      .set(TEST_USER_HEADER, owner)
      .send({ harness: 'claude-code', body: 'Set us up.', setup });

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
    member = seat.member;
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
      startedById: owner,
      startedBy: 'Ada',
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

    await expect(reader().setupOf(TeamId.of(held))).resolves.toMatchObject({
      id: chat.id.value,
      pullRequest: PULL_REQUEST,
    });
  });

  it('answers no setup chat for a team that started none', async () => {
    await expect(reader().setupOf(TeamId.of(held))).resolves.toBeNull();
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

  it('prunes a run token once it has expired', async () => {
    const expiresAt = new Date(Date.now() + 60 * 1_000);
    const minted = await runTokens().mintFor({
      workspaceId: held,
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
          .mintedAndExpiredBy(by, 10_000)
      ).map((each) => each.id.value);

    expect(await expired(new Date(expiresAt.getTime() - 1))).not.toContain(
      minted.id,
    );
    expect(await expired(expiresAt)).toContain(minted.id);
  });

  it('refuses a setup that names no repository and folder', async () => {
    await starting({ repository: 'acme/infra' }).expect(400);
    await starting('acme/infra').expect(400);
  });

  it('refuses a setup in a repository the GitHub App cannot reach', async () => {
    const refused = await starting({
      repository: 'acme/infra',
      folder: 'spotlight',
    }).expect(422);

    expect(JSON.stringify(refused.body)).toContain("can't reach acme/infra");
    await expect(reader().setupOf(TeamId.of(held))).resolves.toBeNull();
  });

  it('says who started the setup chat, and links it only for them', async () => {
    const chat = settingUp(randomUUID());
    await chats().add(chat);
    const seenBy = async (viewer: string) =>
      (
        await served(app)
          .get(`/api/teams/${held}/configuration/onboarding`)
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
