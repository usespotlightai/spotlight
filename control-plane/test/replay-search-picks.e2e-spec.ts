import { AdvanceSearches } from '@replays/application/services/advance-searches.service';
import { OpenConfigPullRequests } from '@replays/application/services/open-config-pull-requests.service';
import { ConfigPullRequestFailed } from '@replays/domain/events/config-pull-request-failed.event';
import { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { PULL_REQUEST_CLOSED } from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { autoSearched } from './support/app';
import { activeSearchAt, dueNow, scheduleOf } from './support/auto-searches';
import { eventually } from './support/eventually';
import { startedReplay } from './support/replays';
import * as schema from './support/schema';
import {
  anOriginal,
  app,
  auditOf,
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
  liveBlock,
  openSearchFlow,
  PROMPT_FILE,
  proposing,
  replayEnded,
  replayRow,
  type SearchRead,
  searchedAt,
  searchOf,
  searchRow,
  searchState,
  startSearch,
  team,
  teamNotices,
  tenTasks,
  WITHIN,
} from './support/search-flow';

openSearchFlow();

describe('a search for a better station config, ranking and picking its candidates', () => {
  it('looks for the same success at less cost on a set its live config saturates, ranks the cheapest candidate that succeeds as often first, leaves out a cheaper one that succeeds less, and picks the cheapest', async () => {
    const setId = await createSet(tenTasks);
    const live = await startedReplay(app, setId, {
      candidate: 'live',
      amount: 20,
    });

    await eventually(async () => {
      await drained(() => ({ score: 5, cost: 0.2 }));
      return (await replayRow(live.id))?.state === 'finished';
    }, WITHIN);
    expect(await replayEnded(live.id)).toBe('finished');

    const started = await startSearch({ iterations: 2, ceiling: 60 });
    expect((await searchRow(started.id))?.objective).toBe('cost');

    await drained(() => ({ score: 5, cost: 0.2 }));
    expect(await replayEnded(started.seedReplayId)).toBe('finished');

    const agent = await leasedSearchRun(started.id, 1);
    const block = await liveBlock();
    const proposed = async (name: string, prompt: string) =>
      (
        await proposing(agent, {
          name,
          hypothesis: `${name} keeps the queue drained for less.`,
          station: { ...block, prompt },
        }).expect(201)
      ).body as { replayId: string };
    const cheap = await proposed('cheap', 'Build it, briefly.');
    const dear = await proposed('dear', 'Build it, at length.');

    await endedSearchRun(agent);
    await drained((replayId) =>
      replayId === cheap.replayId
        ? { score: 5, cost: 0.05 }
        : { score: 5, cost: 0.5 },
    );

    const next = await leasedSearchRun(started.id, 2);
    const careless = (
      await proposing(next, {
        name: 'careless',
        hypothesis: 'careless keeps the queue drained for less.',
        station: { ...block, prompt: 'Build it, carelessly.' },
      }).expect(201)
    ).body as { replayId: string };
    const plan = (replayId: string) =>
      replayId === cheap.replayId
        ? { score: 5, cost: 0.05 }
        : replayId === dear.replayId
          ? { score: 5, cost: 0.5 }
          : replayId === careless.replayId
            ? { score: 1, cost: 0.01 }
            : { score: 5, cost: 0.05 };

    await endedSearchRun(next);
    await drained(plan);
    await eventually(async () => {
      await app.get(AdvanceSearches).processDue();
      return (await searchRow(started.id))?.heldOut.length === 1;
    }, WITHIN);
    await drained(plan);
    await eventually(async () => {
      await judged();
      return (await searchState(started.id)) === 'finished';
    }, WITHIN);

    const done = (await searchOf(started.id)) as SearchRead & {
      objective: string;
    };

    expect(done.objective).toBe('cost');
    expect(done.best?.name).toBe('cheap');
    expect(done.candidates.map((each) => [each.name, each.onFrontier])).toEqual(
      [
        ['cheap', true],
        ['dear', false],
        ['careless', false],
      ],
    );
    expect(
      done.candidates.map((each) => [each.name, each.heldOutReplayId !== null]),
    ).toEqual([
      ['cheap', true],
      ['dear', false],
      ['careless', false],
    ]);
    expect(done.frontier).toEqual([
      done.candidates[0]?.candidateId,
      done.seed.candidateId,
    ]);
    expect(
      await eventually(async () => (await searchOf(started.id)).pick, WITHIN),
    ).toMatchObject({ outcome: 'picked', name: 'cheap' });
    expect(
      await eventually(async () => {
        await app.get(OpenConfigPullRequests).processDue();
        const [row] = await db
          .select()
          .from(schema.configPullRequest)
          .where(eq(schema.configPullRequest.searchId, started.id));

        return row?.state === 'failed' ? row : null;
      }, WITHIN),
    ).toMatchObject({ errorCode: 'file-missing' });
  }, 120_000);

  it('opens one config pull request for a candidate that passes every gate, tells the team, waits to search the station again while it is open, and searches again once it merged', async () => {
    const tasks = [];
    for (let each = 0; each < 17; each += 1) {
      tasks.push(await anOriginal());
    }
    await createSet(tasks);
    github.files.set(CONFIG_FILE, CONFIG_LINE);
    github.files.set(PROMPT_FILE, 'Build it.');
    const noticedBefore = (await teamNotices()).map((each) => each.id);
    const ownNotices = async () =>
      (await teamNotices()).filter((each) => !noticedBefore.includes(each.id));

    const { id, seedReplayId } = await startSearch({
      iterations: 1,
      ceiling: 60,
      objective: 'success',
    });

    await drained(() => ({ score: 2, cost: 0.1 }));
    expect(await replayEnded(seedReplayId)).toBe('finished');

    const agent = await leasedSearchRun(id, 1);
    const block = await liveBlock();
    const proposed = (
      await proposing(agent, {
        name: 'in-order',
        hypothesis: 'Draining in order stops the stall.',
        station: { ...block, prompt: 'Build it, draining in order.\n' },
      }).expect(201)
    ).body as { candidateId: string; replayId: string };

    await endedSearchRun(agent);
    await drained(() => ({ score: 5, cost: 0.1 }));
    expect(await replayEnded(proposed.replayId)).toBe('finished');
    await eventually(async () => {
      await app.get(AdvanceSearches).processDue();
      return (await searchRow(id))?.heldOut.length === 1;
    }, WITHIN);
    await drained(() => ({ score: 5, cost: 0.1 }));
    await eventually(async () => {
      await judged();
      return (await searchState(id)) === 'finished';
    }, WITHIN);

    const opened = await eventually(async () => {
      await app.get(OpenConfigPullRequests).processDue();
      const rows = await db
        .select()
        .from(schema.configPullRequest)
        .where(eq(schema.configPullRequest.searchId, id));

      return rows[0]?.state === 'opened' ? rows : null;
    }, WITHIN);

    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({
      candidateId: proposed.candidateId,
      repository: CONFIG,
      path: CONFIG_FILE,
      branch: `spotlight/search-${id.slice(0, 8)}-in-order`,
      url: `https://github.com/${CONFIG}/pull/1`,
    });
    expect((await searchOf(id)).pick).toEqual({
      outcome: 'picked',
      candidateId: proposed.candidateId,
      name: 'in-order',
      reason: null,
    });
    expect(github.opened).toHaveLength(1);
    expect(github.opened[0]).toMatchObject({
      branch: `spotlight/search-${id.slice(0, 8)}-in-order`,
      title: 'build: in-order',
    });
    const body = github.opened[0]?.body ?? '';
    const rows = body
      .slice(
        body.indexOf('## Task by task'),
        body.indexOf('## About this search'),
      )
      .split('\n')
      .filter((line) => line.startsWith('| ') && !line.startsWith('| Task |'));

    expect(body).toContain('Draining in order stops the stall.');
    expect(body).toContain('## What changes');
    expect(body).toContain('## Task by task');
    expect(body).toContain('### Held-out tasks');
    expect(body).toContain('### Searched tasks');
    expect(body).toContain('## About this search');
    expect(rows.length).toBeGreaterThan(0);
    for (const line of rows.filter((each) => !each.startsWith('| ---'))) {
      const [, live, candidate] = line.split(' | ');

      expect(live).toMatch(
        /^(Succeeded|Failed|Not scored|Running|Not replayed)[^:]*: \S/,
      );
      expect(candidate).toMatch(
        /^(Succeeded|Failed|Not scored|Running|Not replayed)[^:]*: \S/,
      );
    }
    expect(body).not.toMatch(/https?:\/\/(?!github\.com\/)/);
    expect(body).not.toContain(team.slug);
    expect(github.commits).toHaveLength(1);
    expect(github.commits[0]?.files).toEqual([
      {
        path: CONFIG_FILE,
        content: CONFIG_LINE.replace(
          'prompts/build.md',
          `prompts/${team.slug}/delivery/build.md`,
        ),
      },
      {
        path: `teams/core/prompts/${team.slug}/delivery/build.md`,
        content: 'Build it, draining in order.\n',
      },
    ]);
    expect(
      (await auditOf(opened[0]?.id as string)).map((each) => [
        each.resource,
        each.action,
        each.actor,
      ]),
    ).toEqual([['config-pull-request', 'created', 'spotlight']]);

    const notices = await eventually(async () => {
      const found = await ownNotices();

      return found.length > 0 ? found : null;
    }, WITHIN);

    expect(notices).toEqual([
      expect.objectContaining({
        form: 'ended',
        headline:
          'Spotlight opened a config pull request for the Build station',
        points: [
          'Candidate in-order changes prompt.',
          expect.stringMatching(/^Held-out gain: [+−]\d+ points$/),
        ],
        link: `lines/${DELIVERY}/stations/${BUILD}`,
        linkLabel: 'Open the station',
        externalLink: {
          url: `https://github.com/${CONFIG}/pull/1`,
          label: 'Review the pull request',
        },
      }),
    ]);

    const pullRequestId = ConfigPullRequestId.of(opened[0]?.id as string);

    await delivered(
      new ConfigPullRequestOpened(
        pullRequestId,
        team.workspaceId,
        team.teamId,
        BUILD,
        StationFingerprint.of('e'.repeat(64)),
        PullRequestUrl.of(`https://github.com/${CONFIG}/pull/1`),
        new Date(),
      ),
    );
    await delivered(
      new ConfigPullRequestFailed(
        pullRequestId,
        team.workspaceId,
        ConfigPullRequestReason.of({
          code: 'github-error',
          message: 'GitHub is down',
        }),
      ),
    );

    expect(await ownNotices()).toEqual(notices);

    await dueNow(searchedAt(), { lastStartedAt: null });
    await autoSearched(app);

    expect((await scheduleOf(searchedAt()))?.lastSkipReason).toBe(
      'pull-request-open',
    );
    expect(
      (await db.select().from(schema.replaySearch)).filter(
        (each) => each.state !== 'finished' && each.state !== 'stopped',
      ),
    ).toEqual([]);
    expect(github.opened).toHaveLength(1);

    await delivered({
      kind: PULL_REQUEST_CLOSED,
      workspaceId: team.workspaceId.value,
      pullRequest: `https://github.com/${CONFIG}/pull/1`,
      repository: CONFIG,
      gitHubId: GITHUB_ID_BASE + 1,
      closedAt: new Date().toISOString(),
      merged: true,
      mergeCommit: 'merge_1',
    } as never);

    expect(
      (
        await db
          .select()
          .from(schema.configPullRequest)
          .where(eq(schema.configPullRequest.id, pullRequestId.value))
      )[0],
    ).toMatchObject({ state: 'merged', number: 1, closedBecause: null });
    expect(
      await eventually(
        async () => (await scheduleOf(searchedAt()))?.lastImprovedAt ?? null,
        WITHIN,
      ),
    ).toBeInstanceOf(Date);

    await dueNow(searchedAt(), { lastStartedAt: null });
    await autoSearched(app);

    expect(await activeSearchAt(searchedAt())).toBeDefined();
    expect(await ownNotices()).toEqual(notices);
  }, 180_000);
});
