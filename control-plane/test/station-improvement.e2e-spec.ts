import { randomUUID } from 'node:crypto';
import { PULL_REQUEST_CLOSED } from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { autoSearched, TEST_USER_HEADER } from './support/app';
import { dueNow, policyAt } from './support/auto-searches';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import {
  anOriginal,
  app,
  BUILD,
  CONFIG,
  CONFIG_FILE,
  createSet,
  DELIVERY,
  db,
  delivered,
  fiveTasks,
  http,
  openSearchFlow,
  owner,
  POLISH,
  searchedAt,
  startSearch,
  stationPath,
  team,
  teamPath,
  WITHIN,
} from './support/search-flow';

openSearchFlow();

const TERMS = { iterations: 1, ceiling: 20 };

const URL = `https://github.com/${CONFIG}/pull/41`;

const GITHUB_ID = 4_100_041;

interface Improvement {
  readonly status: string;
  readonly searchId: string | null;
  readonly pullRequestUrl: string | null;
  readonly improvedAt: string | null;
  readonly skip: { readonly reason: string } | null;
  readonly minimumTasks: number;
  readonly setId: string | null;
  readonly lastStartedAt: string | null;
  readonly checkAfter: string | null;
}

const improvementOf = async (stationId = BUILD): Promise<Improvement> =>
  (
    await owner()
      .get(`${stationPath(stationId)}/improvement`)
      .expect(200)
  ).body as Improvement;

const anOpenedPullRequest = async (): Promise<void> => {
  const at = new Date();

  await db.insert(schema.configPullRequest).values({
    id: randomUUID(),
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    searchId: randomUUID(),
    candidateId: randomUUID(),
    lineId: DELIVERY,
    stationId: BUILD,
    stationKey: 'build',
    candidateName: 'candidate-41',
    repository: CONFIG,
    path: CONFIG_FILE,
    branch: 'spotlight/search-41',
    state: 'opened',
    url: URL,
    number: 41,
    gitHubId: GITHUB_ID,
    checkedAt: at,
    basedOn: 'd'.repeat(64),
    proposing: 'e'.repeat(64),
    retries: 0,
    createdAt: at,
    updatedAt: at,
  });
};

const switchedOff = async (stationId: typeof POLISH): Promise<void> => {
  await policyAt(searchedAt(stationId), TERMS);

  const [station] = await db
    .select({ search: schema.station.search })
    .from(schema.station)
    .where(eq(schema.station.id, stationId));

  await db
    .update(schema.station)
    .set({
      search: station?.search ? { ...station.search, enabled: false } : null,
    })
    .where(eq(schema.station.id, stationId));
};

describe('the improvement status of a station', () => {
  it('is off while the search policy of the station is off', async () => {
    await switchedOff(POLISH);

    expect(await improvementOf(POLISH)).toMatchObject({
      status: 'off',
      setId: null,
      checkAfter: null,
      minimumTasks: 5,
    });
  });

  it('has not started at a station without a kept replay set', async () => {
    await policyAt(searchedAt(POLISH), TERMS);

    expect(await improvementOf(POLISH)).toMatchObject({
      status: 'not-started',
      setId: null,
    });
  });

  it('waits while the kept set is too small, and is not improving until a person adds a judge or a check', async () => {
    const few = [await anOriginal(), await anOriginal(), await anOriginal()];
    const setId = await createSet(few);

    await policyAt(searchedAt(), TERMS);
    await dueNow(searchedAt());
    await autoSearched(app);

    const waiting = await improvementOf();

    expect(waiting).toMatchObject({
      status: 'waiting',
      skip: null,
      setId,
      lastStartedAt: null,
    });
    expect(Date.parse(waiting.checkAfter as string)).toBeGreaterThan(
      Date.now(),
    );

    const [build] = await db
      .select({ judge: schema.station.judge })
      .from(schema.station)
      .where(eq(schema.station.id, BUILD));

    await db
      .update(schema.station)
      .set({ judge: null })
      .where(eq(schema.station.id, BUILD));
    await dueNow(searchedAt());
    await autoSearched(app);

    expect(await improvementOf()).toMatchObject({
      status: 'not-improving',
      skip: { reason: 'no-scoring' },
      pullRequestFailure: null,
      minimumTasks: 5,
      setId,
    });

    await db
      .update(schema.station)
      .set({ judge: build?.judge ?? null })
      .where(eq(schema.station.id, BUILD));
  }, 120_000);

  it('names the search that runs, then waits for the next check once it stops', async () => {
    await createSet(fiveTasks);

    const search = await startSearch(TERMS);

    expect(await improvementOf()).toMatchObject({
      status: 'searching',
      searchId: search.id,
    });

    await owner().post(`${teamPath()}/searches/${search.id}/stop`).expect(204);

    const waiting = await improvementOf();

    expect(waiting).toMatchObject({
      status: 'waiting',
      searchId: null,
      skip: null,
    });
    expect(waiting.lastStartedAt).not.toBeNull();
    expect(waiting.checkAfter).not.toBeNull();
  }, 120_000);

  it('links the open config pull request, then the merged one that improved the station', async () => {
    await anOpenedPullRequest();

    expect(await improvementOf()).toMatchObject({
      status: 'pull-request-open',
      pullRequestUrl: URL,
    });

    const mergedAt = new Date(Date.now() + 1_000);

    await delivered({
      kind: PULL_REQUEST_CLOSED,
      workspaceId: team.workspaceId.value,
      pullRequest: URL,
      repository: CONFIG,
      gitHubId: GITHUB_ID,
      closedAt: mergedAt.toISOString(),
      merged: true,
      mergeCommit: 'merge_41',
    } as never);

    expect(
      await eventually(async () => {
        const read = await improvementOf();

        return read.status === 'improved' ? read : null;
      }, WITHIN),
    ).toMatchObject({
      status: 'improved',
      pullRequestUrl: URL,
      improvedAt: mergedAt.toISOString(),
    });
  }, 120_000);

  it('is not found for someone outside the team', async () => {
    const stranger = randomUUID();

    await db.insert(schema.user).values({
      id: stranger,
      name: 'Eve',
      email: `${stranger}@example.com`,
    });

    await http()
      .get(`${stationPath()}/improvement`)
      .set(TEST_USER_HEADER, stranger)
      .expect(404);
  });

  it('is not found for a station of another line', async () => {
    await owner()
      .get(`${teamPath()}/lines/${randomUUID()}/stations/${BUILD}/improvement`)
      .expect(404);
  });
});
