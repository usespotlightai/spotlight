import { randomUUID } from 'node:crypto';
import { AdvanceSearches } from '@replays/application/services/advance-searches.service';
import { OpenConfigPullRequests } from '@replays/application/services/open-config-pull-requests.service';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import {
  REPLAY_CANDIDATES,
  type ReplayCandidatesPort,
} from '@work/application/ports/replay-candidates.port';
import { BuiltInTools } from '@work/application/services/built-in-tools.service';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { TEST_STATION_CHANGE } from '@work/domain/services/built-in-tools';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TargetStation } from '@work/domain/value-objects/target-station.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { DrizzleChatRepository } from '@work/infrastructure/persistence/drizzle/repositories/chat.repository';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { dueNow, policyAt, scheduleOf } from './support/auto-searches';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import {
  anOriginal,
  app,
  BUILD,
  CONFIG_FILE,
  CONFIG_LINE,
  createSet,
  DELIVERY,
  db,
  drained,
  endedSearchRun,
  github,
  judged,
  leasedSearchRun,
  liveBlock,
  openSearchFlow,
  POLISH,
  PROMPT_FILE,
  replayEnded,
  searchedAt,
  searchOf,
  searchRow,
  searchRunsOf,
  searchState,
  startSearch,
  team,
  turnedOff,
  WITHIN,
} from './support/search-flow';

openSearchFlow();

const STATIONS: Readonly<Record<string, { key: string; name: string }>> = {
  [BUILD]: { key: 'build', name: 'Build' },
  [POLISH]: { key: 'polish', name: 'Polish' },
};

const improving = async (stationId: string | null): Promise<ChatId> => {
  const station = stationId ? STATIONS[stationId] : undefined;
  const chat = Chat.start({
    workspaceId: team.workspaceId,
    teamId: team.teamId,
    startedBy: team.owner,
    harness: HarnessId.of('claude-code'),
    body: ChatMessageBody.fromInput('Improve this station.'),
    targetStation:
      stationId && station
        ? TargetStation.rehydrate({
            teamId: team.teamId,
            lineId: LineId.of(DELIVERY),
            lineKey: LineKey.of('delivery'),
            lineName: LineName.of('Delivery'),
            stationId: StationId.of(stationId),
            stationKey: StationKey.of(station.key),
            stationName: StationName.of(station.name),
          })
        : null,
    now: new Date(),
    newId: () => randomUUID(),
  });

  await app.get(DrizzleChatRepository).add(chat);

  return chat.id;
};

interface Answer {
  readonly started: boolean;
  readonly mode?: string;
  readonly refusal?: string;
  readonly reason?: string;
  readonly problems?: readonly string[];
  readonly next: string;
}

const tested = async (
  chatId: ChatId,
  inputs: Record<string, string>,
): Promise<Answer> => {
  const tool = app.get(BuiltInTools).resolve(TEST_STATION_CHANGE, {
    kind: 'chat',
    runId: RunId.of(randomUUID()),
    workspaceId: team.workspaceId,
    chatId,
    teamId: team.teamId,
    requester: team.owner,
  });

  if (!tool) {
    throw new Error('a chat has no test-station-change tool');
  }

  return (await tool.call(ToolInputs.of(inputs))) as Answer;
};

const change = async (name: string, prompt = 'Build it, in order.\n') => ({
  name,
  hypothesis: 'Draining in order stops the stall.',
  config: JSON.stringify({ ...(await liveBlock()), prompt }),
});

const polishChange = async (name: string) => {
  const live = await app
    .get<ReplayCandidatesPort>(REPLAY_CANDIDATES)
    .live(DELIVERY, POLISH);
  const block = live?.station ?? {};

  return {
    name,
    hypothesis: 'Polishing in order stops the stall.',
    config: JSON.stringify({ ...block, prompt: 'Polish it, in order.\n' }),
  };
};

const requestedAt = async (stationId: string) => {
  const rows = await db
    .select()
    .from(schema.replaySearch)
    .where(
      and(
        eq(schema.replaySearch.stationId, stationId),
        eq(schema.replaySearch.trigger, 'request'),
      ),
    );

  return rows.sort(
    (one, other) => other.startedAt.getTime() - one.startedAt.getTime(),
  )[0];
};

const noticesTo = async (searchId: string) =>
  db
    .select()
    .from(schema.notice)
    .where(eq(schema.notice.subject, `replay-search ${searchId} result`));

const proposalReplayOf = async (searchId: string) =>
  eventually(async () => {
    await app.get(AdvanceSearches).processDue();
    const [iteration] = await db
      .select()
      .from(schema.replaySearchIteration)
      .where(eq(schema.replaySearchIteration.searchId, searchId));

    return iteration?.proposals[0]?.replay.replayId ?? null;
  }, WITHIN);

const freshRequests = async (stationId: string): Promise<void> => {
  await db
    .update(schema.stationSearchSchedule)
    .set({ requestDay: null, requestCount: 0 })
    .where(eq(schema.stationSearchSchedule.stationId, stationId));
};

const polishSet = async (count: number) => {
  const originals = [];
  for (let each = 0; each < count; each += 1) {
    originals.push(await anOriginal(POLISH));
  }

  return createSet(originals, POLISH);
};

describe('the improve-station chat testing its change', () => {
  it('tests the change against the live config on the searched and held-out tasks, opens a config pull request when it holds up, and tells the team', async () => {
    const tasks = [];
    for (let each = 0; each < 17; each += 1) {
      tasks.push(await anOriginal());
    }
    await createSet(tasks);
    await policyAt(searchedAt(), { iterations: 3, ceiling: 60 });
    github.files.set(CONFIG_FILE, CONFIG_LINE);
    github.files.set(PROMPT_FILE, 'Build it.');

    const answer = await tested(
      await improving(BUILD),
      await change('in-order'),
    );

    expect(answer).toMatchObject({ started: true, mode: 'test' });
    expect(answer.next).toContain('searched tasks');
    expect(answer.next).toContain('inbox');

    const search = await requestedAt(BUILD);

    expect(search).toMatchObject({ trigger: 'request', iterations: 1 });
    expect(search?.requests).toEqual([
      expect.objectContaining({
        name: 'in-order',
        requestedBy: team.owner.value,
      }),
    ]);
    const schedule = await scheduleOf(searchedAt());

    expect(schedule?.lastStartedAt).toBeNull();
    expect(schedule?.searchedTasks.length).toBeGreaterThan(0);
    expect(schedule?.requestCount).toBe(1);

    const id = search?.id as string;
    const seed = search?.seedReplay.replayId as string;

    await drained(() => ({ score: 2, cost: 0.1 }));
    expect(await replayEnded(seed)).toBe('finished');

    const proposed = await proposalReplayOf(id);

    expect(await searchRunsOf(id)).toEqual([]);

    await drained(() => ({ score: 5, cost: 0.1 }));
    expect(await replayEnded(proposed)).toBe('finished');
    await eventually(async () => {
      await app.get(AdvanceSearches).processDue();
      return (await searchRow(id))?.heldOut.length === 1;
    }, WITHIN);
    await drained(() => ({ score: 5, cost: 0.1 }));
    await eventually(async () => {
      await judged();
      return (await searchState(id)) === 'finished';
    }, WITHIN);
    await eventually(async () => {
      await app.get(OpenConfigPullRequests).processDue();
      const [opened] = await db
        .select()
        .from(schema.configPullRequest)
        .where(eq(schema.configPullRequest.searchId, id));

      return opened?.state === 'opened';
    }, WITHIN);

    expect((await searchOf(id)).pick).toMatchObject({
      outcome: 'picked',
      name: 'in-order',
    });

    const notices = await eventually(async () => {
      const found = await noticesTo(id);

      return found.length > 0 ? found : null;
    }, WITHIN);

    expect(notices).toEqual([
      expect.objectContaining({
        addresseeId: null,
        headline:
          'Spotlight opened a config pull request for the Build station',
        externalUrl: expect.stringMatching(/^https:\/\/github\.com\//),
      }),
    ]);
  }, 300_000);

  it('refuses a new test while a config pull request for the station is open, and says why', async () => {
    expect(
      await tested(await improving(BUILD), await change('second-try')),
    ).toMatchObject({
      started: false,
      refusal: 'pull-request-open',
      reason:
        'A config pull request for the station is open. A person must merge or close it first.',
      next: expect.stringContaining('Terraform diff'),
    });
  });

  it('tells the person who asked why no pull request opened, with the result of their change', async () => {
    await polishSet(10);
    await policyAt(searchedAt(POLISH), { iterations: 3, ceiling: 60 });

    const answer = await tested(
      await improving(POLISH),
      await polishChange('worse'),
    );

    expect(answer).toMatchObject({ started: true, mode: 'test' });

    const search = await requestedAt(POLISH);
    const id = search?.id as string;

    await drained(() => ({ score: 4, cost: 0.1 }));
    expect(await replayEnded(search?.seedReplay.replayId as string)).toBe(
      'finished',
    );
    await proposalReplayOf(id);
    await drained(() => ({ score: 1, cost: 0.1 }));
    await eventually(async () => {
      await app.get(AdvanceSearches).processDue();
      await judged();
      return (await searchState(id)) === 'finished';
    }, WITHIN);

    const notices = await eventually(async () => {
      const found = await noticesTo(id);

      return found.length > 0 ? found : null;
    }, WITHIN);

    expect(notices).toEqual([
      expect.objectContaining({
        addresseeId: team.owner.value,
        headline:
          'Spotlight did not open a config pull request for the Polish station',
        points: [
          expect.stringMatching(
            /^No candidate did better than the live config on the (searched|held-out) tasks\.$/,
          ),
          expect.stringMatching(
            /^Candidate worse(, held-out gain: [+−]\d+ points| did not beat the live config on the searched tasks\. Searched gain: [+−]\d+ points)$/,
          ),
        ],
      }),
    ]);
    expect(
      await db
        .select()
        .from(schema.notice)
        .where(
          and(
            eq(schema.notice.subject, `replay-search ${id} result`),
            isNull(schema.notice.addresseeId),
          ),
        ),
    ).toEqual([]);
  }, 300_000);

  it('ignores the cooldown and the period, and starts a search whose first candidate is the change when the person asks for a search', async () => {
    const earlier = await startSearch({ iterations: 1, ceiling: 60 }, POLISH);

    await turnedOff(earlier.id);
    await policyAt(searchedAt(POLISH), { iterations: 3, ceiling: 60 });
    await dueNow(searchedAt(POLISH), { lastStartedAt: new Date() });

    const answer = await tested(await improving(POLISH), {
      ...(await polishChange('searched-start')),
      mode: 'search',
    });

    expect(answer).toMatchObject({ started: true, mode: 'search' });

    const search = await requestedAt(POLISH);
    const id = search?.id as string;

    expect(search?.iterations).toBe(3);

    await drained(() => ({ score: 2, cost: 0.1 }));
    expect(await replayEnded(search?.seedReplay.replayId as string)).toBe(
      'finished',
    );

    const proposed = await proposalReplayOf(id);
    const [first] = await db
      .select()
      .from(schema.replaySearchIteration)
      .where(eq(schema.replaySearchIteration.searchId, id));

    expect(first).toMatchObject({ number: 1, kind: 'request', runId: null });
    expect(first?.proposals[0]).toMatchObject({
      name: 'searched-start',
      requestedBy: team.owner.value,
    });

    await drained(() => ({ score: 3, cost: 0.1 }));
    expect(await replayEnded(proposed)).toBe('finished');
    await leasedSearchRun(id, 2);
    await turnedOff(id);
  }, 300_000);

  it('adds the change to a running search that can still take candidates, and refuses once it cannot', async () => {
    const running = await startSearch({ iterations: 2, ceiling: 60 }, POLISH);
    const joined = await tested(
      await improving(POLISH),
      await polishChange('joined'),
    );

    expect(joined).toMatchObject({ started: true, outcome: 'joined' });
    expect(joined.next).toContain('iteration 1 of 2');
    expect((await searchRow(running.id))?.requests).toEqual([
      expect.objectContaining({ name: 'joined' }),
    ]);

    await turnedOff(running.id);

    const last = await startSearch({ iterations: 1, ceiling: 60 }, POLISH);

    await drained(() => ({ score: 2, cost: 0.1 }));
    expect(await replayEnded(last.seedReplayId)).toBe('finished');
    await leasedSearchRun(last.id, 1);

    expect(
      await tested(await improving(POLISH), await polishChange('too-late')),
    ).toMatchObject({
      started: false,
      refusal: 'search-running',
      reason:
        'A search of the station is running and takes no more candidates.',
    });

    await turnedOff(last.id);
  }, 300_000);

  it('replays a change that joined a running search before the ceiling ends that search', async () => {
    await policyAt(searchedAt(POLISH), { iterations: 3, ceiling: 20 });
    await freshRequests(POLISH);

    const running = await startSearch({ iterations: 3, ceiling: 20 }, POLISH);

    await drained(() => ({ score: 2, cost: 0.01 }));
    expect(await replayEnded(running.seedReplayId)).toBe('finished');

    const agent = await leasedSearchRun(running.id, 1);

    expect(
      await tested(
        await improving(POLISH),
        await polishChange('before-ceiling'),
      ),
    ).toMatchObject({
      outcome: 'joined',
      next: expect.stringContaining('iteration 2 of 3'),
    });

    await endedSearchRun(agent, false, 19);

    const second = await eventually(async () => {
      await app.get(AdvanceSearches).processDue();
      const rows = await db
        .select()
        .from(schema.replaySearchIteration)
        .where(eq(schema.replaySearchIteration.searchId, running.id));

      return rows.find((each) => each.number === 2) ?? null;
    }, WITHIN);

    expect(second).toMatchObject({ kind: 'request', runId: null });
    await eventually(
      async () =>
        ((
          await db
            .select()
            .from(schema.replaySearchIteration)
            .where(eq(schema.replaySearchIteration.searchId, running.id))
        ).find((each) => each.number === 2)?.proposals.length ?? 0) === 1,
      WITHIN,
    );
    await turnedOff(running.id);
  }, 300_000);

  it('refuses while the last search of the station has not given its result', async () => {
    const [last] = await db
      .select()
      .from(schema.replaySearch)
      .where(eq(schema.replaySearch.stationId, POLISH))
      .orderBy(desc(schema.replaySearch.startedAt))
      .limit(1);

    expect(last?.endedAt).not.toBeNull();

    await db
      .update(schema.replaySearch)
      .set({ state: 'finished', pick: null })
      .where(eq(schema.replaySearch.id, last?.id as string));

    expect(
      await tested(await improving(POLISH), await polishChange('pending')),
    ).toMatchObject({
      started: false,
      refusal: 'result-pending',
      reason: 'The last search of the station has not given its result yet.',
    });

    await db
      .update(schema.replaySearch)
      .set({ state: last?.state, pick: last?.pick ?? null })
      .where(eq(schema.replaySearch.id, last?.id as string));
  });

  it('refuses a fourth requested test of the station on the same day', async () => {
    await policyAt(searchedAt(POLISH), { iterations: 1, ceiling: 60 });
    await freshRequests(POLISH);

    for (const name of ['first', 'second', 'third']) {
      expect(
        await tested(await improving(POLISH), await polishChange(name)),
      ).toMatchObject({ outcome: 'started' });
      await turnedOff((await requestedAt(POLISH))?.id as string);
    }

    expect(
      await tested(await improving(POLISH), await polishChange('fourth')),
    ).toMatchObject({
      started: false,
      refusal: 'request-limit',
      reason:
        'The station took the most requested tests for today. Maximum requests a day: 3',
    });
  });

  it('refuses when the search ceiling cannot pay for one replay of each task', async () => {
    await policyAt(searchedAt(POLISH), { iterations: 1, ceiling: 0.05 });
    await freshRequests(POLISH);

    expect(
      await tested(await improving(POLISH), await polishChange('too-cheap')),
    ).toMatchObject({
      started: false,
      refusal: 'ceiling-too-low',
      reason: expect.stringMatching(/^The search ceiling is too low/),
    });
  });

  it('refuses when success moves too much between repeats of the same runs', async () => {
    await polishSet(10);
    await policyAt(searchedAt(POLISH), { iterations: 1, ceiling: 60 });
    await freshRequests(POLISH);

    expect(
      await tested(await improving(POLISH), await polishChange('calibrating')),
    ).toMatchObject({ outcome: 'started' });

    const calibrating = await requestedAt(POLISH);
    await drained((_replayId, repeat) => ({
      score: repeat === 1 ? 5 : 1,
      cost: 0.01,
    }));
    expect(await replayEnded(calibrating?.seedReplay.replayId as string)).toBe(
      'finished',
    );
    await turnedOff(calibrating?.id as string);
    await freshRequests(POLISH);

    const noisy = await tested(
      await improving(POLISH),
      await polishChange('noisy'),
    );

    await turnedOff((await requestedAt(POLISH))?.id as string);

    expect(noisy).toMatchObject({
      started: false,
      refusal: 'noisy',
      reason: expect.stringMatching(/^Success moves too much/),
    });
  }, 300_000);

  it('refuses when the searches of the line this month leave no room for one more under the monthly ceiling', async () => {
    await policyAt(
      searchedAt(POLISH),
      { iterations: 1, ceiling: 60 },
      { monthlyCeiling: 60 },
    );

    expect(
      await tested(await improving(POLISH), await polishChange('over-month')),
    ).toMatchObject({
      started: false,
      refusal: 'monthly-ceiling',
      reason: expect.stringMatching(
        /^The searches of the line reached their monthly ceiling\. Next month starts: \d{4}-\d{2}-01$/,
      ),
    });
  });

  it('refuses when search is off for the station', async () => {
    await policyAt(searchedAt(POLISH), { iterations: 1, ceiling: 60 });
    await db
      .update(schema.station)
      .set({
        search: {
          enabled: false,
          ceiling: 60,
          period: null,
          onAlert: null,
          cooldown: null,
          agent: { harness: 'claude-code', model: null, effort: 'high' },
          iterations: 1,
          repeats: null,
          objective: null,
        },
      })
      .where(eq(schema.station.id, POLISH));

    expect(
      await tested(await improving(POLISH), await polishChange('off')),
    ).toMatchObject({
      started: false,
      refusal: 'search-off',
      reason: 'Search is off for the station in the Terraform of the line.',
    });
  });

  it('refuses a replay set with too few tasks', async () => {
    await polishSet(3);
    await policyAt(searchedAt(POLISH), { iterations: 1, ceiling: 60 });

    expect(
      await tested(await improving(POLISH), await polishChange('few')),
    ).toMatchObject({
      started: false,
      refusal: 'set-too-small',
      reason: expect.stringMatching(
        /^The replay set of the station has too few tasks to measure a change\. Minimum tasks required: \d+$/,
      ),
    });
  });

  it('rejects a change the line does not take, with each problem', async () => {
    const answer = await tested(await improving(POLISH), {
      ...(await polishChange('Not A Slug')),
    });

    expect(answer).toMatchObject({
      started: false,
      refusal: 'invalid-change',
      problems: [expect.stringMatching(/^name: /)],
    });
  });

  it('refuses a chat that improves no station, and another station than its own', async () => {
    expect(
      await tested(await improving(null), await polishChange('nowhere')),
    ).toMatchObject({ started: false, refusal: 'not-improving' });
    expect(
      await tested(await improving(POLISH), {
        ...(await polishChange('elsewhere')),
        station: 'build',
      }),
    ).toMatchObject({ started: false, refusal: 'other-station' });
  });

  it('offers no such tool to a task run', () => {
    expect(
      app.get(BuiltInTools).resolve(TEST_STATION_CHANGE, {
        kind: 'task',
        runId: RunId.of(randomUUID()),
        workspaceId: team.workspaceId,
        taskId: TaskId.of(randomUUID()),
        stationId: StationId.of(POLISH),
        requester: team.owner,
      }),
    ).toBeNull();
  });
});
