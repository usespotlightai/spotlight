import { randomUUID } from 'node:crypto';

import type { InsightsFlowResponseDto } from '@insights/presentation/http/dto/insights-flow.response.dto';
import type { InsightsOverviewResponseDto } from '@insights/presentation/http/dto/insights-overview.response.dto';
import type { InsightsPullRequestsResponseDto } from '@insights/presentation/http/dto/insights-pull-requests.response.dto';
import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './support/app';
import * as schema from './support/schema';
import { createTeam } from './support/team';

const HOUR = 60 * 60 * 1000;
const NOW = Date.now();
const ago = (hours: number) => new Date(NOW - hours * HOUR);

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;
let elsewhereTask: string;
let movedInTask: string;
let earlierTask: string;

const ranOnTheTeam = async (taskId: string): Promise<void> => {
  const run = {
    runId: `run_${randomUUID()}`,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    lineId: team.line.id.value,
    stationId: team.stationId.value,
    taskId,
    harness: 'claude-code',
    repositories: ['acme/api'],
    skills: [] as string[],
    queuedAt: ago(6),
    startedAt: ago(6),
    endedAt: ago(5),
    ending: 'completed' as const,
    runNumber: 1,
  };

  await db.insert(schema.runRecord).values(run);
  await db.insert(schema.runFact).values({
    ...run,
    beganAt: ago(6),
    endedAs: 'completed',
    resolution: 'other',
    ran: true,
    ranAConfig: false,
    asked: false,
    usageRecorded: false,
    dismissals: [],
    memories: { briefed: [], recalled: [] },
  });
};

const insights = (tab: string) =>
  served(app)
    .get(`/api/teams/${team.teamId.value}/insights/${tab}?period=7d`)
    .set(TEST_USER_HEADER, team.owner.value);

const ownedPullRequest = async (
  taskId: string,
  number: number,
  state: 'open' | 'merged' | 'closed',
  owner: { teamId?: string; openedAt?: Date; closedAt?: Date } = {},
): Promise<void> => {
  const pullRequest = `https://github.com/acme/api/pull/${number}`;
  const closedAt = state === 'open' ? null : (owner.closedAt ?? ago(2));
  const openedAt = owner.openedAt ?? ago(30);

  await db.insert(schema.pullRequestRecord).values({
    workspaceId: team.workspaceId.value,
    pullRequest,
    repository: 'acme/api',
    number,
    title: `Pull request ${number}`,
    author: 'spotlight-bot',
    openedAt,
    updatedAt: closedAt ?? ago(1),
    state,
    closedAt,
    seenVersion: 1,
    ownerTaskId: taskId,
    ownerTeamId: owner.teamId ?? team.teamId.value,
    ownerOpenedAt: openedAt,
  });
  await db.insert(schema.pullRequestFact).values({
    workspaceId: team.workspaceId.value,
    pullRequest,
    type: 'feature',
    madeBy: 'spotlight',
    rounds: '0',
    mergedAt: state === 'merged' ? closedAt : null,
  });
};

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  team = await createTeam(
    db,
    app.get(DrizzleTaskRepository),
    `pull-request-counts-${randomUUID().slice(0, 8)}`,
  );

  const split = randomUUID();
  const whole = randomUUID();

  elsewhereTask = randomUUID();
  movedInTask = randomUUID();
  earlierTask = randomUUID();

  await ownedPullRequest(split, 1, 'merged');
  await ownedPullRequest(split, 2, 'closed');
  await ownedPullRequest(whole, 3, 'merged');
  await ownedPullRequest(whole, 4, 'open');
  await ownedPullRequest(elsewhereTask, 5, 'merged', { teamId: 'team_other' });
  await ownedPullRequest(movedInTask, 6, 'merged', { teamId: 'team_other' });
  await ranOnTheTeam(movedInTask);
  await ownedPullRequest(earlierTask, 7, 'merged', {
    openedAt: ago(24 * 12),
    closedAt: ago(24 * 10),
  });
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe('pull requests merged, across the Insights tabs (e2e)', () => {
  it('counts each pull request on its own on Overview, Flow and Pull requests', async () => {
    const [overview, flow, pullRequests] = await Promise.all([
      insights('overview'),
      insights('flow'),
      insights('pull-requests'),
    ]);

    expect(overview.status).toBe(200);
    expect(flow.status).toBe(200);
    expect(pullRequests.status).toBe(200);
    const { headline } = overview.body as InsightsOverviewResponseDto;
    const { delivery } = (flow.body as InsightsFlowResponseDto).flow;
    const { comparison, spotlightShare } =
      pullRequests.body as InsightsPullRequestsResponseDto;

    expect(headline).toMatchObject({
      mergedPullRequests: 3,
      closedPullRequests: 1,
    });
    expect(delivery).toMatchObject({ merged: 3, opened: 5 });
    expect(comparison.spotlight.merged).toBe(3);
    expect(spotlightShare.authored).toBe(3);
  });

  it('leaves out another team’s pull request, but keeps one whose task the team ran', async () => {
    const overview = await insights('overview');
    const { headline } = overview.body as InsightsOverviewResponseDto;

    expect(headline.mergedTaskIds).toHaveLength(3);
    expect(headline.mergedTaskIds).not.toContain(elsewhereTask);
    expect(headline.mergedTaskIds).toContain(movedInTask);
  });

  it('counts a pull request merged in the period before only in the change', async () => {
    const overview = await insights('overview');
    const { headline, changes } = overview.body as InsightsOverviewResponseDto;

    expect(headline.mergedTaskIds).not.toContain(earlierTask);
    expect(changes.mergedPullRequests).toMatchObject({
      unit: 'percent',
      by: 2,
    });
  });
});
