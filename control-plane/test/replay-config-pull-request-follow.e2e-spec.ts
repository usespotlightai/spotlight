import { randomUUID } from 'node:crypto';
import { RepositoryUnreachableError } from '@github/application/errors/repository-unreachable.error';
import { AdvanceSearches } from '@replays/application/services/advance-searches.service';
import {
  CloseStaleConfigPullRequests,
  STALE_COMMENT,
} from '@replays/application/services/close-stale-config-pull-requests.service';
import { OpenConfigPullRequests } from '@replays/application/services/open-config-pull-requests.service';
import { ReconcileConfigPullRequests } from '@replays/application/services/reconcile-config-pull-requests.service';
import { LINE_CHANGED } from '@shared-kernel/application/integration-events/line-changed.integration-event';
import { PULL_REQUEST_CLOSED } from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import { PULL_REQUEST_REOPENED } from '@shared-kernel/application/integration-events/pull-request-reopened.integration-event';
import {
  REPLAY_CANDIDATES,
  type ReplayCandidatesPort,
} from '@work/application/ports/replay-candidates.port';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { autoSearched } from './support/app';
import { dueNow, scheduleOf } from './support/auto-searches';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import {
  anOriginal,
  app,
  BUILD,
  CONFIG,
  CONFIG_FILE,
  CONFIG_LINE,
  createSet,
  DELIVERY,
  db,
  delivered,
  drained,
  endedSearchRun,
  GITHUB_ID_BASE,
  github,
  judged,
  leasedSearchRun,
  openSearchFlow,
  POLISH,
  PROMPT_FILE,
  proposing,
  replayEnded,
  searchedAt,
  searchOf,
  searchRow,
  searchState,
  startSearch,
  team,
  teamNotices,
  WITHIN,
} from './support/search-flow';

openSearchFlow();

const HOUR_MS = 60 * 60_000;

const liveAt = async (stationId = BUILD) => {
  const live = await app
    .get<ReplayCandidatesPort>(REPLAY_CANDIDATES)
    .live(DELIVERY, stationId);

  if (!live) {
    throw new Error(`station ${stationId} is not live`);
  }

  return live;
};

const prompted = async (prompt: string): Promise<string> => {
  await db
    .update(schema.station)
    .set({ agentPrompt: prompt })
    .where(eq(schema.station.id, BUILD));

  return (await liveAt()).fingerprint;
};

const lineChanged = () =>
  delivered({
    kind: LINE_CHANGED,
    lineId: DELIVERY,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    stationIds: [BUILD],
  } as never);

interface OnGitHub {
  readonly at?: Date;
  readonly repository?: string;
  readonly gitHubId?: number | null;
  readonly workspaceId?: string;
}

const onGitHub = (number: number, over: OnGitHub) => {
  const repository = over.repository ?? CONFIG;

  return {
    workspaceId: over.workspaceId ?? team.workspaceId.value,
    pullRequest: `https://github.com/${repository}/pull/${number}`,
    repository,
    gitHubId:
      over.gitHubId === undefined ? GITHUB_ID_BASE + number : over.gitHubId,
  };
};

const closedOnGitHub = (number: number, merged: boolean, over: OnGitHub = {}) =>
  delivered({
    kind: PULL_REQUEST_CLOSED,
    ...onGitHub(number, over),
    closedAt: (over.at ?? new Date()).toISOString(),
    ...(merged
      ? { merged: true, mergeCommit: `merge_${number}` }
      : { merged: false, mergeCommit: null }),
  } as never);

const reopenedOnGitHub = (number: number, over: OnGitHub = {}) =>
  delivered({
    kind: PULL_REQUEST_REOPENED,
    ...onGitHub(number, over),
    reopenedAt: (over.at ?? new Date()).toISOString(),
  } as never);

const anOpenedPullRequest = async (input: {
  readonly number: number;
  readonly basedOn: string;
  readonly proposing: string;
  readonly stationId?: string;
  readonly checkedAt?: Date;
}): Promise<string> => {
  const id = randomUUID();
  const at = new Date();

  await db.insert(schema.configPullRequest).values({
    id,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    searchId: randomUUID(),
    candidateId: randomUUID(),
    lineId: DELIVERY,
    stationId: input.stationId ?? BUILD,
    stationKey: input.stationId === POLISH ? 'polish' : 'build',
    candidateName: `candidate-${input.number}`,
    repository: CONFIG,
    path: CONFIG_FILE,
    branch: `spotlight/search-${input.number}`,
    state: 'opened',
    url: `https://github.com/${CONFIG}/pull/${input.number}`,
    number: input.number,
    gitHubId: GITHUB_ID_BASE + input.number,
    basedOn: input.basedOn,
    proposing: input.proposing,
    checkedAt: input.checkedAt ?? at,
    retries: 0,
    createdAt: at,
    updatedAt: at,
  });

  return id;
};

const pullRequestRow = async (id: string) =>
  (
    await db
      .select()
      .from(schema.configPullRequest)
      .where(eq(schema.configPullRequest.id, id))
  )[0];

const staleAfterChange = async (
  number: number,
  prompt: string,
): Promise<string> => {
  const id = await anOpenedPullRequest({
    number,
    basedOn: (await liveAt()).fingerprint,
    proposing: 'f'.repeat(64),
  });

  await prompted(prompt);
  await lineChanged();

  return id;
};

const closedAfterJob = (id: string, state = 'closed') =>
  eventually(async () => {
    await app.get(CloseStaleConfigPullRequests).processDue();
    return (await pullRequestRow(id))?.state === state;
  }, WITHIN);

const pullRequestsOf = (searchId: string) =>
  db
    .select()
    .from(schema.configPullRequest)
    .where(eq(schema.configPullRequest.searchId, searchId));

const finishedWith = async (
  search: { id: string; seedReplayId: string },
  name: string,
  stationId = BUILD,
): Promise<void> => {
  await drained(() => ({ score: 2, cost: 0.1 }));
  expect(await replayEnded(search.seedReplayId)).toBe('finished');

  const agent = await leasedSearchRun(search.id, 1);
  const { station } = await liveAt(stationId);
  const proposed = (
    await proposing(agent, {
      name,
      hypothesis: 'Draining in order stops the stall.',
      station: { ...station, prompt: 'Build it, draining in order.\n' },
    }).expect(201)
  ).body as { replayId: string };

  await endedSearchRun(agent);
  await drained(() => ({ score: 5, cost: 0.1 }));
  expect(await replayEnded(proposed.replayId)).toBe('finished');
  await eventually(async () => {
    await app.get(AdvanceSearches).processDue();
    return (await searchRow(search.id))?.heldOut.length === 1;
  }, WITHIN);
  await drained(() => ({ score: 5, cost: 0.1 }));
  await eventually(async () => {
    await judged();
    return (await searchState(search.id)) === 'finished';
  }, WITHIN);
};

const seventeenTasks = async (stationId = BUILD) => {
  const tasks = [];

  for (let each = 0; each < 17; each += 1) {
    tasks.push(await anOriginal(stationId));
  }

  return tasks;
};

const resultNoticesOf = async (searchId: string) =>
  (await teamNotices()).filter((each) =>
    each.link.endsWith(`/searches/${searchId}`),
  );

describe('following a config pull request after it opened', () => {
  it('remembers a config a person rejected, restarts the cooldown of the station, and does not propose that config again', async () => {
    await createSet(await seventeenTasks());
    github.files.set(CONFIG_FILE, CONFIG_LINE);
    github.files.set(PROMPT_FILE, 'Build it.');

    const first = await startSearch({
      iterations: 1,
      ceiling: 60,
      objective: 'success',
    });

    await finishedWith(first, 'in-order');

    const [opened] = await eventually(async () => {
      await app.get(OpenConfigPullRequests).processDue();
      const rows = await pullRequestsOf(first.id);

      return rows[0]?.state === 'opened' ? rows : null;
    }, WITHIN);

    expect(opened).toMatchObject({
      repository: CONFIG,
      number: 1,
      gitHubId: GITHUB_ID_BASE + 1,
      basedOn: (await liveAt()).fingerprint,
    });

    await closedOnGitHub(1, false, { workspaceId: randomUUID() });

    expect((await pullRequestRow(opened?.id as string))?.state).toBe('opened');

    await closedOnGitHub(1, false, {
      gitHubId: null,
      repository: CONFIG.toUpperCase(),
    });

    expect(await pullRequestRow(opened?.id as string)).toMatchObject({
      state: 'closed',
      closedBecause: 'by-person',
    });

    const rejecting = await eventually(async () => {
      const schedule = await scheduleOf(searchedAt());

      return schedule?.lastRejectedAt ? schedule : null;
    }, WITHIN);

    expect(rejecting.rejected).toEqual([opened?.proposing]);

    await dueNow(searchedAt(), { lastStartedAt: null });
    await autoSearched(app);

    expect((await scheduleOf(searchedAt()))?.lastSkipReason).toBe('cooldown');

    await db
      .update(schema.stationSearchSchedule)
      .set({ lastRejectedAt: new Date(Date.now() - 2 * HOUR_MS) })
      .where(eq(schema.stationSearchSchedule.stationId, BUILD));

    const second = await startSearch({
      iterations: 1,
      ceiling: 60,
      objective: 'success',
    });

    await finishedWith(second, 'in-order-again');

    expect(
      await eventually(async () => (await searchOf(second.id)).pick, WITHIN),
    ).toEqual({
      outcome: 'declined',
      candidateId: null,
      name: null,
      reason: 'rejected-before',
    });
    expect(await pullRequestsOf(second.id)).toEqual([]);
    expect(github.opened).toHaveLength(1);
    expect(
      await eventually(async () => {
        const found = await resultNoticesOf(second.id);

        return found.length > 0 ? found : null;
      }, WITHIN),
    ).toEqual([
      expect.objectContaining({
        headline: 'The search of the Build station ended with no pull request',
        points: [
          'A person closed a config pull request for each passing candidate while the live config stayed the same.',
        ],
      }),
    ]);

    await reopenedOnGitHub(1);

    expect(await pullRequestRow(opened?.id as string)).toMatchObject({
      state: 'opened',
      closedBecause: null,
    });
    expect(
      await eventually(async () => {
        const schedule = await scheduleOf(searchedAt());

        return schedule?.rejected.length === 0 ? schedule : null;
      }, WITHIN),
    ).toMatchObject({ rejected: [], rejectedAgainst: null });

    await closedOnGitHub(1, false);

    expect(
      await eventually(async () => {
        const schedule = await scheduleOf(searchedAt());

        return schedule?.rejected.length === 1 ? schedule : null;
      }, WITHIN),
    ).toMatchObject({ rejected: [opened?.proposing] });
  }, 300_000);

  it('declines the pick of a search that finishes while a config pull request of its station is open, and still tells the team', async () => {
    await createSet(await seventeenTasks(POLISH), POLISH);

    const search = await startSearch(
      { iterations: 1, ceiling: 60, objective: 'success' },
      POLISH,
    );
    const live = (await liveAt(POLISH)).fingerprint;

    await anOpenedPullRequest({
      number: 31,
      basedOn: live,
      proposing: 'f'.repeat(64),
      stationId: POLISH,
    });
    await finishedWith(search, 'in-order', POLISH);

    expect(
      await eventually(async () => (await searchOf(search.id)).pick, WITHIN),
    ).toMatchObject({ outcome: 'declined', reason: 'pull-request-open' });
    expect(await pullRequestsOf(search.id)).toEqual([]);
    expect(
      await eventually(async () => {
        const found = await resultNoticesOf(search.id);

        return found.length > 0 ? found : null;
      }, WITHIN),
    ).toEqual([
      expect.objectContaining({
        headline: 'The search of the Polish station ended with no pull request',
        points: ['A config pull request for the station is already open.'],
      }),
    ]);
  }, 300_000);

  it('closes a config pull request on GitHub with a comment once the live config of its station changed, keeps it closed as stale, forgets rejected configs, and records a merge that arrives after', async () => {
    const id = await staleAfterChange(21, 'Build it, differently.');
    const notices = await teamNotices();

    expect(await pullRequestRow(id)).toMatchObject({
      state: 'closing',
      closedBecause: 'stale',
    });
    expect(
      await eventually(async () => {
        const schedule = await scheduleOf(searchedAt());

        return schedule?.rejected.length === 0 ? schedule : null;
      }, WITHIN),
    ).toMatchObject({ rejected: [], rejectedAgainst: null });

    await closedAfterJob(id);

    expect(await pullRequestRow(id)).toMatchObject({
      state: 'closed',
      closedBecause: 'stale',
      closeFailureCode: null,
      dueAt: null,
    });
    expect(github.closed.map((each) => each.number)).toEqual([21]);
    expect(github.comments).toEqual([{ number: 21, body: STALE_COMMENT }]);

    await closedOnGitHub(21, false);

    expect(await pullRequestRow(id)).toMatchObject({
      state: 'closed',
      closedBecause: 'stale',
    });
    expect(await teamNotices()).toEqual(notices);

    await closedOnGitHub(21, true);

    expect(await pullRequestRow(id)).toMatchObject({
      state: 'merged',
      closedBecause: null,
    });
  });

  it('records a merge instead of closing when GitHub says the stale pull request merged before the close job ran', async () => {
    const id = await staleAfterChange(24, 'Build it, merged on GitHub.');

    github.statuses.set(24, { state: 'merged', closedAt: new Date() });
    await closedAfterJob(id, 'merged');

    expect(github.closed.map((each) => each.number)).not.toContain(24);
  });

  it('closes a stale pull request with the failure recorded when GitHub refuses the close for good, and when only the comment fails', async () => {
    const refused = await staleAfterChange(25, 'Build it, refused.');

    github.failing = new RepositoryUnreachableError(CONFIG);
    await closedAfterJob(refused);
    github.failing = null;

    expect(await pullRequestRow(refused)).toMatchObject({
      state: 'closed',
      closedBecause: 'stale',
      closeFailureCode: 'repository-unreachable',
    });

    const uncommented = await staleAfterChange(26, 'Build it, uncommented.');

    github.commentFailing = new Error('GitHub is down');
    await closedAfterJob(uncommented);
    github.commentFailing = null;

    expect(await pullRequestRow(uncommented)).toMatchObject({
      state: 'closed',
      closedBecause: 'stale',
      closeFailureCode: null,
    });
    expect(github.closed.map((each) => each.number)).toContain(26);
    expect(github.comments.map((each) => each.number)).not.toContain(26);
  });

  it('reconciles an opened pull request with GitHub once it went six hours without a check, and keeps one open pull request for each station', async () => {
    const id = await anOpenedPullRequest({
      number: 27,
      basedOn: (await liveAt()).fingerprint,
      proposing: 'f'.repeat(64),
      checkedAt: new Date(Date.now() - 7 * HOUR_MS),
    });

    await expect(
      anOpenedPullRequest({
        number: 28,
        basedOn: (await liveAt()).fingerprint,
        proposing: 'f'.repeat(64),
      }),
    ).rejects.toThrow();

    github.statuses.set(27, { state: 'closed', closedAt: new Date() });
    await eventually(async () => {
      await app.get(ReconcileConfigPullRequests).processDue();
      return (await pullRequestRow(id))?.state === 'closed';
    }, WITHIN);

    expect(await pullRequestRow(id)).toMatchObject({
      state: 'closed',
      closedBecause: 'by-person',
    });
  });

  it('never closes a merged config pull request as stale, whether the merge or the change of the live config comes first', async () => {
    const base = await prompted('Build it.');
    const mergedFirst = await prompted('Build it, merged first.');
    await prompted('Build it.');
    const merging = await anOpenedPullRequest({
      number: 22,
      basedOn: base,
      proposing: mergedFirst,
    });

    await closedOnGitHub(22, true);
    await prompted('Build it, merged first.');
    await lineChanged();

    expect(await pullRequestRow(merging)).toMatchObject({ state: 'merged' });

    const changedFirst = await prompted('Build it, changed first.');
    await prompted('Build it, merged first.');
    const changing = await anOpenedPullRequest({
      number: 23,
      basedOn: mergedFirst,
      proposing: changedFirst,
    });

    await prompted('Build it, changed first.');
    await lineChanged();
    await app.get(CloseStaleConfigPullRequests).processDue();

    expect(await pullRequestRow(changing)).toMatchObject({ state: 'opened' });

    const mergedAt = new Date(Date.now() + 1_000);

    await closedOnGitHub(23, true, { at: mergedAt });

    expect(await pullRequestRow(changing)).toMatchObject({
      state: 'merged',
      closedBecause: null,
    });
    expect(
      await eventually(async () => {
        const improved = (await scheduleOf(searchedAt()))?.lastImprovedAt;

        return improved?.getTime() === mergedAt.getTime() ? improved : null;
      }, WITHIN),
    ).toEqual(mergedAt);
    expect(
      github.closed.filter((each) => each.number === 22 || each.number === 23),
    ).toEqual([]);

    await prompted('Build it.');
  });
});
