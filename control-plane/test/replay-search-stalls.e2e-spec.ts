import { randomUUID } from 'node:crypto';
import { AdvanceSearches } from '@replays/application/services/advance-searches.service';
import { TEAM_DELETED } from '@shared-kernel/application/integration-events/team-deleted.integration-event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { eq, inArray } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import {
  anOriginal,
  app,
  BUILD,
  bearing,
  createSet,
  DELIVERY,
  db,
  delivered,
  drained,
  endedSearchRun,
  entryOf,
  fiveTasks,
  http,
  type InboxEntry,
  leasedSearchRun,
  liveBlock,
  openSearchFlow,
  owner,
  POLISH,
  proposing,
  replayEnded,
  replayRow,
  searchOf,
  searchRow,
  searchRunsOf,
  searchState,
  startSearch,
  team,
  WITHIN,
} from './support/search-flow';

openSearchFlow();

describe('a search for a better station config, when it stalls or loses its station', () => {
  it('looks into why once two iterations in a row came to nothing, takes a cause for each failing searched task and none for a held-out one, ends stalled and tells who started it', async () => {
    const setId = await createSet(fiveTasks);
    const { id, seedReplayId } = await startSearch(setId, {
      iterations: 4,
      perIteration: 1,
      ceiling: 20,
    });

    await drained(() => ({ score: 2, cost: 0.1 }));
    expect(await replayEnded(seedReplayId)).toBe('finished');

    await endedSearchRun(await leasedSearchRun(id, 1), true);
    await endedSearchRun(await leasedSearchRun(id, 2), true);

    const reflecting = await leasedSearchRun(id, 3);
    const looking = await searchOf(id);
    const reflection = looking.iterations[2]?.reflection;
    const searchedTasks = looking.split.searched.map((each) => each.taskId);
    const heldOutTasks = looking.split.heldOut.map((each) => each.taskId);

    expect(looking.state).toBe('searching');
    expect(looking.iterations.map((each) => each.kind)).toEqual([
      'propose',
      'propose',
      'reflect',
    ]);
    expect(reflection?.tasks.map((each) => each.taskId).sort()).toEqual(
      [...searchedTasks].sort(),
    );
    expect(reflection?.endedSearch).toBe(false);

    const [first, second, third] = reflection?.tasks ?? [];
    const causing = (taskId: string, cause: string, suggestion?: string) =>
      bearing(reflecting.token).post(
        `/api/runs/${reflecting.runId}/failure-causes`,
        {
          taskId,
          cause,
          evidence: `The replay of ${taskId} shows the ${cause} at fault.`,
          ...(suggestion ? { suggestion } : {}),
        },
      );

    const heldOut = await causing(heldOutTasks[0] as string, 'task').expect(
      404,
    );
    const unknown = await causing('task_unknown', 'task').expect(404);

    expect(heldOut.body.detail.replace(heldOutTasks[0], '<task>')).toBe(
      unknown.body.detail.replace('task_unknown', '<task>'),
    );
    await causing(first?.taskId as string, 'luck').expect(422);
    await proposing(reflecting, {
      name: 'late',
      hypothesis: 'Proposed while looking into why.',
      station: await liveBlock(),
    }).expect(409);

    await causing(first?.taskId as string, 'config').expect(201);
    expect(
      (
        await causing(
          first?.taskId as string,
          'judge',
          'Drop the line of the rubric that requires tests.',
        ).expect(201)
      ).body,
    ).toEqual({
      taskId: first?.taskId,
      cause: 'judge',
      replayRunId: first?.replayRunId,
    });
    await causing(
      second?.taskId as string,
      'task',
      'Take it out of the set.',
    ).expect(201);
    await causing(third?.taskId as string, 'check').expect(201);

    await endedSearchRun(reflecting);
    await eventually(
      async () => (await searchState(id)) === 'finished',
      WITHIN,
    );

    const stalled = await searchOf(id);
    const looked = stalled.iterations[2]?.reflection;

    expect(stalled.stopReason).toBe('stalled');
    expect(stalled.iterations).toHaveLength(3);
    expect(looked?.endedSearch).toBe(true);
    expect(looked?.result).toBe('no-config-cause');
    expect(
      looked?.causes.map((each) => [each.taskId, each.cause, each.replayRunId]),
    ).toEqual([
      [first?.taskId, 'judge', first?.replayRunId],
      [second?.taskId, 'task', second?.replayRunId],
      [third?.taskId, 'check', third?.replayRunId],
    ]);
    expect(
      (await replayRow(seedReplayId))?.id === seedReplayId &&
        (await entryOf(first?.replayRunId as string))?.replayId,
    ).toBe(seedReplayId);

    const notice = await eventually(async () => {
      const inbox = (
        await owner().get(`/api/workspaces/${team.slug}/inbox`).expect(200)
      ).body as InboxEntry[];

      return (
        inbox.find(
          (each): each is Extract<InboxEntry, { kind: 'notice' }> =>
            each.kind === 'notice' && each.link.endsWith(`/${id}`),
        ) ?? null
      );
    }, WITHIN);

    expect(notice).toMatchObject({
      kind: 'notice',
      teamId: team.teamId.value,
      form: 'ended',
      headline:
        'The search for a better Build config ended with nothing the config can fix',
      link: `lines/${DELIVERY}/stations/${BUILD}/searches/${id}`,
      linkLabel: 'Open the search',
      unread: true,
      resolved: false,
    });
    expect(notice?.points).toEqual([
      expect.stringMatching(
        /^No config change can fix the \d+ tasks? still failing\. The rest of the budget stays unspent\.$/,
      ),
      expect.stringMatching(
        /^Fix the judge’s rubric, for “Drain (the )?queue[^”]*”: Drop the line of the rubric that requires tests\.$/,
      ),
      expect.stringMatching(
        /^Take the task out of the replay set, or reword it, for “Drain (the )?queue[^”]*”: Take it out of the set\.$/,
      ),
      expect.stringMatching(
        /^Fix the station’s check, for “Drain (the )?queue[^”]*”: /,
      ),
    ]);
    expect(notice?.points.join('\n')).not.toContain(first?.taskId);

    await http()
      .post(`/api/workspaces/${team.slug}/inbox/notices/${notice?.id}/resolve`)
      .set(TEST_USER_HEADER, randomUUID())
      .expect(404);
    await owner()
      .post(`/api/workspaces/elsewhere/inbox/notices/${notice?.id}/resolve`)
      .expect(404);
    await owner()
      .post(`/api/workspaces/${team.slug}/inbox/notices/${notice?.id}/resolve`)
      .expect(204);

    const resolved = (
      (await owner().get(`/api/workspaces/${team.slug}/inbox`).expect(200))
        .body as InboxEntry[]
    ).find((each) => each.id === notice?.id);

    expect(resolved).toMatchObject({ unread: false, resolved: true });

    const longAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

    await db
      .update(schema.notice)
      .set({ createdAt: longAgo, resolvedAt: longAgo })
      .where(eq(schema.notice.id, notice?.id as string));

    expect(
      (
        (await owner().get(`/api/workspaces/${team.slug}/inbox`).expect(200))
          .body as InboxEntry[]
      ).some((each) => each.id === notice?.id),
    ).toBe(false);
  }, 120_000);

  it('searches on once looking into why it stalled finds a cause the config can fix, telling no one', async () => {
    const setId = await createSet(fiveTasks);
    const { id, seedReplayId } = await startSearch(setId, {
      iterations: 4,
      perIteration: 1,
      ceiling: 20,
    });

    await drained(() => ({ score: 2, cost: 0.1 }));
    expect(await replayEnded(seedReplayId)).toBe('finished');

    await endedSearchRun(await leasedSearchRun(id, 1), true);
    await endedSearchRun(await leasedSearchRun(id, 2), true);

    const reflecting = await leasedSearchRun(id, 3);
    const [failing] =
      (await searchOf(id)).iterations[2]?.reflection?.tasks ?? [];

    await bearing(reflecting.token)
      .post(`/api/runs/${reflecting.runId}/failure-causes`, {
        taskId: failing?.taskId,
        cause: 'config',
        evidence: 'It never ran the migrations the prompt leaves out.',
        suggestion: 'Tell it to run migrations first.',
      })
      .expect(201);
    await endedSearchRun(reflecting);

    const next = await leasedSearchRun(id, 4);
    const goingOn = await searchOf(id);

    expect(goingOn.state).toBe('searching');
    expect(goingOn.iterations.map((each) => each.kind)).toEqual([
      'propose',
      'propose',
      'reflect',
      'propose',
    ]);
    expect(goingOn.iterations[2]?.reflection?.endedSearch).toBe(false);
    expect(goingOn.iterations[2]?.reflection?.result).toBe('continued');
    const briefed = (await searchRunsOf(id)).find(
      (each) => each.id === next.runId,
    )?.spec as { briefing?: string } | undefined;

    expect(briefed?.briefing).toContain(
      'Suggested: Tell it to run migrations first.',
    );

    await endedSearchRun(next, true);
    await eventually(
      async () => (await searchState(id)) === 'finished',
      WITHIN,
    );

    expect((await searchRow(id))?.stopReason).toBe('iterations-spent');

    const inbox = (
      await owner().get(`/api/workspaces/${team.slug}/inbox`).expect(200)
    ).body as InboxEntry[];

    expect(
      inbox.some(
        (each) => each.kind === 'notice' && each.link.endsWith(`/${id}`),
      ),
    ).toBe(false);
  }, 120_000);

  it('stops once its station leaves its line', async () => {
    const originals = [];
    for (let each = 0; each < 5; each += 1) {
      originals.push(await anOriginal(POLISH));
    }
    const setId = await createSet(originals, POLISH);
    const { id, seedReplayId } = await startSearch(
      setId,
      { iterations: 1, perIteration: 1, ceiling: 20 },
      POLISH,
    );
    const line = (
      await owner().get(`/api/resources/lines/${DELIVERY}`).expect(200)
    ).body as {
      version: number;
      definition: { stations: { key: string }[] };
    };

    await owner()
      .put(
        `/api/resources/lines/${DELIVERY}`,
        {
          ...line.definition,
          stations: line.definition.stations.filter(
            (each) => each.key !== 'polish',
          ),
        },
        line.version,
      )
      .expect(200);

    await eventually(async () => (await searchState(id)) === 'stopped', WITHIN);

    expect((await searchRow(id))?.stopReason).toBe('station-gone');
    expect(await replayEnded(seedReplayId)).not.toBe('running');
  }, 120_000);

  it('is deleted with its team, cancelling its active agent run', async () => {
    const setId = await createSet(fiveTasks);
    const { id, seedReplayId } = await startSearch(setId, {
      iterations: 2,
      perIteration: 1,
      ceiling: 20,
    });

    await drained(() => ({ score: 4, cost: 0.1 }));
    expect(await replayEnded(seedReplayId)).toBe('finished');
    await eventually(async () => {
      await app.get(AdvanceSearches).processDue();
      return (await searchRunsOf(id)).some((each) => each.state === 'queued');
    }, WITHIN);

    const [agentRun] = await searchRunsOf(id);

    await delivered({
      kind: TEAM_DELETED,
      workspaceId: team.workspaceId.value,
      teamId: team.teamId.value,
      key: 'core',
    } as DomainEvent);

    expect(await searchRow(id)).toBeUndefined();
    expect(
      await db
        .select()
        .from(schema.notice)
        .where(eq(schema.notice.teamId, team.teamId.value)),
    ).toEqual([]);
    await eventually(
      async () =>
        (
          await db
            .select()
            .from(schema.configPullRequest)
            .where(eq(schema.configPullRequest.teamId, team.teamId.value))
        ).length === 0,
      WITHIN,
    );
    await eventually(
      async () => (await replayRow(seedReplayId)) === undefined,
      WITHIN,
    );
    expect(
      (
        await db
          .select({ state: schema.run.state })
          .from(schema.run)
          .where(inArray(schema.run.id, [agentRun?.id ?? '']))
      )[0]?.state,
    ).not.toBe('queued');
  }, 120_000);
});
