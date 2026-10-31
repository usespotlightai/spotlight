import { randomInt, randomUUID } from 'node:crypto';
import {
  GITHUB_WEBHOOKS,
  type GitHubWebhooksPort,
} from '@github/application/ports/github-webhooks.port';
import { DrizzlePullRequests } from '@github/infrastructure/persistence/drizzle/repositories/pull-request.repository';
import { WorkspaceDeleted } from '@identity/domain/events/workspace-deleted.event';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { DrizzleDeletions } from '@insights/infrastructure/persistence/drizzle/ledgers/deletions.ledger';
import { DrizzlePullRequestRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/pull-request-record.repository';
import type { INestApplication } from '@nestjs/common';
import { EventDelivery } from '@platform/events/event-delivery';
import { EventOutbox } from '@platform/events/event-outbox';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { changed } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import { createTeam } from './support/team';

const TOKEN_HEADER = 'spotlight-workspace-token';
const HOUR = 60 * 60 * 1000;
const NOW = Date.now();

const ago = (hours: number) => new Date(NOW - hours * HOUR).toISOString();

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;
let elsewhere: Awaited<ReturnType<typeof createTeam>>;
let deleting: Awaited<ReturnType<typeof createTeam>>;
let repository: string;
const TASK = TaskId.of(randomUUID());
const INSTALLATION = randomInt(1_000_000, 3_000_000);
const ELSEWHERE_INSTALLATION = randomInt(3_000_000, 5_000_000);
const DELETING_INSTALLATION = randomInt(5_000_000, 7_000_000);
const UNCONNECTED_INSTALLATION = randomInt(7_000_000, 9_000_000);

const urlOf = (number: number) =>
  `https://github.com/${repository}/pull/${number}`;

const pullRequest = (
  number: number,
  over: Record<string, unknown> = {},
): Record<string, unknown> => ({
  number,
  html_url: urlOf(number),
  title: `Change ${number}`,
  body: null,
  state: 'open',
  merged: false,
  user: { login: 'ada', type: 'User' },
  head: { ref: `change-${number}` },
  created_at: ago(30),
  additions: 10,
  deletions: 2,
  changed_files: 1,
  ...over,
});

const merged = (number: number, over: Record<string, unknown> = {}) =>
  pullRequest(number, {
    state: 'closed',
    merged: true,
    merged_at: ago(2),
    closed_at: ago(2),
    merge_commit_sha: 'c'.repeat(40),
    ...over,
  });

const deliverThrough = (
  installation: number,
  event: string,
  body: Record<string, unknown>,
) =>
  app.get<GitHubWebhooksPort>(GITHUB_WEBHOOKS).receive({
    headers: { 'x-github-event': event },
    body: {
      installation: { id: installation },
      repository: { full_name: repository },
      ...body,
    },
    raw: null,
  });

const deliver = (event: string, body: Record<string, unknown>) =>
  deliverThrough(INSTALLATION, event, body);

const drained = <T>(check: () => Promise<T | null | undefined | false>) =>
  eventually(async () => {
    await app.get(EventDelivery).drain(2_000);
    return check();
  }, 60_000);

const recordOf = (
  number: number,
  workspaceId: WorkspaceId = team.workspaceId,
) =>
  app
    .get(DrizzlePullRequestRecordRepository)
    .at(workspaceId, PullRequestUrl.of(urlOf(number)));

const pullRequestOf = (
  number: number,
  workspaceId: WorkspaceId = team.workspaceId,
) =>
  app
    .get(DrizzlePullRequests)
    .at(workspaceId, PullRequestUrl.of(urlOf(number)));

const insights = (path: string, query = 'period=7d') =>
  `/api/teams/${team.teamId.value}/insights/${path}?${query}`;

const asOwner = (path: string) =>
  served(app).get(path).set(TEST_USER_HEADER, team.owner.value);

const issued = async (
  of: Awaited<ReturnType<typeof createTeam>>,
  scopes: readonly string[],
): Promise<string> => {
  const answer = await served(app)
    .post(`/api/v1/resources/workspaces/${of.workspaceId.value}/tokens`)
    .set(TEST_USER_HEADER, of.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({ name: `pulls-${randomUUID().slice(0, 6)}`, scopes });

  expect(answer.status).toBe(201);

  return answer.headers[TOKEN_HEADER] as string;
};

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  const tasks = app.get(DrizzleTaskRepository);
  team = await createTeam(db, tasks, `pulls-${randomUUID().slice(0, 8)}`);
  elsewhere = await createTeam(db, tasks, `other-${randomUUID().slice(0, 8)}`);
  deleting = await createTeam(
    db,
    tasks,
    `deleting-${randomUUID().slice(0, 8)}`,
  );
  repository = `acme/api-${randomUUID().slice(0, 8)}`;

  await db
    .insert(schema.lineRepository)
    .values({ lineId: team.line.id.value, repository });
  await db.insert(schema.githubConnection).values([
    {
      workspaceId: team.workspaceId.value,
      installationId: String(INSTALLATION),
      version: 1,
    },
    {
      workspaceId: elsewhere.workspaceId.value,
      installationId: String(ELSEWHERE_INSTALLATION),
      version: 1,
    },
    {
      workspaceId: deleting.workspaceId.value,
      installationId: String(DELETING_INSTALLATION),
      version: 1,
    },
  ]);

  await app
    .get(EventOutbox)
    .record([
      new PullRequestOpened(
        TASK,
        team.workspaceId,
        team.teamId,
        PullRequestUrl.of(urlOf(1)),
        new Date(NOW - 30 * HOUR),
      ),
    ]);
  await deliver('pull_request', {
    action: 'opened',
    pull_request: pullRequest(1),
  });
  await deliver('pull_request', {
    action: 'opened',
    pull_request: pullRequest(2),
  });
  await deliver('pull_request_review', {
    action: 'submitted',
    pull_request: pullRequest(2),
    review: {
      id: randomInt(1, 1_000_000),
      state: 'changes_requested',
      user: { login: 'bob', type: 'User' },
      submitted_at: ago(20),
    },
  });
  await deliver('pull_request_review_comment', {
    action: 'created',
    pull_request: pullRequest(2),
    comment: {
      id: randomInt(1, 1_000_000),
      html_url: `${urlOf(2)}#discussion_r1`,
      path: 'src/a.ts',
      body: 'Why?',
      user: { login: 'bob', type: 'User' },
      created_at: ago(20),
    },
  });
  await deliver('pull_request', { action: 'closed', pull_request: merged(1) });
  await deliver('pull_request', {
    action: 'closed',
    pull_request: merged(2, { merged_at: ago(10), closed_at: ago(10) }),
  });
  await deliver('pull_request', {
    action: 'closed',
    pull_request: merged(3, {
      title: 'Revert "Change 2"',
      body: `Reverts ${repository}#2`,
    }),
  });

  await drained(async () => {
    const [mine, theirs, revert] = await Promise.all([
      recordOf(1),
      recordOf(2),
      recordOf(3),
    ]);

    return (
      mine?.owner &&
      mine.seen?.state === 'merged' &&
      theirs?.seen?.revertedBy &&
      theirs.seen.reviewComments === 1 &&
      revert?.seen
    );
  });
}, 180_000);

afterAll(async () => {
  await app?.close();
});

describe('every pull request in an installed repository (e2e)', () => {
  it('records a pull request a task opened and one nobody’s task did, in the GitHub context', async () => {
    const pulls = app.get(DrizzlePullRequests);

    const mine = await pulls.at(team.workspaceId, PullRequestUrl.of(urlOf(1)));
    const theirs = await pulls.at(
      team.workspaceId,
      PullRequestUrl.of(urlOf(2)),
    );

    expect(mine?.state).toBe('merged');
    expect(theirs).toMatchObject({ state: 'merged', reviewRounds: 1 });
    expect(theirs?.size).toEqual({
      additions: 10,
      deletions: 2,
      changedFiles: 1,
    });
    expect(theirs?.revertedBy?.value).toBe(urlOf(3));
  });

  it('stores what Insights needs of each in the insights context, Spotlight’s apart from people’s', async () => {
    const mine = await recordOf(1);
    const theirs = await recordOf(2);
    const revert = await recordOf(3);

    expect(mine?.owner?.taskId.equals(TASK)).toBe(true);
    expect(theirs?.owner).toBeNull();
    expect(theirs?.seen).toMatchObject({
      reviewRounds: 1,
      reviewComments: 1,
      revertedBy: urlOf(3),
    });
    expect(revert?.seen?.isRevert).toBe(true);
  });
});

describe('the team’s pull request insights (e2e)', () => {
  it('shows a team member how much of what merged Spotlight made', async () => {
    const answer = await asOwner(insights('pull-requests'));

    expect(answer.status).toBe(200);
    expect(answer.body.repositories).toEqual([repository]);
    expect(answer.body.spotlightShare).toMatchObject({
      merged: 3,
      authored: 1,
      reviewed: 0,
    });
    expect(answer.body.spotlightShare.repositories[0]).toMatchObject({
      repository,
      merged: 3,
      authored: 1,
    });
    expect(answer.body.comparison).toMatchObject({
      repositories: [repository],
      spotlight: { merged: 1, reverted: 0 },
      people: { merged: 2, reverted: 1, revertRate: 0.5, meanRounds: 0.5 },
    });
    expect(answer.body.total).toBe(3);
    expect(answer.body.types).toHaveLength(6);
    expect(answer.body.depth).toHaveLength(4);
  });

  it('shows on the Shipping tab how fast and how deep what merged went, Spotlight’s apart from people’s', async () => {
    const answer = await asOwner(insights('shipping'));

    expect(answer.status).toBe(200);
    expect(answer.body.toMerge).toMatchObject({
      spotlight: { count: 1 },
      people: { count: 2 },
    });
    expect(answer.body.mergeDays).toHaveLength(7);
    expect(
      answer.body.depthTotals.reduce(
        (sum: number, each: { merged: number }) => sum + each.merged,
        0,
      ),
    ).toBe(3);
  });

  it('lists the pull requests behind a number, with the task that made Spotlight’s', async () => {
    const answer = await asOwner(
      insights('pull-requests/list', 'period=7d&author=spotlight&state=merged'),
    );

    expect(answer.status).toBe(200);
    expect(answer.body.total).toBe(1);
    expect(answer.body.pullRequests[0]).toMatchObject({
      pullRequest: urlOf(1),
      by: 'spotlight',
      taskId: TASK.value,
      state: 'merged',
    });

    const reverted = await asOwner(
      insights('pull-requests/list', 'period=7d&reverted=true'),
    );
    expect(
      reverted.body.pullRequests.map(
        (each: { pullRequest: string }) => each.pullRequest,
      ),
    ).toEqual([urlOf(2)]);
  });

  it('answers a workspace token with the read scope', async () => {
    const token = await issued(team, ['read']);

    const answer = await served(app)
      .get(insights('pull-requests'))
      .set('Authorization', `Bearer ${token}`);

    expect(answer.status).toBe(200);
    expect(answer.body.spotlightShare.merged).toBe(3);
  });

  it('finds no team for a token of another workspace', async () => {
    const token = await issued(elsewhere, ['read']);

    const answer = await served(app)
      .get(insights('pull-requests/list'))
      .set('Authorization', `Bearer ${token}`);

    expect(answer.status).toBe(404);
  });

  it('rejects a filter it does not take', async () => {
    const answer = await asOwner(
      insights('pull-requests/list', 'period=7d&author=robots'),
    );

    expect(answer.status).toBe(422);
  });
});

describe('what GitHub said, stored in order and purged in time (e2e)', () => {
  it('records nothing of a delivery through an installation that no workspace connected', async () => {
    await deliverThrough(UNCONNECTED_INSTALLATION, 'pull_request', {
      action: 'opened',
      pull_request: pullRequest(90),
    });

    expect(
      await db
        .select()
        .from(schema.githubPullRequest)
        .where(eq(schema.githubPullRequest.url, urlOf(90))),
    ).toEqual([]);
  });

  it('stores the newer of what GitHub said, however late the older arrives', async () => {
    await deliver('pull_request', {
      action: 'edited',
      pull_request: pullRequest(91, { title: 'Newer', updated_at: ago(1) }),
    });
    await deliver('pull_request', {
      action: 'edited',
      pull_request: pullRequest(91, { title: 'Older', updated_at: ago(3) }),
    });

    expect((await pullRequestOf(91))?.title).toBe('Newer');
  });

  it('leaves a dismissed review out of the rounds', async () => {
    const review = randomInt(1, 1_000_000);
    await deliver('pull_request_review', {
      action: 'submitted',
      pull_request: pullRequest(92),
      review: {
        id: review,
        state: 'changes_requested',
        user: { login: 'bob', type: 'User' },
        submitted_at: ago(4),
      },
    });
    await deliver('pull_request_review', {
      action: 'dismissed',
      pull_request: pullRequest(92),
      review: { id: review, state: 'dismissed', user: { login: 'bob' } },
    });

    expect(await pullRequestOf(92)).toMatchObject({
      reviewRounds: 0,
      firstReviewAt: null,
    });
  });

  it('does not count a deleted review comment again when its creation is delivered twice', async () => {
    const comment = {
      id: randomInt(1, 1_000_000),
      html_url: `${urlOf(93)}#discussion_r2`,
      path: 'src/a.ts',
      body: 'Why?',
      user: { login: 'bob', type: 'User' },
      created_at: ago(4),
    };

    for (const action of ['created', 'deleted', 'created']) {
      await deliver('pull_request_review_comment', {
        action,
        pull_request: pullRequest(93),
        comment,
      });
    }

    expect((await pullRequestOf(93))?.comments).toEqual([]);
  });

  it('rejects a filter that takes one value requested twice, and takes repositories repeated', async () => {
    const twice = await asOwner(
      insights(
        'pull-requests/list',
        'period=7d&author=spotlight&author=people',
      ),
    );
    const repeated = await asOwner(
      insights(
        'pull-requests/list',
        `period=7d&repository=${repository}&repository=acme/elsewhere`,
      ),
    );

    expect(twice.status).toBe(422);
    expect(repeated.status).toBe(200);
  });

  it('purges the pull requests of a workspace whose GitHub App was uninstalled, in both contexts', async () => {
    await deliverThrough(ELSEWHERE_INSTALLATION, 'pull_request', {
      action: 'opened',
      pull_request: pullRequest(94),
    });
    await drained(() => recordOf(94, elsewhere.workspaceId));

    await deliverThrough(ELSEWHERE_INSTALLATION, 'installation', {
      action: 'deleted',
    });

    await drained(
      async () =>
        (await pullRequestOf(94, elsewhere.workspaceId)) === null &&
        (await recordOf(94, elsewhere.workspaceId)) === null,
    );
    expect(
      await app
        .get(DrizzleDeletions)
        .tombstoneOf(elsewhere.workspaceId, PullRequestUrl.of(urlOf(94))),
    ).not.toBeNull();
  });

  it('records nothing received late through an installation its workspace removed', async () => {
    await deliverThrough(ELSEWHERE_INSTALLATION, 'pull_request', {
      action: 'edited',
      pull_request: pullRequest(94, { updated_at: ago(0) }),
    });

    expect(await pullRequestOf(94, elsewhere.workspaceId)).toBeNull();
  });

  it('purges the tombstones of deleted pull requests stored longer than retention and its slack', async () => {
    const deletions = app.get(DrizzleDeletions);
    const old = PullRequestUrl.of(urlOf(96));
    const recent = PullRequestUrl.of(urlOf(97));
    await deletions.deletePullRequest(elsewhere.workspaceId, old, {
      updatedAt: new Date(NOW - 400 * 24 * HOUR),
    });
    await deletions.deletePullRequest(elsewhere.workspaceId, recent, {
      updatedAt: new Date(NOW - 24 * HOUR),
    });

    await deletions.purgeTombstonesBefore(
      new Date(NOW - 210 * 24 * HOUR),
      1_000,
    );

    expect(await deletions.tombstoneOf(elsewhere.workspaceId, old)).toBeNull();
    expect(await deletions.tombstoneOf(elsewhere.workspaceId, recent)).toEqual({
      updatedAt: new Date(NOW - 24 * HOUR),
    });
  });

  it('purges the pull requests of a deleted workspace', async () => {
    await deliverThrough(DELETING_INSTALLATION, 'pull_request', {
      action: 'opened',
      pull_request: pullRequest(95),
    });
    expect(await pullRequestOf(95, deleting.workspaceId)).not.toBeNull();

    await app
      .get(EventOutbox)
      .record([
        new WorkspaceDeleted(
          deleting.workspaceId,
          WorkspaceSlug.of(deleting.slug),
          changed('workspace', deleting.workspaceId.value, deleting.slug),
        ),
      ]);

    await drained(
      async () => (await pullRequestOf(95, deleting.workspaceId)) === null,
    );

    const [connection] = await db
      .select()
      .from(schema.githubConnection)
      .where(
        eq(schema.githubConnection.workspaceId, deleting.workspaceId.value),
      );
    expect(connection).toBeUndefined();

    await deliverThrough(DELETING_INSTALLATION, 'pull_request', {
      action: 'edited',
      pull_request: pullRequest(95, { updated_at: ago(0) }),
    });
    expect(await pullRequestOf(95, deleting.workspaceId)).toBeNull();
  });
});
