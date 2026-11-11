import { randomUUID } from 'node:crypto';

import { PullRequestUpdated } from '@github/domain/events/pull-request-updated.event';
import { DrizzlePullRequestRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/pull-request-record.repository';
import { DrizzleRunRecordRepository } from '@insights/infrastructure/persistence/drizzle/repositories/run-record.repository';
import { DrizzleTaskFailuresRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-failures.repository';
import { DrizzleTaskHumanActionsRepository } from '@insights/infrastructure/persistence/drizzle/repositories/task-human-actions.repository';
import type {
  InsightsAgentConfigsResponseDto,
  InsightsChangesResponseDto,
} from '@insights/presentation/http/dto/insights-changes.response.dto';
import type { InsightsCostResponseDto } from '@insights/presentation/http/dto/insights-cost.response.dto';
import type { InsightsFlowResponseDto } from '@insights/presentation/http/dto/insights-flow.response.dto';
import type { InsightsMemoryResponseDto } from '@insights/presentation/http/dto/insights-memory.response.dto';
import type { InsightsOverviewResponseDto } from '@insights/presentation/http/dto/insights-overview.response.dto';
import type { InsightsPeopleResponseDto } from '@insights/presentation/http/dto/insights-people.response.dto';
import type { InsightsStationsResponseDto } from '@insights/presentation/http/dto/insights-stations.response.dto';
import type { InsightsToolsResponseDto } from '@insights/presentation/http/dto/insights-tools.response.dto';
import type { InsightsTracesResponseDto } from '@insights/presentation/http/dto/insights-traces.response.dto';
import type { StationInsightsResponseDto } from '@insights/presentation/http/dto/station-insights.response.dto';
import type { INestApplication } from '@nestjs/common';
import { EventDelivery } from '@platform/events/event-delivery';
import { EventOutbox } from '@platform/events/event-outbox';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { RunUsageRecorded } from '@runs/domain/events/run-usage-recorded.event';
import { Money } from '@runs/domain/value-objects/money.vo';
import { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
import { Tokens } from '@runs/domain/value-objects/tokens.vo';
import {
  type ServerCalls,
  ToolUse,
} from '@runs/domain/value-objects/tool-use.vo';
import {
  DISPATCH_ENDED,
  type DispatchEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/dispatch-ended.integration-event';
import {
  DISPATCH_SUPERSEDED,
  type DispatchSupersededIntegrationEvent,
} from '@shared-kernel/application/integration-events/dispatch-superseded.integration-event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { ChatStarted } from '@work/domain/events/chat-started.event';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskFailed } from '@work/domain/events/task-failed.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import { TaskPassed } from '@work/domain/events/task-passed.event';
import { CalledTool } from '@work/domain/value-objects/called-tool.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openApp, served, TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import { endingFor } from './support/run-ended';
import { aDispatch, requestedByTask } from './support/runs';
import * as schema from './support/schema';
import { createTeam } from './support/team';

const TOKEN_HEADER = 'spotlight-workspace-token';
const CONFIG = 'a'.repeat(64);
const PULL = 'https://github.com/acme/api/pull/42';
const MINUTE = 60_000;

const taskRequester = (task: TaskId): RunRequester =>
  RunRequester.of({
    owner: 'work',
    kind: 'task',
    id: task.value,
    token: '0',
    team: null,
  });

const SPEC = {
  command: { executable: 'sh', args: [] },
  briefing: 'do the thing',
  handover: { options: [], noteLimit: 0 },
  resume: {},
};

const NOW = Date.now();

const ago = (minutes: number) => new Date(NOW - minutes * MINUTE);

let app: INestApplication;
let db: DrizzleDatabase;
let team: Awaited<ReturnType<typeof createTeam>>;
let elsewhere: Awaited<ReturnType<typeof createTeam>>;
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
  of: Awaited<ReturnType<typeof createTeam>>,
  scopes: readonly string[],
): Promise<string> => {
  const answer = await served(app)
    .post(`/api/v1/resources/workspaces/${of.workspaceId.value}/tokens`)
    .set(TEST_USER_HEADER, of.owner.value)
    .set('Idempotency-Key', randomUUID())
    .send({ name: `insights-${randomUUID().slice(0, 6)}`, scopes });

  expect(answer.status).toBe(201);

  return answer.headers[TOKEN_HEADER];
};

beforeAll(async () => {
  app = await openApp();
  db = app.get(DRIZZLE);
  const tasks = app.get(DrizzleTaskRepository);
  team = await createTeam(db, tasks, `insights-${randomUUID().slice(0, 8)}`);
  elsewhere = await createTeam(
    db,
    tasks,
    `elsewhere-${randomUUID().slice(0, 8)}`,
  );
  const station = team.stationId;
  const workspaceId = team.workspaceId;

  await db.insert(schema.task).values({
    id: TASK.value,
    branch: `feat/test-${TASK.value}`,
    openedFrom: 'person',
    workspaceId: workspaceId.value,
    stationId: team.stationId.value,
    title: 'Fix the queue',
  });
  await db.insert(schema.run).values({
    id: RUN.value,
    workspaceId: workspaceId.value,
    harness: 'dev',
    ...requestedByTask(TASK.value, { teamId: team.teamId.value }),
    state: 'completed',
    spec: SPEC,
    createdAt: ago(300),
    startedAt: ago(298),
    ...endingFor('completed', ago(240)),
  });
  await db.insert(schema.dispatch).values(
    aDispatch({
      runId: RUN.value,
      workspaceId: workspaceId.value,
      teamId: team.teamId.value,
      taskId: TASK.value,
      stationId: team.stationId.value,
      fingerprint: CONFIG,
      config: {
        prompt: 'Implement the task.',
        harness: 'claude-code',
        model: 'sonnet',
        effort: 'high',
        profile: null,
        image: null,
        repositories: [{ name: 'acme/api', setup: null }],
        skills: [{ key: 'grafana', hash: 'd'.repeat(64) }],
        tools: [],
        decisions: false,
        memories: false,
      },
      orderedAt: ago(300),
      endedAt: ago(240),
    }),
  );

  const ended: DispatchEndedIntegrationEvent = {
    kind: DISPATCH_ENDED,
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
  const taskPullRequest = async () =>
    (
      await app
        .get(DrizzlePullRequestRecordRepository)
        .at(workspaceId, PullRequestUrl.of(PULL))
    )?.forTask ?? null;
  const updated = (version: number, merged: boolean) =>
    new PullRequestUpdated(workspaceId, {
      pullRequest: PullRequestUrl.of(PULL),
      repository: { value: 'acme/api' },
      number: 7,
      title: 'Retry failed uploads',
      author: 'grace',
      authorIsBot: false,
      branch: null,
      additions: 1,
      deletions: 1,
      changedFiles: 1,
      openedAt: ago(180),
      state: merged ? 'merged' : 'open',
      closedAt: merged ? ago(60) : null,
      updatedAt: merged ? ago(60) : ago(120),
      readyForReviewAt: ago(180),
      draftPeriods: [],
      reviews: [
        {
          id: 1,
          state: 'approved',
          login: 'ada',
          byBot: false,
          at: ago(120),
        },
      ],
      dismissedReviews: [],
      reviewComments: 0,
      botComments: [],
      threads: [],
      isRevert: false,
      revertedBy: null,
      version,
    } as never);
  const humanActions = () =>
    app.get(DrizzleTaskHumanActionsRepository).of(TASK);
  const failures = () => app.get(DrizzleTaskFailuresRepository).of(TASK);
  const delivered = async (
    events: readonly DomainEvent[],
    check: () => Promise<unknown>,
  ) => {
    await app.get(EventOutbox).record(events);
    await eventually(async () => {
      await app.get(EventDelivery).drain(2_000);
      return check();
    }, 60_000);
  };

  await delivered(
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
    async () => (await humanActions())?.opening,
  );
  await delivered([ended], async () => (await record())?.hasEnded);
  await delivered(
    [
      new RunUsageRecorded(
        RUN,
        workspaceId,
        taskRequester(TASK),
        true,
        RunAttempt.of(RUN, 1),
        58 * MINUTE,
        30,
        1,
        120,
        50_000,
        200_000,
        Money.of(1.25, 'USD'),
        [Money.of(1.25, 'USD')],
        0,
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
    async () => (await record())?.usage,
  );
  await delivered(
    [
      new TaskPassed(
        TASK,
        workspaceId,
        RUN,
        station,
        StationId.of(NEXT),
        ago(240),
      ),
    ],
    async () => (await record())?.passed,
  );
  await delivered(
    [new TaskAsked(TASK, workspaceId, station, team.owner, ago(230))],
    async () => (await humanActions())?.asks.length === 1,
  );
  await delivered(
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
    async () =>
      (await record())?.firstHumanAction &&
      (await humanActions())?.actions.length === 1,
  );
  await delivered(
    [
      new TaskActedOn(
        TASK,
        workspaceId,
        station,
        'dismissed',
        team.owner,
        RUN,
        ago(150),
        CalledTool.of({ server: 'linear', tool: 'create_issue' }),
      ),
    ],
    async () => (await record())?.dismissals.length === 1,
  );
  await delivered(
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
  await delivered(
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
  await delivered(
    [
      new PullRequestOpened(
        TASK,
        workspaceId,
        team.teamId,
        PullRequestUrl.of(PULL),
        ago(180),
      ),
    ],
    taskPullRequest,
  );
  await delivered(
    [updated(1, false)],
    async () => (await taskPullRequest())?.firstReviewAt,
  );
  await delivered(
    [updated(2, true)],
    async () => (await taskPullRequest())?.state === 'merged',
  );
  await delivered(
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

describe('what the insights context receives for a team (e2e)', () => {
  it('stores on its record the run’s usage, agent config, waits and the station it passed the task to', async () => {
    const record = await app.get(DrizzleRunRecordRepository).of(RUN);

    expect(record?.end?.ending).toBe('completed');
    expect(record?.usage?.spend).toEqual({ amount: 1.25, currency: 'USD' });
    expect(record?.usage?.tokens).toEqual({
      input: 2_000,
      output: 1_000,
      cacheRead: 90_000,
      cacheWrite: null,
    });
    expect(record?.passed?.to.value).toBe(NEXT);
    expect(record?.firstHumanAction?.kind).toBe('answered');
    expect(record?.end?.agentConfig).toMatchObject({
      harness: 'claude-code',
      model: 'sonnet',
      effort: 'high',
      repositories: ['acme/api'],
      skills: ['grafana'],
    });
    expect(record?.dismissals.map((each) => [each.server, each.tool])).toEqual([
      ['linear', 'create_issue'],
    ]);
    expect(
      record?.tools?.servers.find((each) => each.server === 'linear')?.latency,
    ).toEqual(LatencyHistogram.timing([200, 400, 900]));
  });

  it('reads the tools a run used with each record it reads at once', async () => {
    const [record] = await app.get(DrizzleRunRecordRepository).ofRuns([RUN]);

    expect(
      record?.tools?.servers.find((each) => each.server === 'linear')?.latency,
    ).toEqual(LatencyHistogram.timing([200, 400, 900]));
    expect(record?.tools?.skillsRead.includes('grafana')).toBe(true);
    expect(record?.end?.queuedMs).toBe(2 * MINUTE);
  });

  it('dates the task’s pull request from opening to first review to merge', async () => {
    const taskPullRequest = (
      await app
        .get(DrizzlePullRequestRecordRepository)
        .at(team.workspaceId, PullRequestUrl.of(PULL))
    )?.forTask;

    expect(taskPullRequest?.state).toBe('merged');
    expect(taskPullRequest?.firstReviewAt).not.toBeNull();
    expect(taskPullRequest?.openedAt.getTime()).toBeLessThan(
      taskPullRequest?.firstReviewAt?.getTime() ?? 0,
    );
  });

  it('stores who opened the task, what it asked and every failure raised on it', async () => {
    const humanActions = await app
      .get(DrizzleTaskHumanActionsRepository)
      .of(TASK);
    const failures = await app.get(DrizzleTaskFailuresRepository).of(TASK);

    expect(humanActions?.opening?.by?.equals(team.owner)).toBe(true);
    expect(humanActions?.opening?.teamId.equals(team.teamId)).toBe(true);
    expect(humanActions?.asks).toHaveLength(1);
    expect(
      humanActions?.actions.some((each) => each.by.equals(team.owner)),
    ).toBe(true);
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
    const body = answer.body as InsightsOverviewResponseDto;

    expect(answer.status).toBe(200);
    expect(body.period.name).toBe('7d');
    expect(body.headline).toMatchObject({
      spend: { amount: 1.25, currency: 'USD' },
      runs: 1,
      tasks: 1,
      mergedPullRequests: 1,
      mergeRate: 1,
      costPerMerge: { amount: 1.25, currency: 'USD' },
      humanActions: 2,
      humanActionsPerTask: 2,
      activePeople: 1,
      mergedTaskIds: [TASK.value],
    });
    expect(body.headline).toMatchObject({
      unpriced: 0,
      mixedCurrencies: false,
    });
    expect(body.headline.taskToMerge.count).toBe(1);
    expect(body.people).toEqual([{ personId: team.owner.value, name: 'Ada' }]);
  });

  it('lays the run and its merge out by day, against an empty period before', async () => {
    const answer = await asOwner(insights('overview'));
    const body = answer.body as InsightsOverviewResponseDto;
    const { output } = body;

    expect(output).toHaveLength(7);
    expect(output.filter((each) => each.runs > 0)).toEqual([
      expect.objectContaining({
        runs: 1,
        spend: { amount: 1.25, currency: 'USD' },
        unpriced: 0,
      }),
    ]);
    expect(output.flatMap((each) => each.mergedTaskIds)).toEqual([TASK.value]);
    expect(body.outputCurrency).toBe('USD');
    expect(body.outputMixedCurrencies).toBe(false);
    expect(body.changes.mergedPullRequests).toMatchObject({
      fromZero: true,
    });
    expect(body.changes.activePeople).toMatchObject({ fromZero: true });
  });

  it('answers a workspace token with the read scope', async () => {
    const token = await issued(team, ['read']);

    const answer = await bearing(insights('traces', 'range=7d'), token);
    const body = answer.body as InsightsTracesResponseDto;

    expect(answer.status).toBe(200);
    expect(body.matched).toBe(1);
    expect(body.traces[0]).toMatchObject({
      taskId: TASK.value,
      title: 'Fix the queue',
      total: 1,
      cost: { amount: 1.25, currency: 'USD' },
    });
    expect(body.traces[0].runs[0]).toMatchObject({
      runId: RUN.value,
      station: { stationId: team.stationId.value },
      harness: 'claude-code',
      model: 'sonnet',
      openedBy: team.owner.value,
      cost: { amount: 1.25, currency: 'USD' },
      ending: 'completed',
      progress: null,
    });
    expect(body.people).toEqual([{ personId: team.owner.value, name: 'Ada' }]);
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

  it('does not accept a token it does not know, or a caller with none', async () => {
    expect((await bearing(insights('overview'), 'not-a-token')).status).toBe(
      401,
    );
    expect((await served(app).get(insights('overview'))).status).toBe(401);
  });

  it('rejects a period it does not look back over, and more than one period', async () => {
    const unknown = await asOwner(insights('overview', 'period=14d'));

    expect(unknown.status).toBe(422);
    expect(JSON.stringify(unknown.body)).not.toContain('14d');
    expect(
      (await asOwner(insights('overview', 'period=7d&period=30d'))).status,
    ).toBe(422);
  });

  it('compares the team’s agent configs against what they cost, narrowed by station and run size, with judge scores only for one station', async () => {
    const token = await issued(team, ['read']);

    const answer = await bearing(insights('agent-configs'), token);
    const all = answer.body as InsightsAgentConfigsResponseDto;
    const medium = (
      await asOwner(
        insights(
          'agent-configs',
          `period=7d&stationId=${team.stationId.value}&size=medium`,
        ),
      )
    ).body as InsightsAgentConfigsResponseDto;
    const small = (
      await asOwner(insights('agent-configs', 'period=7d&size=small'))
    ).body as InsightsAgentConfigsResponseDto;

    expect(answer.status).toBe(200);
    expect(all.agentConfigs).toEqual([
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
    expect(all.judgeOmitted).toBe('no_station');
    expect(medium.judgeOmitted).toBeNull();
    expect(medium.agentConfigs[0].judge).toEqual({
      mean: null,
      judged: 0,
    });
    expect(all.sizes.map((each) => each.size)).toEqual([
      'small',
      'medium',
      'large',
    ]);
    expect(medium.agentConfigs).toHaveLength(1);
    expect(small.agentConfigs).toEqual([]);
    expect((await asOwner(insights('agent-configs', 'size=huge'))).status).toBe(
      422,
    );
  });

  it('shows no config change while each station ran one config', async () => {
    const answer = await asOwner(insights('changes'));
    const body = answer.body as InsightsChangesResponseDto;

    expect(answer.status).toBe(200);
    expect(body.markers).toEqual([]);
    expect(body.judges).toEqual([]);
  });

  it('sets runs with memories against runs without', async () => {
    const answer = await asOwner(insights('memory'));
    const body = answer.body as InsightsMemoryResponseDto;

    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({
      activeCount: 0,
      memoriesBriefed: 0,
      flagged: [],
    });
    expect(answer.body).not.toHaveProperty('benchmark');
    expect(body.withMemories.runs).toBe(0);
    expect(body.withoutMemories.runs).toBe(1);
  });

  it('narrows the runs by what the page drills down with', async () => {
    const atStation = await asOwner(
      insights('traces', `range=7d&stationId=${team.stationId.value}`),
    );
    const elsewhereStation = await asOwner(
      insights('traces', `range=7d&stationId=${NEXT}`),
    );
    const failed = await asOwner(insights('traces', 'range=7d&outcome=failed'));

    expect((atStation.body as InsightsTracesResponseDto).matched).toBe(1);
    expect((elsewhereStation.body as InsightsTracesResponseDto).matched).toBe(
      0,
    );
    expect((failed.body as InsightsTracesResponseDto).matched).toBe(0);
  });

  it('drills down by pull request state, human action, resolution, inbox asks, tasks, the harness’s own model and no repository', async () => {
    const total = async (query: string) =>
      (
        (await asOwner(insights('traces', `range=7d&${query}`)))
          .body as InsightsTracesResponseDto
      ).matched;

    expect(await total('pullRequestState=merged')).toBe(1);
    expect(await total('pullRequestState=open')).toBe(0);
    expect(await total('humanAction=answered')).toBe(1);
    expect(await total('resolution=moved-on')).toBe(1);
    expect(await total('resolution=accepted')).toBe(0);
    expect(await total('asked=true')).toBe(1);
    expect(await total(`taskIds=${randomUUID()},${TASK.value}`)).toBe(1);
    expect(await total(`taskIds=${randomUUID()}`)).toBe(0);
    expect(await total('model=~default')).toBe(0);
    expect(await total('model=sonnet')).toBe(1);
    expect(await total('repository=none')).toBe(0);
    expect(await total('repository=acme/api')).toBe(1);
    expect(await total(`personId=${team.owner.value}`)).toBe(1);
  });

  it('rejects a drill-down it cannot read: an unknown value, one sent twice, a day outside the range, or a range it does not know', async () => {
    const status = async (query: string) =>
      (await asOwner(insights('traces', `range=7d&${query}`))).status;
    const today = new Date().toISOString().slice(0, 10);

    expect(await status('outcome=exploded')).toBe(422);
    expect(await status('pullRequestState=shipped')).toBe(422);
    expect(await status('humanAction=shrugged')).toBe(422);
    expect(await status('humanAction=dismissed')).toBe(422);
    expect(await status('resolution=merged')).toBe(422);
    expect(await status('asked=yes')).toBe(422);
    expect(await status('stationId=a&stationId=b')).toBe(422);
    expect(await status('day=2026-02-30')).toBe(422);
    expect(await status('day=2000-01-01')).toBe(422);
    expect(await status(`day=${today}`)).toBe(200);
    expect((await asOwner(insights('traces', 'range=2y'))).status).toBe(422);
  });

  it('drills down by the skills and MCP servers a run used, and the tools a person dismissed', async () => {
    const total = async (query: string) =>
      (
        (await asOwner(insights('traces', `range=7d&${query}`)))
          .body as InsightsTracesResponseDto
      ).matched;
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

    expect(await total('skillEnabled=grafana')).toBe(1);
    expect(await total('skillUsed=grafana')).toBe(1);
    expect(await total('skillUsed=our-migrations')).toBe(0);
    expect(await total('server=linear')).toBe(1);
    expect(await total('server=sentry')).toBe(0);
    expect(await total('serverFailed=linear')).toBe(1);
    expect(await total('failedAfter=linear')).toBe(0);
    expect(await total('dismissedTool=create_issue')).toBe(1);
    expect(await total('dismissedServer=linear')).toBe(1);
    expect(
      await total('dismissedServer=linear&dismissedTool=create_issue'),
    ).toBe(1);
    expect(await total('dismissedServer=jira&dismissedTool=create_issue')).toBe(
      0,
    );
    expect(await total(`week=${monday}`)).toBe(1);

    const tuesday = new Date(
      Date.parse(`${monday}T00:00:00Z`) + 24 * 60 * MINUTE,
    )
      .toISOString()
      .slice(0, 10);

    for (const week of ['yesterday', '2026-02-30', tuesday]) {
      expect(
        (await asOwner(insights('traces', `range=7d&week=${week}`))).status,
      ).toBe(422);
    }
  });

  it('shows which skills runs had enabled and read, and how each MCP server behaved', async () => {
    const answer = await asOwner(insights('tools'));
    const body = answer.body as InsightsToolsResponseDto;

    expect(answer.status).toBe(200);
    expect(body.runs).toBe(1);
    expect(body.trendRule).toEqual({
      recentWeeks: 2,
      minRuns: 5,
      shiftPoints: 20,
    });
    expect(body.skills).toEqual([
      expect.objectContaining({
        key: 'grafana',
        enabled: 1,
        used: 1,
        trend: null,
        stations: [
          expect.objectContaining({
            stationId: team.stationId.value,
            enabled: 1,
            used: 1,
          }),
        ],
      }),
    ]);
    expect(body.servers).toEqual([
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
        failingRunRate: 0,
        dismissed: 1,
        dismissedRate: 1,
      },
    ]);
    expect(body.dismissals).toEqual([
      { tool: 'create_issue', server: 'linear', dismissed: 1 },
    ]);
  });

  it('rejects a drill-down by more than two hundred tasks at once', async () => {
    const many = Array.from({ length: 201 }, () => randomUUID()).join(',');

    expect(
      (await asOwner(insights('traces', `range=7d&taskIds=${many}`))).status,
    ).toBe(422);
  });

  it('tallies a station on the Stations tab as its Station page does, for the same runs', async () => {
    const page = await asOwner(
      `/api/teams/${team.teamId.value}/lines/${team.line.id.value}/stations/${team.stationId.value}/insights`,
    );
    const tab = (await asOwner(insights('stations')))
      .body as InsightsStationsResponseDto;
    const { groups } = page.body as StationInsightsResponseDto;

    expect(page.status).toBe(200);
    expect(groups).toHaveLength(1);
    expect(groups[0].runs).toHaveLength(1);
    expect(tab.stations[0].tally).toEqual(groups[0].tally);
  });

  it('shows each station’s tally and its task failures apart from its run failures', async () => {
    const answer = await asOwner(insights('stations'));
    const body = answer.body as InsightsStationsResponseDto;

    expect(answer.status).toBe(200);
    expect(body.stations[0]).toMatchObject({
      stationId: team.stationId.value,
      tally: {
        runs: 1,
        resolutions: {
          accepted: 0,
          sentBack: 0,
          movedOn: 1,
          failed: 0,
          other: 0,
        },
        passed: 1,
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
    expect(body.stations[0].trend).toHaveLength(7);
    expect(body.stations[0].seen).toEqual({
      accepted: false,
      sentBack: false,
      merged: true,
    });
    expect(body.teamTrend).toHaveLength(7);
  });

  it('shows where the task waited, on to its merge', async () => {
    const answer = await asOwner(insights('flow'));
    const body = answer.body as InsightsFlowResponseDto;

    expect(answer.status).toBe(200);
    expect(body.flow.stations[0]).toMatchObject({
      stationId: team.stationId.value,
      tasks: 1,
      queued: { p50Ms: 2 * MINUTE, count: 1 },
      inbox: { p50Ms: 30 * MINUTE, count: 1 },
      asks: 1,
      unanswered: 0,
    });
    expect(body.flow.delivery).toMatchObject({
      toPullRequest: { p50Ms: 180 * MINUTE, count: 1 },
      toFirstReview: { p50Ms: 60 * MINUTE, count: 1 },
      toMerge: { p50Ms: 60 * MINUTE, count: 1 },
    });
  });

  it('shows what the work asks of people and who uses it, calling nobody new who set the team up long before', async () => {
    const answer = await asOwner(insights('people'));
    const body = answer.body as InsightsPeopleResponseDto;

    expect(answer.status).toBe(200);
    expect(body.load).toMatchObject({
      asks: 1,
      tasks: 1,
      toAnswer: { p50Ms: 30 * MINUTE, count: 1 },
    });
    expect(body.adoption).toMatchObject({
      activeCount: 1,
      newAdopterCount: 0,
      weeklyCount: 1,
      monthlyCount: 1,
      stickiness: 1,
    });
    expect(body.adoption.people[0]).toMatchObject({
      name: 'Ada',
      tasksOpened: 1,
      actions: 2,
      chats: 1,
      isNew: false,
      firstSeenAt: '2026-01-02T03:04:05.000Z',
    });
  });

  it('splits spend by model, station and repository', async () => {
    const answer = await asOwner(insights('cost'));
    const body = answer.body as InsightsCostResponseDto;

    expect(answer.status).toBe(200);
    expect(body.cost.cache).toEqual({
      input: 2_000,
      cacheRead: 90_000,
      cacheWrite: null,
      cacheRate: 90_000 / 92_000,
    });
    expect(body.cost.cacheByStation).toEqual([
      {
        stationId: team.stationId.value,
        input: 2_000,
        cacheRead: 90_000,
        cacheWrite: null,
        cacheRate: 90_000 / 92_000,
      },
    ]);
    expect(body.cost).toMatchObject({
      spend: { amount: 1.25, currency: 'USD' },
      unpriced: 0,
      mixedCurrencies: false,
      byModel: [{ key: 'sonnet', amount: 1.25, share: 1, runs: 1 }],
      byRepository: [{ key: 'acme/api', amount: 1.25, share: 1, runs: 1 }],
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
    (
      (await asOwner(insights('traces', `range=7d&${query}`)))
        .body as InsightsTracesResponseDto
    ).matched;

  it('leaves a run cancelled before it ran out of the runs with a skill enabled, as the tab does', async () => {
    const cancelled = RunId.of(randomUUID());
    const task = TaskId.of(randomUUID());

    await db.insert(schema.run).values({
      id: cancelled.value,
      workspaceId: team.workspaceId.value,
      harness: 'dev',
      ...requestedByTask(task.value, { teamId: team.teamId.value }),
      state: 'failed',
      spec: SPEC,
      createdAt: ago(120),
      ...endingFor('failed', ago(119)),
    });
    await db.insert(schema.dispatch).values(
      aDispatch({
        runId: cancelled.value,
        workspaceId: team.workspaceId.value,
        teamId: team.teamId.value,
        taskId: task.value,
        stationId: team.stationId.value,
        fingerprint: CONFIG,
        config: {
          prompt: 'Implement the task.',
          harness: 'claude-code',
          model: 'sonnet',
          effort: 'high',
          profile: null,
          image: null,
          repositories: [],
          skills: [{ key: 'grafana', hash: 'd'.repeat(64) }],
          tools: [],
          decisions: false,
          memories: false,
        },
        orderedAt: ago(120),
        endedAt: ago(119),
        outcome: 'failed',
      }),
    );
    const ended: DispatchEndedIntegrationEvent = {
      kind: DISPATCH_ENDED,
      runId: cancelled.value,
      workspaceId: team.workspaceId.value,
      taskId: task.value,
      stationId: team.stationId.value,
      outcome: 'cancelled',
      failure: null,
      stopped: false,
      asked: false,
    };

    await app.get(EventOutbox).record([ended]);
    await eventually(async () => {
      await app.get(EventDelivery).drain(2_000);
      return (await app.get(DrizzleRunRecordRepository).of(cancelled))
        ?.hasEnded;
    }, 60_000);

    const record = await app.get(DrizzleRunRecordRepository).of(cancelled);

    expect(record?.end?.ending).toBe('cancelled');
    expect(record?.end?.agentConfig.skills).toEqual(['grafana']);

    const tools = await asOwner(insights('tools'));

    expect((tools.body as InsightsToolsResponseDto).skills).toEqual([
      expect.objectContaining({ key: 'grafana', enabled: 1 }),
    ]);
    expect(await total('skillEnabled=grafana')).toBe(1);
  });

  const seeded = async (seed: {
    readonly outcome: 'completed' | 'failed';
    readonly superseded?: boolean;
    readonly servers: readonly ServerCalls[];
    readonly dismissed: readonly CalledTool[];
  }) => {
    const runId = RunId.of(randomUUID());
    const task = TaskId.of(randomUUID());

    await db.insert(schema.run).values({
      id: runId.value,
      workspaceId: team.workspaceId.value,
      harness: 'dev',
      ...requestedByTask(task.value, { teamId: team.teamId.value }),
      state: seed.outcome,
      spec: SPEC,
      createdAt: ago(100),
      startedAt: ago(99),
      ...endingFor(seed.outcome, ago(90)),
    });
    await db.insert(schema.dispatch).values(
      aDispatch({
        runId: runId.value,
        workspaceId: team.workspaceId.value,
        teamId: team.teamId.value,
        taskId: task.value,
        stationId: team.stationId.value,
        fingerprint: CONFIG,
        config: {
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
        orderedAt: ago(100),
        endedAt: ago(90),
        outcome: seed.outcome,
      }),
    );

    const ended: DispatchEndedIntegrationEvent = {
      kind: DISPATCH_ENDED,
      runId: runId.value,
      workspaceId: team.workspaceId.value,
      taskId: task.value,
      stationId: team.stationId.value,
      outcome: seed.outcome,
      failure: seed.outcome === 'failed' ? 'exited' : null,
      stopped: false,
      asked: false,
    };
    const superseded: DispatchSupersededIntegrationEvent = {
      kind: DISPATCH_SUPERSEDED,
      runId: runId.value,
      workspaceId: team.workspaceId.value,
      taskId: task.value,
      at: new Date().toISOString(),
    };

    await app
      .get(EventOutbox)
      .record([
        ended,
        new RunUsageRecorded(
          runId,
          team.workspaceId,
          taskRequester(task),
          true,
          RunAttempt.of(runId, 1),
          MINUTE,
          4,
          0,
          0,
          null,
          null,
          null,
          [],
          0,
          Tokens.UNREPORTED,
          ToolUse.of({ servers: seed.servers, skills: [] }),
        ),
        ...seed.dismissed.map(
          (tool, at) =>
            new TaskActedOn(
              task,
              team.workspaceId,
              team.stationId,
              'dismissed',
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
        record.usage !== null &&
        record.dismissals.length === seed.dismissed.length &&
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

    await seeded({
      outcome: 'failed',
      servers: [jira(2, [300])],
      dismissed: [],
    });
    await seeded({
      outcome: 'failed',
      superseded: true,
      servers: [jira(1, [])],
      dismissed: [],
    });
    await seeded({
      outcome: 'completed',
      servers: [],
      dismissed: [
        createIssue,
        createIssue,
        CalledTool.of({ server: 'linear', tool: 'comment' }),
      ],
    });
    await seeded({
      outcome: 'completed',
      servers: [],
      dismissed: [CalledTool.of({ server: null, tool: 'github.merge' })],
    });

    const tools = (await asOwner(insights('tools'))).body as {
      servers: {
        server: string;
        runs: number;
        failingRuns: number;
        dismissed: number;
      }[];
      skills: { key: string; enabled: number; used: number }[];
      dismissals: { tool: string; server: string | null; dismissed: number }[];
    };

    expect(tools.skills.length).toBeGreaterThan(0);
    expect(tools.servers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ server: 'jira', runs: 2, failingRuns: 1 }),
        expect.objectContaining({ server: 'linear', dismissed: 2 }),
      ]),
    );
    expect(tools.dismissals).toEqual(
      expect.arrayContaining([
        { tool: 'create_issue', server: 'linear', dismissed: 2 },
        { tool: 'comment', server: 'linear', dismissed: 1 },
        { tool: 'github.merge', server: null, dismissed: 1 },
      ]),
    );

    for (const server of tools.servers) {
      expect(await total(`server=${server.server}`)).toBe(server.runs);
      expect(await total(`failedAfter=${server.server}`)).toBe(
        server.failingRuns,
      );
      expect(await total(`dismissedServer=${server.server}`)).toBe(
        server.dismissed,
      );
    }
    for (const dismissal of tools.dismissals) {
      expect(
        await total(
          `dismissedTool=${encodeURIComponent(dismissal.tool)}&dismissedServer=${dismissal.server ?? 'none'}`,
        ),
      ).toBe(dismissal.dismissed);
    }
    for (const skill of tools.skills) {
      expect(await total(`skillUsed=${skill.key}`)).toBe(skill.used);
      expect(await total(`skillEnabled=${skill.key}`)).toBe(skill.enabled);
    }
  });
});
