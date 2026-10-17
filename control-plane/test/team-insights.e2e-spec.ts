import { randomUUID } from 'node:crypto';
import { PullRequestClosed } from '@github/domain/events/pull-request-closed.event';
import { PullRequestReviewed } from '@github/domain/events/pull-request-reviewed.event';
import type { INestApplication } from '@nestjs/common';
import { DrizzleRunRecordRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/run-record.repository';
import { DrizzleTaskDeliveryRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-delivery.repository';
import { DrizzleTaskFailuresRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-failures.repository';
import { DrizzleTaskTouchesRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-touches.repository';
import { EventDelivery } from '@platform/events/event-delivery';
import { EventOutbox } from '@platform/events/event-outbox';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  RUN_ENDED,
  type RunEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-ended.integration-event';
import {
  RUN_SUPERSEDED,
  type RunSupersededIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-superseded.integration-event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { ChatStarted } from '@work/domain/events/chat-started.event';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { RunDigested } from '@work/domain/events/run-digested.event';
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskFailed } from '@work/domain/events/task-failed.event';
import { TaskHandedOn } from '@work/domain/events/task-handed-on.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import { CalledTool } from '@work/domain/value-objects/called-tool.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { Money } from '@work/domain/value-objects/money.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import {
  type ServerCalls,
  ToolUse,
} from '@work/domain/value-objects/tool-use.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import { openTeam } from './support/team';

const TOKEN_HEADER = 'spotlight-workspace-token';
const CONFIG = 'a'.repeat(64);
const PULL = 'https://github.com/acme/api/pull/42';
const MINUTE = 60_000;

const SPEC = {
  command: { executable: 'sh', args: [] },
  briefing: 'do the thing',
  handover: { options: [], noteLimit: 0 },
  continuity: { key: 'task:station' },
};

const NOW = Date.now();

const ago = (minutes: number) => new Date(NOW - minutes * MINUTE);

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof openTeam>>;
let elsewhere: Awaited<ReturnType<typeof openTeam>>;
const TASK = TaskId.of(randomUUID());
const RUN = RunId.of(randomUUID());
const NEXT = randomUUID();

const insights = (tab: string, query = 'period=7d') =>
  `/api/teams/${team.teamId.value}/insights/${tab}?${query}`;

const asOwner = (path: string) =>
  served(app).get(path).set(TEST_USER_HEADER, team.owner.value);

const bearing = (path: string, token: string) =>
  served(app).get(path).set('Authorization', `Bearer ${token}`);

const issued = async (
  of: Awaited<ReturnType<typeof openTeam>>,
  scopes: readonly string[],
): Promise<string> => {
  const answer = await served(app)
    .post(`/api/resources/workspaces/${of.workspaceId.value}/tokens`)
    .set(TEST_USER_HEADER, of.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({ name: `insights-${randomUUID().slice(0, 6)}`, scopes });

  expect(answer.status).toBe(201);

  return answer.headers[TOKEN_HEADER] as string;
};

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  const tasks = app.get(DrizzleTaskRepository);
  team = await openTeam(db, tasks, `insights-${randomUUID().slice(0, 8)}`);
  elsewhere = await openTeam(
    db,
    tasks,
    `elsewhere-${randomUUID().slice(0, 8)}`,
  );
  const station = team.stationId;
  const workspaceId = team.workspaceId;

  await db.insert(schema.run).values({
    id: RUN.value,
    workspaceId: workspaceId.value,
    harness: 'dev',
    taskId: TASK.value,
    taskRevision: 0,
    stationId: team.stationId.value,
    state: 'completed',
    spec: SPEC,
    stationFingerprint: CONFIG,
    stationConfig: {
      prompt: 'Implement the task.',
      harness: 'claude-code',
      model: 'sonnet',
      effort: 'high',
      profile: null,
      image: null,
      repositories: [{ name: 'acme/api', setup: null }],
      skills: [{ key: 'grafana', digest: 'd'.repeat(64) }],
      tools: [],
      decisions: false,
      memories: false,
    },
    createdAt: ago(300),
    startedAt: ago(298),
    endedAt: ago(240),
  });

  const ended: RunEndedIntegrationEvent = {
    kind: RUN_ENDED,
    runId: RUN.value,
    workspaceId: workspaceId.value,
    taskId: TASK.value,
    stationId: team.stationId.value,
    outcome: 'completed',
    failure: null,
    stopped: false,
    asked: false,
  };

  const record = () => app.get(DrizzleRunRecordRepository).of(RUN);
  const delivery = () => app.get(DrizzleTaskDeliveryRepository).forTask(TASK);
  const touches = () => app.get(DrizzleTaskTouchesRepository).of(TASK);
  const failures = () => app.get(DrizzleTaskFailuresRepository).of(TASK);
  const heard = async (
    events: readonly DomainEvent[],
    check: () => Promise<unknown>,
  ) => {
    await app.get(EventOutbox).record(events);
    await eventually(async () => {
      await app.get(EventDelivery).drain(2_000);
      return check();
    }, 60_000);
  };

  await heard(
    [
      new TaskOpened(
        TASK,
        workspaceId,
        team.teamId,
        team.line.id,
        station,
        team.owner,
        ago(360),
        false,
      ),
    ],
    async () => (await touches())?.opening,
  );
  await heard([ended], async () => (await record())?.hasEnded);
  await heard(
    [
      new RunDigested(
        RUN,
        workspaceId,
        TASK,
        58 * MINUTE,
        30,
        1,
        120,
        50_000,
        200_000,
        Money.of(1.25, 'USD'),
        Tokens.of({ input: 2_000, output: 1_000, cacheRead: 90_000 }),
        ToolUse.of({
          servers: [
            {
              server: 'linear',
              calls: 3,
              failed: 1,
              latency: LatencyHistogram.timing([200, 400, 900]),
              lastCallFailed: false,
            },
          ],
          skills: ['grafana'],
        }),
      ),
    ],
    async () => (await record())?.cost,
  );
  await heard(
    [
      new TaskHandedOn(
        TASK,
        workspaceId,
        RUN,
        station,
        StationId.of(NEXT),
        ago(240),
      ),
    ],
    async () => (await record())?.handedOn,
  );
  await heard(
    [new TaskAsked(TASK, workspaceId, station, team.owner, ago(230))],
    async () => (await touches())?.asks.length === 1,
  );
  await heard(
    [
      new TaskActedOn(
        TASK,
        workspaceId,
        station,
        'answered',
        team.owner,
        RUN,
        ago(200),
      ),
    ],
    async () => (await record())?.next && (await touches())?.acts.length === 1,
  );
  await heard(
    [
      new TaskActedOn(
        TASK,
        workspaceId,
        station,
        'refused',
        team.owner,
        RUN,
        ago(150),
        CalledTool.of({ server: 'linear', tool: 'create_issue' }),
      ),
    ],
    async () => (await record())?.refusals.length === 1,
  );
  await heard(
    [
      new TaskFailed(
        TASK,
        workspaceId,
        team.teamId,
        station,
        TaskFailure.fromHook('notify', 'loop'),
        null,
        ago(190),
      ),
    ],
    async () => (await failures())?.occurrences.length === 1,
  );
  await heard(
    [
      new TaskFailed(
        TASK,
        workspaceId,
        team.teamId,
        station,
        TaskFailure.fromHook('notify', 'loop').again(),
        null,
        ago(189),
      ),
    ],
    async () => (await failures())?.occurrences.length === 2,
  );
  await heard(
    [
      new PullRequestOpened(
        TASK,
        workspaceId,
        team.teamId,
        PullRequestUrl.of(PULL),
        ago(180),
      ),
    ],
    delivery,
  );
  await heard(
    [
      new PullRequestReviewed(
        workspaceId,
        PULL,
        'approved',
        'ada',
        false,
        ago(120),
      ),
    ],
    async () => (await delivery())?.firstReviewAt,
  );
  await heard(
    [
      new PullRequestClosed(
        workspaceId,
        PULL,
        'acme/api',
        { commit: 'c'.repeat(40) },
        ago(60),
      ),
    ],
    async () => (await delivery())?.merged,
  );
  await heard(
    [
      new ChatStarted(
        ChatId.of(randomUUID()),
        workspaceId,
        team.teamId,
        team.owner,
        ago(30),
      ),
    ],
    async () =>
      (
        await db
          .select()
          .from(schema.chatRecord)
          .where(eq(schema.chatRecord.teamId, team.teamId.value))
      ).length === 1,
  );
}, 180_000);

afterAll(async () => {
  await app?.close();
});

describe('what the outcomes context hears for a team’s insights (e2e)', () => {
  it('keeps the run’s cost, setup, waits and hand-on on its record', async () => {
    const record = await app.get(DrizzleRunRecordRepository).of(RUN);

    expect(record?.ending).toBe('completed');
    expect(record?.cost?.spend).toEqual({ amount: 1.25, currency: 'USD' });
    expect(record?.cost?.tokens).toEqual({
      input: 2_000,
      output: 1_000,
      cacheRead: 90_000,
      cacheWrite: null,
    });
    expect(record?.handedOn?.to).toBe(NEXT);
    expect(record?.next?.act).toBe('answered');
    expect(record?.end?.setup).toMatchObject({
      harness: 'claude-code',
      model: 'sonnet',
      effort: 'high',
      repositories: ['acme/api'],
      skills: ['grafana'],
    });
    expect(record?.refusals.map((each) => [each.server, each.tool])).toEqual([
      ['linear', 'create_issue'],
    ]);
    expect(record?.tools?.callsTo('linear')?.latency).toEqual(
      LatencyHistogram.timing([200, 400, 900]),
    );
  });

  it('reads the tools a run used with each record it reads at once', async () => {
    const [record] = await app.get(DrizzleRunRecordRepository).ofRuns([RUN]);

    expect(record?.tools?.callsTo('linear')?.latency).toEqual(
      LatencyHistogram.timing([200, 400, 900]),
    );
    expect(record?.tools?.read('grafana')).toBe(true);
    expect(record?.end?.queuedMs).toBe(2 * MINUTE);
  });

  it('dates the task’s pull request from opening to first review to merge', async () => {
    const delivery = await app.get(DrizzleTaskDeliveryRepository).forTask(TASK);

    expect(delivery?.state).toBe('merged');
    expect(delivery?.firstReviewAt).not.toBeNull();
    expect(delivery?.openedAt.getTime()).toBeLessThan(
      delivery?.firstReviewAt?.getTime() ?? 0,
    );
  });

  it('keeps who opened the task, what it asked and every failure raised on it', async () => {
    const touches = await app.get(DrizzleTaskTouchesRepository).of(TASK);
    const failures = await app.get(DrizzleTaskFailuresRepository).of(TASK);

    expect(touches?.opening?.by?.equals(team.owner)).toBe(true);
    expect(touches?.opening?.teamId.equals(team.teamId)).toBe(true);
    expect(touches?.waits()).toHaveLength(1);
    expect(touches?.waits()[0]?.answeredBy).toBe(team.owner.value);
    expect(
      failures?.occurrences.map((each) => [
        each.source,
        each.code,
        each.occurrences,
      ]),
    ).toEqual([
      ['hook:notify', 'loop', 1],
      ['hook:notify', 'loop', 2],
    ]);
  });
});

describe('the team’s insights (e2e)', () => {
  it('shows a team member the headline numbers', async () => {
    const answer = await asOwner(insights('overview'));

    expect(answer.status).toBe(200);
    expect(answer.body.period.name).toBe('7d');
    expect(answer.body.headline).toMatchObject({
      spend: { amount: 1.25, currency: 'USD' },
      runs: 1,
      tasks: 1,
      mergedPullRequests: 1,
      mergeRate: 1,
      costPerMerge: { amount: 1.25, currency: 'USD' },
      touches: 2,
      touchesPerTask: 2,
      activePeople: 1,
      mergedTaskIds: [TASK.value],
    });
    expect(answer.body.headline).toMatchObject({
      unpriced: 0,
      mixedCurrencies: false,
    });
    expect(answer.body.headline.taskToMerge.count).toBe(1);
    expect(answer.body.people).toEqual([
      { personId: team.owner.value, name: 'Ada' },
    ]);
  });

  it('lays the run and its merge out by day, against an empty period before', async () => {
    const answer = await asOwner(insights('overview'));
    const output: {
      runs: number;
      spend: unknown;
      mergedTaskIds: string[];
    }[] = answer.body.output;

    expect(output).toHaveLength(7);
    expect(output.filter((each) => each.runs > 0)).toEqual([
      expect.objectContaining({
        runs: 1,
        spend: { amount: 1.25, currency: 'USD' },
        unpriced: 0,
      }),
    ]);
    expect(output.flatMap((each) => each.mergedTaskIds)).toEqual([TASK.value]);
    expect(answer.body.outputCurrency).toBe('USD');
    expect(answer.body.outputMixedCurrencies).toBe(false);
    expect(answer.body.changes.mergedPullRequests).toMatchObject({
      fromZero: true,
    });
    expect(answer.body.changes.activePeople).toMatchObject({ fromZero: true });
  });

  it('answers a workspace token with the read scope', async () => {
    const token = await issued(team, ['read']);

    const answer = await bearing(insights('runs'), token);

    expect(answer.status).toBe(200);
    expect(answer.body.total).toBe(1);
    expect(answer.body.runs[0]).toMatchObject({
      runId: RUN.value,
      taskId: TASK.value,
      stationId: team.stationId.value,
      harness: 'claude-code',
      model: 'sonnet',
      repositories: ['acme/api'],
      openedBy: team.owner.value,
      queuedMs: 2 * MINUTE,
      cost: { amount: 1.25, currency: 'USD' },
      ending: 'completed',
      next: { act: 'answered' },
      handedOn: { to: NEXT },
      delivery: 'merged',
    });
    expect(answer.body.people).toEqual([
      { personId: team.owner.value, name: 'Ada' },
    ]);
  });

  it('finds no team for a token of another workspace, nor for a stranger', async () => {
    const token = await issued(elsewhere, ['read']);

    expect((await bearing(insights('overview'), token)).status).toBe(404);
    expect(
      (
        await served(app)
          .get(insights('overview'))
          .set(TEST_USER_HEADER, elsewhere.owner.value)
      ).status,
    ).toBe(404);
  });

  it('refuses a token it does not know, and a caller with none', async () => {
    expect((await bearing(insights('overview'), 'not-a-token')).status).toBe(
      401,
    );
    expect((await served(app).get(insights('overview'))).status).toBe(401);
  });

  it('refuses a period it does not look back over, and more than one period', async () => {
    const unknown = await asOwner(insights('overview', 'period=14d'));

    expect(unknown.status).toBe(422);
    expect(JSON.stringify(unknown.body)).not.toContain('14d');
    expect(
      (await asOwner(insights('overview', 'period=7d&period=30d'))).status,
    ).toBe(422);
  });

  it('compares the team’s setups against what they cost, narrowed by station and run size, with judge scores only for one station', async () => {
    const token = await issued(team, ['read']);

    const all = await bearing(insights('setups'), token);
    const medium = await asOwner(
      insights(
        'setups',
        `period=7d&stationId=${team.stationId.value}&size=medium`,
      ),
    );
    const small = await asOwner(insights('setups', 'period=7d&size=small'));

    expect(all.status).toBe(200);
    expect(all.body.setups).toEqual([
      expect.objectContaining({
        harness: 'claude-code',
        model: 'sonnet',
        effort: 'high',
        profileKey: null,
        costPerRun: 1.25,
        currency: 'USD',
        judge: null,
        frontier: [],
      }),
    ]);
    expect(all.body.judgeOmitted).toBe('no_station');
    expect(medium.body.judgeOmitted).toBeNull();
    expect(medium.body.setups[0].judge).toEqual({ mean: null, judged: 0 });
    expect(all.body.sizes.map((each: { size: string }) => each.size)).toEqual([
      'small',
      'medium',
      'large',
    ]);
    expect(medium.body.setups).toHaveLength(1);
    expect(small.body.setups).toEqual([]);
    expect((await asOwner(insights('setups', 'size=huge'))).status).toBe(422);
  });

  it('shows no config change while each station ran one config', async () => {
    const answer = await asOwner(insights('changes'));

    expect(answer.status).toBe(200);
    expect(answer.body.markers).toEqual([]);
    expect(answer.body.judges).toEqual([]);
  });

  it('sets runs with memories against runs without, with no benchmark yet', async () => {
    const answer = await asOwner(insights('memory'));

    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({
      activeCount: 0,
      memoriesBriefed: 0,
      flagged: [],
      benchmark: null,
    });
    expect(answer.body.withMemories.runs).toBe(0);
    expect(answer.body.withoutMemories.runs).toBe(1);
  });

  it('narrows the runs by what the page drills down with', async () => {
    const atStation = await asOwner(
      insights('runs', `period=7d&stationId=${team.stationId.value}`),
    );
    const elsewhereStation = await asOwner(
      insights('runs', `period=7d&stationId=${NEXT}`),
    );
    const failed = await asOwner(insights('runs', 'period=7d&outcome=failed'));

    expect(atStation.body.total).toBe(1);
    expect(elsewhereStation.body.total).toBe(0);
    expect(failed.body.total).toBe(0);
  });

  it('drills down by delivery, next act, inbox asks, tasks, the harness’s own model and no repository', async () => {
    const total = async (query: string) =>
      (await asOwner(insights('runs', `period=7d&${query}`))).body.total;

    expect(await total('delivery=merged')).toBe(1);
    expect(await total('delivery=open')).toBe(0);
    expect(await total('next=answered')).toBe(1);
    expect(await total('asked=true')).toBe(1);
    expect(await total(`taskIds=${randomUUID()},${TASK.value}`)).toBe(1);
    expect(await total(`taskIds=${randomUUID()}`)).toBe(0);
    expect(await total('model=~default')).toBe(0);
    expect(await total('model=sonnet')).toBe(1);
    expect(await total('repository=none')).toBe(0);
    expect(await total('repository=acme/api')).toBe(1);
    expect(await total(`personId=${team.owner.value}`)).toBe(1);
  });

  it('refuses a drill-down it cannot read: an unknown value, one asked twice, a day outside the period, or a page past the last', async () => {
    const status = async (query: string) =>
      (await asOwner(insights('runs', `period=7d&${query}`))).status;
    const today = new Date().toISOString().slice(0, 10);

    expect(await status('outcome=exploded')).toBe(422);
    expect(await status('delivery=shipped')).toBe(422);
    expect(await status('next=shrugged')).toBe(422);
    expect(await status('next=refused')).toBe(422);
    expect(await status('asked=yes')).toBe(422);
    expect(await status('stationId=a&stationId=b')).toBe(422);
    expect(await status('day=2026-02-30')).toBe(422);
    expect(await status('day=2000-01-01')).toBe(422);
    expect(await status(`day=${today}`)).toBe(200);
    expect(await status('page=2')).toBe(422);
    expect(await status('page=1')).toBe(200);
    expect(await status('page=10001')).toBe(422);
  });

  it('drills down by the skills and MCP servers a run used, and the tools a person refused', async () => {
    const total = async (query: string) =>
      (await asOwner(insights('runs', `period=7d&${query}`))).body.total;
    const ended = new Date(NOW - 240 * MINUTE);
    const monday = new Date(
      Date.UTC(
        ended.getUTCFullYear(),
        ended.getUTCMonth(),
        ended.getUTCDate() - ((ended.getUTCDay() + 6) % 7),
      ),
    )
      .toISOString()
      .slice(0, 10);

    expect(await total('skillGiven=grafana')).toBe(1);
    expect(await total('skillUsed=grafana')).toBe(1);
    expect(await total('skillUsed=our-migrations')).toBe(0);
    expect(await total('server=linear')).toBe(1);
    expect(await total('server=sentry')).toBe(0);
    expect(await total('serverFailed=linear')).toBe(1);
    expect(await total('failedAfter=linear')).toBe(0);
    expect(await total('refusedTool=create_issue')).toBe(1);
    expect(await total('refusedServer=linear')).toBe(1);
    expect(await total('refusedServer=linear&refusedTool=create_issue')).toBe(
      1,
    );
    expect(await total('refusedServer=jira&refusedTool=create_issue')).toBe(0);
    expect(await total(`week=${monday}`)).toBe(1);

    const tuesday = new Date(
      Date.parse(`${monday}T00:00:00Z`) + 24 * 60 * MINUTE,
    )
      .toISOString()
      .slice(0, 10);

    for (const week of ['yesterday', '2026-02-30', tuesday]) {
      expect(
        (await asOwner(insights('runs', `period=7d&week=${week}`))).status,
      ).toBe(422);
    }
  });

  it('shows which skills runs were given and read, and how each MCP server behaved', async () => {
    const answer = await asOwner(insights('tools'));

    expect(answer.status).toBe(200);
    expect(answer.body.runs).toBe(1);
    expect(answer.body.trendRule).toEqual({
      recentWeeks: 2,
      minRuns: 5,
      shiftPoints: 20,
    });
    expect(answer.body.skills).toEqual([
      expect.objectContaining({
        key: 'grafana',
        given: 1,
        used: 1,
        trend: null,
        stations: [
          expect.objectContaining({
            stationId: team.stationId.value,
            given: 1,
            used: 1,
          }),
        ],
      }),
    ]);
    expect(answer.body.servers).toEqual([
      {
        server: 'linear',
        runs: 1,
        calls: 3,
        callsPerRun: 3,
        p50Ms: 316,
        p95Ms: 707,
        failedCalls: 1,
        errorRate: 1 / 3,
        failingRuns: 0,
        refused: 1,
      },
    ]);
    expect(answer.body.refusals).toEqual([
      { tool: 'create_issue', server: 'linear', refused: 1 },
    ]);
  });

  it('refuses to drill down by more than two hundred tasks at once', async () => {
    const many = Array.from({ length: 201 }, () => randomUUID()).join(',');

    expect(
      (await asOwner(insights('runs', `period=7d&taskIds=${many}`))).status,
    ).toBe(422);
  });

  it('tallies a station on the Stations tab as its Station page does, for the same runs', async () => {
    const page = await asOwner(
      `/api/teams/${team.teamId.value}/lines/${team.line.id.value}/stations/${team.stationId.value}/outcomes`,
    );
    const tab = await asOwner(insights('stations'));

    expect(page.status).toBe(200);
    expect(page.body.groups).toHaveLength(1);
    expect(page.body.groups[0].runs).toHaveLength(1);
    expect(tab.body.stations[0].tally).toEqual(page.body.groups[0].tally);
  });

  it('shows each station’s tally and its task failures apart from its run failures', async () => {
    const answer = await asOwner(insights('stations'));

    expect(answer.status).toBe(200);
    expect(answer.body.stations[0]).toMatchObject({
      stationId: team.stationId.value,
      tally: {
        runs: 1,
        accepted: 0,
        sentBack: 0,
        handedOn: 1,
        merged: 1,
        medianMs: 58 * MINUTE,
      },
      taskFailures: [
        {
          source: 'hook:notify',
          code: 'loop',
          occurrences: 2,
          maxInARow: 2,
          taskIds: [TASK.value],
        },
      ],
      runFailures: [],
    });
    expect(answer.body.stations[0].trend).toHaveLength(7);
    expect(answer.body.stations[0].seen).toEqual({
      accepted: false,
      sentBack: false,
      merged: true,
    });
    expect(answer.body.teamTrend).toHaveLength(7);
  });

  it('shows where the task waited, on to its merge', async () => {
    const answer = await asOwner(insights('flow'));

    expect(answer.status).toBe(200);
    expect(answer.body.flow.stations[0]).toMatchObject({
      stationId: team.stationId.value,
      tasks: 1,
      queued: { p50Ms: 2 * MINUTE, count: 1 },
      inbox: { p50Ms: 30 * MINUTE, count: 1 },
      asks: 1,
      unanswered: 0,
    });
    expect(answer.body.flow.delivery).toMatchObject({
      toPullRequest: { p50Ms: 180 * MINUTE, count: 1 },
      toFirstReview: { p50Ms: 60 * MINUTE, count: 1 },
      toMerge: { p50Ms: 60 * MINUTE, count: 1 },
    });
  });

  it('shows what the work asks of people and who uses it, calling nobody new who set the team up long before', async () => {
    const answer = await asOwner(insights('people'));

    expect(answer.status).toBe(200);
    expect(answer.body.load).toMatchObject({
      asks: 1,
      tasks: 1,
      toAnswer: { p50Ms: 30 * MINUTE, count: 1 },
    });
    expect(answer.body.adoption).toMatchObject({
      activeCount: 1,
      newAdopterCount: 0,
      weeklyCount: 1,
      monthlyCount: 1,
      stickiness: 1,
    });
    expect(answer.body.adoption.people[0]).toMatchObject({
      name: 'Ada',
      tasksOpened: 1,
      acts: 2,
      chats: 1,
      isNew: false,
      firstSeenAt: '2026-01-02T03:04:05.000Z',
    });
  });

  it('splits spend by model, station and repository', async () => {
    const answer = await asOwner(insights('cost'));

    expect(answer.status).toBe(200);
    expect(answer.body.cost.cache).toEqual({
      input: 2_000,
      cacheRead: 90_000,
      cacheWrite: null,
      cacheShare: 90_000 / 92_000,
    });
    expect(answer.body.cost.cacheByStation).toEqual([
      {
        stationId: team.stationId.value,
        input: 2_000,
        cacheRead: 90_000,
        cacheWrite: null,
        cacheShare: 90_000 / 92_000,
      },
    ]);
    expect(answer.body.cost).toMatchObject({
      spend: { amount: 1.25, currency: 'USD' },
      unpriced: 0,
      mixedCurrencies: false,
      byModel: [{ key: 'sonnet', amount: 1.25, runs: 1 }],
      byRepository: [{ key: 'acme/api', amount: 1.25, runs: 1 }],
      links: [
        {
          source: 'model:sonnet',
          target: `station:${team.stationId.value}`,
          amount: 1.25,
        },
        {
          source: `station:${team.stationId.value}`,
          target: 'repository:acme/api',
          amount: 1.25,
        },
      ],
    });
  });
});

describe('the team’s Tools tab and its drill-downs (e2e)', () => {
  const total = async (query: string) =>
    (await asOwner(insights('runs', `period=7d&${query}`))).body
      .total as number;

  it('leaves a run withdrawn before it ran out of the runs given a skill, as the tab does', async () => {
    const withdrawn = RunId.of(randomUUID());
    const task = TaskId.of(randomUUID());

    await db.insert(schema.run).values({
      id: withdrawn.value,
      workspaceId: team.workspaceId.value,
      harness: 'dev',
      taskId: task.value,
      taskRevision: 0,
      stationId: team.stationId.value,
      state: 'failed',
      spec: SPEC,
      stationFingerprint: CONFIG,
      stationConfig: {
        prompt: 'Implement the task.',
        harness: 'claude-code',
        model: 'sonnet',
        effort: 'high',
        profile: null,
        image: null,
        repositories: [],
        skills: [{ key: 'grafana', digest: 'd'.repeat(64) }],
        tools: [],
        decisions: false,
        memories: false,
      },
      createdAt: ago(120),
      endedAt: ago(119),
    });
    const ended: RunEndedIntegrationEvent = {
      kind: RUN_ENDED,
      runId: withdrawn.value,
      workspaceId: team.workspaceId.value,
      taskId: task.value,
      stationId: team.stationId.value,
      outcome: 'withdrawn',
      failure: null,
      stopped: false,
      asked: false,
    };

    await app.get(EventOutbox).record([ended]);
    await eventually(async () => {
      await app.get(EventDelivery).drain(2_000);
      return (await app.get(DrizzleRunRecordRepository).of(withdrawn))
        ?.hasEnded;
    }, 60_000);

    const record = await app.get(DrizzleRunRecordRepository).of(withdrawn);

    expect(record?.ending).toBe('withdrawn');
    expect(record?.end?.setup.skills).toEqual(['grafana']);

    const tools = await asOwner(insights('tools'));

    expect(tools.body.skills).toEqual([
      expect.objectContaining({ key: 'grafana', given: 1 }),
    ]);
    expect(await total('skillGiven=grafana')).toBe(1);
  });

  const seeded = async (seed: {
    readonly outcome: 'completed' | 'failed';
    readonly superseded?: boolean;
    readonly servers: readonly ServerCalls[];
    readonly refused: readonly CalledTool[];
  }) => {
    const runId = RunId.of(randomUUID());
    const task = TaskId.of(randomUUID());

    await db.insert(schema.run).values({
      id: runId.value,
      workspaceId: team.workspaceId.value,
      harness: 'dev',
      taskId: task.value,
      taskRevision: 0,
      stationId: team.stationId.value,
      state: seed.outcome,
      spec: SPEC,
      stationFingerprint: CONFIG,
      stationConfig: {
        prompt: 'Implement the task.',
        harness: 'claude-code',
        model: 'sonnet',
        effort: 'high',
        profile: null,
        image: null,
        repositories: [],
        skills: [],
        tools: [],
        decisions: false,
        memories: false,
      },
      createdAt: ago(100),
      startedAt: ago(99),
      endedAt: ago(90),
    });

    const ended: RunEndedIntegrationEvent = {
      kind: RUN_ENDED,
      runId: runId.value,
      workspaceId: team.workspaceId.value,
      taskId: task.value,
      stationId: team.stationId.value,
      outcome: seed.outcome,
      failure: seed.outcome === 'failed' ? 'exited' : null,
      stopped: false,
      asked: false,
    };
    const superseded: RunSupersededIntegrationEvent = {
      kind: RUN_SUPERSEDED,
      runId: runId.value,
      workspaceId: team.workspaceId.value,
      taskId: task.value,
    };

    await app
      .get(EventOutbox)
      .record([
        ended,
        new RunDigested(
          runId,
          team.workspaceId,
          task,
          MINUTE,
          4,
          0,
          0,
          null,
          null,
          null,
          Tokens.UNREPORTED,
          ToolUse.of({ servers: seed.servers, skills: [] }),
        ),
        ...seed.refused.map(
          (tool, at) =>
            new TaskActedOn(
              task,
              team.workspaceId,
              team.stationId,
              'refused',
              team.owner,
              runId,
              ago(80 - at),
              tool,
            ),
        ),
        ...(seed.superseded ? [superseded] : []),
      ]);
    await eventually(async () => {
      await app.get(EventDelivery).drain(2_000);
      const record = await app.get(DrizzleRunRecordRepository).of(runId);

      return (
        record?.hasEnded === true &&
        record.cost !== null &&
        record.refusals.length === seed.refused.length &&
        record.superseded === (seed.superseded ?? false)
      );
    }, 60_000);
  };

  it('counts on the tab exactly the runs each drill-down lists', async () => {
    const jira = (calls: number, timed: number[]): ServerCalls => ({
      server: 'jira',
      calls,
      failed: Math.max(calls - timed.length, 1),
      latency: LatencyHistogram.timing(timed),
      lastCallFailed: true,
    });
    const createIssue = CalledTool.of({
      server: 'linear',
      tool: 'create_issue',
    });

    await seeded({ outcome: 'failed', servers: [jira(2, [300])], refused: [] });
    await seeded({
      outcome: 'failed',
      superseded: true,
      servers: [jira(1, [])],
      refused: [],
    });
    await seeded({
      outcome: 'completed',
      servers: [],
      refused: [
        createIssue,
        createIssue,
        CalledTool.of({ server: 'linear', tool: 'comment' }),
      ],
    });
    await seeded({
      outcome: 'completed',
      servers: [],
      refused: [CalledTool.of({ server: null, tool: 'github.merge' })],
    });

    const tools = (await asOwner(insights('tools'))).body as {
      servers: {
        server: string;
        runs: number;
        failingRuns: number;
        refused: number;
      }[];
      skills: { key: string; given: number; used: number }[];
      refusals: { tool: string; server: string | null; refused: number }[];
    };

    expect(tools.skills.length).toBeGreaterThan(0);
    expect(tools.servers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ server: 'jira', runs: 2, failingRuns: 1 }),
        expect.objectContaining({ server: 'linear', refused: 2 }),
      ]),
    );
    expect(tools.refusals).toEqual(
      expect.arrayContaining([
        { tool: 'create_issue', server: 'linear', refused: 2 },
        { tool: 'comment', server: 'linear', refused: 1 },
        { tool: 'github.merge', server: null, refused: 1 },
      ]),
    );

    for (const server of tools.servers) {
      expect(await total(`server=${server.server}`)).toBe(server.runs);
      expect(await total(`failedAfter=${server.server}`)).toBe(
        server.failingRuns,
      );
      expect(await total(`refusedServer=${server.server}`)).toBe(
        server.refused,
      );
    }
    for (const refusal of tools.refusals) {
      expect(
        await total(
          `refusedTool=${encodeURIComponent(refusal.tool)}&refusedServer=${refusal.server ?? 'none'}`,
        ),
      ).toBe(refusal.refused);
    }
    for (const skill of tools.skills) {
      expect(await total(`skillUsed=${skill.key}`)).toBe(skill.used);
      expect(await total(`skillGiven=${skill.key}`)).toBe(skill.given);
    }
  });
});
