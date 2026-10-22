import { randomUUID } from 'node:crypto';
import {
  REPOSITORY_SETTINGS,
  type RepositorySettingsPort,
  type VariablesWrite,
} from '@github/application/ports/repository-settings.port';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { ACCESSIBLE_REPOSITORIES } from '@work/application/ports/accessible-repositories.port';
import { and, eq } from 'drizzle-orm';
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

describe('setting up CI when an admin picks the configuration repository (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let workspaceId: string;
  let owner: string;
  let member: string;
  let unseat: () => Promise<void>;
  let protectedBranch: boolean;
  let variables: VariablesWrite;
  const written: Record<string, string>[] = [];

  const settings: RepositorySettingsPort = {
    defaultBranchOf: async () => ({ name: 'main', protected: protectedBranch }),
    putVariables: async (_, __, put) => {
      written.push({ ...put });
      return variables;
    },
  };

  const startingAs = (person: string, repository = 'acme/infra') =>
    served(app)
      .post(`/api/teams/${workspaceId}/chats`)
      .set(TEST_USER_HEADER, person)
      .send({
        harness: 'claude-code',
        body: 'Set us up.',
        setup: { repository, folder: 'spotlight' },
      });

  const trusts = () =>
    db
      .select()
      .from(schema.oidcTrust)
      .where(eq(schema.oidcTrust.workspaceId, workspaceId));

  const onboarding = async (viewer: string) =>
    (
      await served(app)
        .get(`/api/teams/${workspaceId}/configuration/onboarding`)
        .set(TEST_USER_HEADER, viewer)
        .expect(200)
    ).body;

  beforeAll(async () => {
    app = await openApp((module) =>
      module
        .overrideProvider(REPOSITORY_SETTINGS)
        .useValue(settings)
        .overrideProvider(ACCESSIBLE_REPOSITORIES)
        .useValue({ isAccessible: async () => true }),
    );
    db = app.get<DrizzleDatabase>(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    workspaceId = `setup-ci-${randomUUID().slice(0, 8)}`;
    const seat = await seatTeam(db, workspaceId);
    owner = seat.owner;
    member = seat.member;
    unseat = seat.unseat;
    protectedBranch = true;
    variables = 'written';
    written.length = 0;
    await db.insert(schema.runnerPool).values({
      id: randomUUID(),
      workspaceId,
      key: 'push',
      provisionUrl: 'https://pool.example.com/provision',
      provisionSecret: 'sealed',
      provisionEgress: 'egress_1',
    });
  });

  afterEach(async () => {
    await db.delete(schema.run).where(eq(schema.run.workspaceId, workspaceId));
    await db
      .delete(schema.chat)
      .where(eq(schema.chat.workspaceId, workspaceId));
    await db
      .delete(schema.oidcTrust)
      .where(eq(schema.oidcTrust.workspaceId, workspaceId));
    await db
      .delete(schema.runnerPool)
      .where(eq(schema.runnerPool.workspaceId, workspaceId));
    await unseat();
  });

  it('trusts the repository’s pull requests to plan and its default branch to apply', async () => {
    await startingAs(owner).expect(201);

    const kept = await trusts();
    const byKey = Object.fromEntries(kept.map((each) => [each.key, each]));

    expect(byKey['github-pull-requests']).toMatchObject({
      issuer: 'https://token.actions.githubusercontent.com',
      audience: 'spotlight',
      subject: 'repo:acme/infra:pull_request',
      scopes: ['plan'],
      createdBy: owner,
    });
    expect(byKey['github-apply']).toMatchObject({
      subject: 'repo:acme/infra:ref:refs/heads/main',
      createdBy: owner,
    });
    expect([...(byKey['github-apply']?.scopes ?? [])].sort()).toEqual([
      'configure',
      'runners',
      'secrets',
    ]);
    expect(written).toEqual([
      {
        SPOTLIGHT_URL: expect.any(String),
        SPOTLIGHT_PLAN_TRUST: byKey['github-pull-requests']?.id,
        SPOTLIGHT_APPLY_TRUST: byKey['github-apply']?.id,
      },
    ]);
  });

  it('shows what it set up in the team’s onboarding', async () => {
    protectedBranch = false;
    variables = 'not-permitted';

    await startingAs(owner).expect(201);

    await expect(onboarding(owner)).resolves.toMatchObject({
      viewerIsAdmin: true,
      setupChat: {
        repository: 'acme/infra',
        ci: {
          defaultBranch: 'main',
          defaultBranchProtected: false,
          variables: 'not-permitted',
        },
      },
    });
    await expect(onboarding(member)).resolves.toMatchObject({
      viewerIsAdmin: false,
    });
  });

  it('keeps the same trusts when the setup runs again', async () => {
    await startingAs(owner).expect(201);
    const first = (await trusts()).map((each) => each.id).sort();

    await startingAs(owner).expect(201);

    expect((await trusts()).map((each) => each.id).sort()).toEqual(first);
  });

  it('moves the trusts to another repository when the setup picks it', async () => {
    await startingAs(owner).expect(201);

    await startingAs(owner, 'acme/platform-config').expect(201);

    const [apply] = await db
      .select()
      .from(schema.oidcTrust)
      .where(
        and(
          eq(schema.oidcTrust.workspaceId, workspaceId),
          eq(schema.oidcTrust.key, 'github-apply'),
        ),
      );
    expect(apply?.subject).toBe(
      'repo:acme/platform-config:ref:refs/heads/main',
    );
  });

  it('lets only an owner or admin set up, and creates nothing for anyone else', async () => {
    const refused = await startingAs(member).expect(403);

    expect(JSON.stringify(refused.body)).toContain(
      'Only a workspace owner or admin can set up configuration as code.',
    );
    await expect(trusts()).resolves.toEqual([]);
    expect(written).toEqual([]);
  });
});
