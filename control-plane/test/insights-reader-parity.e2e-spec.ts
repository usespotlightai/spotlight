import { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import { TeamHistories } from '@outcomes/application/services/team-histories.service';
import { ChatRecord } from '@outcomes/domain/aggregates/chat-record.aggregate';
import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import { TaskFailures } from '@outcomes/domain/aggregates/task-failures.aggregate';
import { TaskTouches } from '@outcomes/domain/aggregates/task-touches.aggregate';
import {
  type CostCounts,
  type CostPlace,
  costBreakdownFrom,
  costCountsOf,
} from '@outcomes/domain/services/cost-breakdown';
import { flowCountsOf, flowFrom } from '@outcomes/domain/services/flow';
import { overviewCountsOf } from '@outcomes/domain/services/overview-counts';
import { peopleCountsOf } from '@outcomes/domain/services/people-counts';
import { pipelineCountsOf } from '@outcomes/domain/services/shipping';
import {
  stationReportsFrom,
  teamCountsOf,
  teamReportFrom,
} from '@outcomes/domain/services/station-reports';
import { openingsOf } from '@outcomes/domain/services/team-history';
import { FailureOccurrence } from '@outcomes/domain/value-objects/failure-occurrence.vo';
import { HandedOn } from '@outcomes/domain/value-objects/handed-on.vo';
import { InboxAsk } from '@outcomes/domain/value-objects/inbox-ask.vo';
import {
  INSIGHTS_PERIODS,
  InsightsPeriod,
} from '@outcomes/domain/value-objects/insights-period.vo';
import { NEXT_ACTS, NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { PersonTouch } from '@outcomes/domain/value-objects/person-touch.vo';
import { RunCost } from '@outcomes/domain/value-objects/run-cost.vo';
import { RunEnd } from '@outcomes/domain/value-objects/run-end.vo';
import type { RunEnding } from '@outcomes/domain/value-objects/run-ending';
import { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import { RunSetup } from '@outcomes/domain/value-objects/run-setup.vo';
import { RunTools } from '@outcomes/domain/value-objects/run-tools.vo';
import { TaskOpening } from '@outcomes/domain/value-objects/task-opening.vo';
import { DrizzleRunFactProjection } from '@outcomes/infrastructure/persistence/drizzle/projections/run-fact.projection';
import { DrizzleInsightsReader } from '@outcomes/infrastructure/persistence/drizzle/readers/insights.reader';
import { DrizzleChatRecordRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/chat-record.repository';
import { DrizzleRunRecordRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/run-record.repository';
import { DrizzleTaskDeliveryRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-delivery.repository';
import { DrizzleTaskFailuresRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-failures.repository';
import { DrizzleTaskTouchesRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-touches.repository';
import type { Env } from '@platform/config/env.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { DrizzleReading } from '@platform/persistence/drizzle/drizzle.reading';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';

const WORKSPACE = WorkspaceId.of('workspace_parity');
const TEAM = TeamId.of('team_parity');
const VIEWER = UserId.of('user_ada');

const NEXT_DOOR = TeamId.of('team_next_door');

const HOMES = [
  { workspaceId: WORKSPACE, teamId: TEAM },
  { workspaceId: WORKSPACE, teamId: NEXT_DOOR },
  {
    workspaceId: WorkspaceId.of('workspace_elsewhere'),
    teamId: TeamId.of('team_elsewhere'),
  },
  { workspaceId: WorkspaceId.of('workspace_elsewhere'), teamId: TEAM },
] as const;
const NOW = new Date('2026-10-14T15:00:00.000Z');
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const RUNS = 600;

const CANDIDATES = [
  ...Array.from({ length: RUNS / 2 }, (_, index) => `task_${index}`),
  'task_both_windows',
  'task_0',
  'task_run_tie_a',
  'task_stale',
  'task_nowhere',
];

const STATIONS = [
  { lineId: 'line_a', stationId: 'plan' },
  { lineId: 'line_a', stationId: 'build' },
  { lineId: 'line_b', stationId: 'review' },
  { lineId: 'line_b', stationId: 'ship' },
] as const;

const PEOPLE = ['user_ada', 'user_bob', 'user_cy', 'user_dee', 'user_eve'];

const FAR = 'user_far';

const GUS = 'user_gus';

const REPOSITORIES = [
  [],
  ['acme/api'],
  ['acme/api'],
  ['acme/api', 'acme/web'],
  ['acme/web', 'acme/api', 'acme/docs'],
];

const CHATS = 40;

const ELSEWHERE_ONLY = { lineId: 'line_c', stationId: 'elsewhere_only' };

const ENDINGS: readonly RunEnding[] = [
  'completed',
  'completed',
  'completed',
  'failed',
  'stopped',
  'abandoned',
  'withdrawn',
];

const seeded = (seed: number) => {
  let state = seed;

  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
};

const random = seeded(187);
const pick = <T>(from: readonly T[]): T =>
  from[Math.floor(random() * from.length)] as T;
const chance = (share: number): boolean => random() < share;
const ago = (ms: number): Date => new Date(NOW.getTime() - ms);

const inPlaceOrder = (
  a: { readonly first: CostPlace },
  b: { readonly first: CostPlace },
): number => a.first.run - b.first.run || a.first.offset - b.first.offset;

const ordered = (counts: CostCounts): CostCounts => ({
  ...counts,
  shares: [...counts.shares].sort(
    (a, b) => a.part.localeCompare(b.part) || inPlaceOrder(a, b),
  ),
  links: [...counts.links].sort(inPlaceOrder),
  cacheByStation: [...counts.cacheByStation].sort((a, b) => a.first - b.first),
});

let held: TestDatabase;
let histories: TeamHistories;
let reader: DrizzleInsightsReader;
let touches: DrizzleTaskTouchesRepository;

beforeAll(async () => {
  held = await openDatabase('insights_parity');
  const context = new DrizzleContext(held.db);
  const quiet = {
    dispatch: async () => {},
  } as unknown as DomainEventDispatcher;
  const facts = new DrizzleRunFactProjection(context);
  const records = new DrizzleRunRecordRepository(context, facts, quiet);
  const deliveries = new DrizzleTaskDeliveryRepository(context, facts, quiet);
  touches = new DrizzleTaskTouchesRepository(context, facts);
  const failures = new DrizzleTaskFailuresRepository(context);
  const chats = new DrizzleChatRecordRepository(context);

  histories = new TeamHistories(
    new OutcomesAccess({
      namesOf: async () => new Map(),
      clearedOnTeam: async () => ({ workspaceId: WORKSPACE, by: VIEWER }),
    }),
    { records, deliveries, touches, failures, chats },
    { now: () => NOW, sleep: async () => {} },
  );
  reader = new DrizzleInsightsReader(
    new DrizzleReading(held.db, { DATABASE_READ_TIMEOUT_MS: 15_000 } as Env),
  );

  await context.run(async () => {
    let home = HOMES[0];

    for (let index = 0; index < RUNS; index += 1) {
      if (index % 2 === 0) {
        home = chance(0.75) ? HOMES[0] : pick(HOMES.slice(1));
      }

      const station =
        home === HOMES[3] || (home !== HOMES[0] && chance(0.5))
          ? ELSEWHERE_ONLY
          : pick(STATIONS);
      const taskId = TaskId.of(`task_${Math.floor(index / 2)}`);
      const endedAt = ago(Math.floor(random() * 200 * DAY));
      const startedAt = chance(0.9)
        ? new Date(endedAt.getTime() - Math.floor(random() * 2 * HOUR))
        : null;
      let record = RunRecord.heardOf(
        RunId.of(`run_${String(index).padStart(4, '0')}`),
        home.workspaceId,
      ).ended(
        RunEnd.of({
          place: RunPlace.of({ teamId: home.teamId, ...station, taskId }),
          fingerprint: pick(['a'.repeat(64), 'b'.repeat(64)]),
          setup: RunSetup.of({
            harness: pick(['claude-code', 'codex']),
            model: pick(['opus', 'sonnet', null]),
            effort: null,
            profileKey: null,
            repositories: pick(REPOSITORIES),
            skills: [],
          }),
          queuedAt: startedAt ? new Date(startedAt.getTime() - HOUR) : null,
          startedAt,
          endedAt,
          ending: pick(ENDINGS),
          failure: pick(['exited', 'timed-out', null]),
          round: 1,
          asked: chance(0.2),
        }),
      );

      if (chance(0.75)) {
        record = record.digested(
          RunCost.of({
            ms: chance(0.9) ? Math.floor(random() * 3_600_000) : null,
            steps: 3,
            faults: 0,
            changedLines: 10,
            used: null,
            size: null,
            amount: chance(0.85) ? Math.round(random() * 1000) / 100 : null,
            currency:
              station.stationId === 'ship' &&
              endedAt.getTime() < ago(60 * DAY).getTime() &&
              chance(0.3)
                ? 'EUR'
                : 'USD',
            tokens: {
              input: chance(0.9) ? Math.floor(random() * 10_000) : null,
              output: 10,
              cacheRead:
                station.stationId !== 'review' && chance(0.7)
                  ? Math.floor(random() * 50_000)
                  : null,
              cacheWrite: chance(0.5) ? Math.floor(random() * 5_000) : null,
            },
          }),
          RunTools.NONE,
        );
      }
      if (chance(0.5)) {
        record = record.checked(
          pick(['passed', 'failed', 'skipped'] as const),
          endedAt,
        );
      }
      if (chance(0.5)) {
        record = record.actedOn(
          NextAct.of(
            pick(['started', 'parked', 'closed', 'answered', 'sent-back']),
            new Date(endedAt.getTime() + HOUR),
          ),
        );
      }
      if (chance(0.1)) {
        record = record.handedOnTo(
          HandedOn.of('ship', new Date(endedAt.getTime() + 2 * HOUR)),
        );
      }
      if (chance(0.1)) {
        record = record.supersededByItsTask(
          new Date(endedAt.getTime() + 3 * HOUR),
        );
      }

      await records.add(record);

      if (index % 2 === 0) {
        const far = chance(0.15);
        const person = () => UserId.of(far ? FAR : pick(PEOPLE));
        let touched = TaskTouches.heardOf(taskId, home.workspaceId).opened(
          TaskOpening.of({
            teamId: far ? NEXT_DOOR : home.teamId,
            lineId: station.lineId,
            stationId: station.stationId,
            by: chance(0.9) ? person() : null,
            at: new Date(endedAt.getTime() - (chance(0.1) ? 150 * DAY : DAY)),
          }),
        );

        for (let acted = Math.floor(random() * 4); acted > 0; acted -= 1) {
          touched = touched.actedOn(
            PersonTouch.of({
              act: pick([...NEXT_ACTS, 'approved', 'refused'] as const),
              by: person(),
              stationId: station.stationId,
              at: ago(Math.floor(random() * 200 * DAY)),
            }),
          );
        }

        for (let asked = Math.floor(random() * 3); asked > 0; asked -= 1) {
          touched = touched.asked(
            InboxAsk.of(
              pick([station.stationId, pick(STATIONS).stationId]),
              ago(Math.floor(random() * 200 * DAY)),
            ),
          );
        }

        await touches.add(touched);

        if (chance(0.5)) {
          const pullRequest = PullRequestUrl.of(
            `https://github.com/acme/api/pull/${index}`,
          );
          const fresh = TaskDelivery.opened({
            taskId,
            workspaceId: home.workspaceId,
            teamId: far ? NEXT_DOOR : home.teamId,
            pullRequest,
            at: new Date(endedAt.getTime() - HOUR),
          });
          const opened = chance(0.6)
            ? fresh.reviewed({
                pullRequest,
                byBot: false,
                at: new Date(
                  endedAt.getTime() + Math.floor(random() * 20) * HOUR,
                ),
              })
            : fresh;

          await deliveries.add(
            chance(0.6)
              ? opened.closed({
                  pullRequest,
                  merged: chance(0.7),
                  at: new Date(endedAt.getTime() + DAY),
                })
              : opened,
          );
        }

        if (chance(0.3)) {
          let failed = TaskFailures.heardOf(
            taskId,
            home.workspaceId,
            home.teamId,
          );

          for (
            let raised = 0;
            raised < 1 + Math.floor(random() * 3);
            raised++
          ) {
            failed = failed.raised(
              FailureOccurrence.of({
                stationId: chance(0.1) ? 'retired' : station.stationId,
                runId: null,
                source: pick(['run', 'hook:deploy']),
                code: pick(['exited', 'timed-out', 'refused']),
                occurrences: 1 + Math.floor(random() * 4),
                at: ago(Math.floor(random() * 100 * DAY)),
              }),
            );
          }

          await failures.add(failed);
        }
      }
    }

    for (let index = 0; index < CHATS; index += 1) {
      const where = pick(HOMES);

      await chats.add(
        ChatRecord.started({
          chatId: `chat_${index}`,
          workspaceId: where.workspaceId,
          teamId: where.teamId,
          startedBy: UserId.of(pick(PEOPLE)),
          startedAt: ago(Math.floor(random() * 200 * DAY)),
        }),
      );
    }

    const tied = ago(2 * DAY);

    for (const [runId, endedAt, beganHoursBefore, station, model, currency] of [
      ['run_tie_a', tied, 1, STATIONS[0], 'haiku', 'USD'],
      ['run_tie_b', tied, 3, STATIONS[1], 'gpt', 'USD'],
      ['run_euro', ago(75 * DAY), 1, STATIONS[3], 'sonnet', 'EUR'],
    ] as const) {
      await records.add(
        RunRecord.heardOf(RunId.of(runId), WORKSPACE)
          .ended(
            RunEnd.of({
              place: RunPlace.of({
                teamId: TEAM,
                ...station,
                taskId: TaskId.of(`task_${runId}`),
              }),
              fingerprint: 'a'.repeat(64),
              setup: RunSetup.of({
                harness: 'claude-code',
                model,
                effort: null,
                profileKey: null,
                repositories: [`acme/${runId}`],
                skills: [],
              }),
              queuedAt: null,
              startedAt: new Date(endedAt.getTime() - beganHoursBefore * HOUR),
              endedAt,
              ending: 'completed',
              failure: null,
              round: 1,
              asked: false,
            }),
          )
          .digested(
            RunCost.of({
              ms: 1_000,
              steps: 1,
              faults: 0,
              changedLines: 1,
              used: null,
              size: null,
              amount: 0.5,
              currency,
              tokens: {
                input: 1,
                output: 1,
                cacheRead: 1,
                cacheWrite: null,
              },
            }),
            RunTools.NONE,
          ),
      );
    }

    await touches.add(
      TaskTouches.heardOf(TaskId.of('task_both_windows'), WORKSPACE)
        .opened(
          TaskOpening.of({
            teamId: TEAM,
            ...STATIONS[2],
            by: UserId.of('user_bob'),
            at: ago(21 * DAY),
          }),
        )
        .asked(InboxAsk.of(STATIONS[2].stationId, ago(9 * DAY)))
        .asked(InboxAsk.of(STATIONS[2].stationId, ago(2 * DAY)))
        .asked(InboxAsk.of(STATIONS[2].stationId, ago(12 * HOUR)))
        .actedOn(
          PersonTouch.of({
            act: 'started',
            by: UserId.of('user_bob'),
            stationId: STATIONS[2].stationId,
            at: ago(20 * DAY),
          }),
        )
        .actedOn(
          PersonTouch.of({
            act: 'refused',
            by: UserId.of('user_bob'),
            stationId: STATIONS[2].stationId,
            at: ago(DAY),
          }),
        ),
    );

    await chats.add(
      ChatRecord.started({
        chatId: 'chat_gus',
        workspaceId: WORKSPACE,
        teamId: TEAM,
        startedBy: UserId.of(GUS),
        startedAt: ago(9 * DAY),
      }),
    );

    const stalePull = PullRequestUrl.of(
      'https://github.com/acme/api/pull/stale',
    );

    await records.add(
      RunRecord.heardOf(RunId.of('run_stale'), WORKSPACE).ended(
        RunEnd.of({
          place: RunPlace.of({
            teamId: TEAM,
            ...STATIONS[0],
            taskId: TaskId.of('task_stale'),
          }),
          fingerprint: 'a'.repeat(64),
          setup: RunSetup.of({
            harness: 'claude-code',
            model: 'sonnet',
            effort: null,
            profileKey: null,
            repositories: ['acme/api'],
            skills: [],
          }),
          queuedAt: null,
          startedAt: ago(300 * DAY + HOUR),
          endedAt: ago(300 * DAY),
          ending: 'completed',
          failure: null,
          round: 1,
          asked: false,
        }),
      ),
    );
    await deliveries.add(
      TaskDelivery.opened({
        taskId: TaskId.of('task_stale'),
        workspaceId: WORKSPACE,
        teamId: TEAM,
        pullRequest: stalePull,
        at: ago(300 * DAY),
      }).reviewed({ pullRequest: stalePull, byBot: false, at: ago(DAY) }),
    );
  });
}, 120_000);

afterAll(async () => {
  await held?.close();
});

describe('the insights reader against the team history', () => {
  it.each(INSIGHTS_PERIODS)(
    'counts the same runs as the domain over %s',
    async (name) => {
      const { history, period, truncated } = await histories.of(
        TEAM.value,
        PersonPrincipal.of(VIEWER),
        name,
      );
      const counts = await reader.stationCounts({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        period,
      });
      const expected = teamCountsOf(
        {
          ...history,
          touches: await touches.forTasks(
            history.failures.map((each) => each.taskId),
          ),
        },
        period,
      );

      expect(truncated).toBe(false);
      expect(counts).toEqual(expected);
      expect(teamReportFrom(counts, period)).toEqual(
        teamReportFrom(expected, period),
      );
      expect(stationReportsFrom(counts, period)).toEqual(
        stationReportsFrom(expected, period),
      );
    },
  );

  it('covers what makes a station report hard to get right', async () => {
    const { period } = await histories.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '90d',
    );
    const stations = stationReportsFrom(
      await reader.stationCounts({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        period,
      }),
      period,
    );

    expect(stations.map((each) => each.stationId)).toContain('retired');
    expect(stations.map((each) => each.stationId)).not.toContain(
      'elsewhere_only',
    );
    expect(stations.some((each) => each.tally.mixedCurrencies)).toBe(true);
    expect(stations.some((each) => each.tally.merged > 0)).toBe(true);
    expect(stations.some((each) => each.tally.withdrawn > 0)).toBe(true);
    expect(stations.some((each) => each.taskFailures.length > 1)).toBe(true);
    expect(stations.some((each) => each.runFailures.length > 1)).toBe(true);
  });
  it.each(INSIGHTS_PERIODS)(
    'counts the same overview as the domain over %s',
    async (name) => {
      const held = await histories.of(
        TEAM.value,
        PersonPrincipal.of(VIEWER),
        name,
      );
      const { history, period, truncated } = held;
      const counts = await reader.overviewCounts({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        period,
      });
      const expected = overviewCountsOf(
        history,
        period,
        await histories.carriedOn(held),
        openingsOf(
          await touches.forTasks([
            ...history.failures.map((each) => each.taskId),
            ...history.deliveries.map((each) => each.taskId),
          ]),
        ),
      );

      expect(truncated).toBe(false);
      expect(counts).toEqual(expected);
    },
  );

  it('covers what makes an overview hard to get right', async () => {
    const { period } = await histories.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '90d',
    );
    const counts = await reader.overviewCounts({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      period,
    });
    const merged = counts.resolved.filter((each) => each.merged);

    expect(counts.markers.length).toBeGreaterThan(1);
    expect(merged.some((each) => each.taskOpenedAt !== null)).toBe(true);
    expect(counts.resolved.some((each) => !each.merged)).toBe(true);
    expect(counts.current.people).toContain(FAR);
    expect(counts.current.touches).toBeGreaterThan(0);
    expect(counts.previous.runs).toBeGreaterThan(0);
    expect(counts.spending.size).toBeGreaterThan(10);
    expect(counts.failingBefore.length).toBeGreaterThan(0);
  });
  it.each(INSIGHTS_PERIODS)(
    'counts the same cost as the domain over %s',
    async (name) => {
      const { history, period, truncated } = await histories.of(
        TEAM.value,
        PersonPrincipal.of(VIEWER),
        name,
      );
      const counts = await reader.costCounts({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        period,
      });

      expect(truncated).toBe(false);
      expect({ ...counts, current: ordered(counts.current) }).toEqual({
        current: ordered(costCountsOf(history, period.current)),
        spendBefore: costCountsOf(history, period.previous).spend,
      });
    },
  );

  it('breaks the cost of a period priced in one currency down', async () => {
    const { period } = await histories.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '30d',
    );
    const { current } = await reader.costCounts({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      period,
    });
    const breakdown = costBreakdownFrom(current);

    expect(current.spend?.currency).toBe('USD');
    expect(breakdown.nodes.length).toBeGreaterThan(3);
    expect(breakdown.links.length).toBeGreaterThan(3);
    expect(breakdown.byRepository.length).toBeGreaterThan(1);
  });

  it('covers what makes a cost breakdown hard to get right', async () => {
    const { period } = await histories.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '90d',
    );
    const { current } = await reader.costCounts({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      period,
    });
    const repositories = current.shares.filter(
      (each) => each.part === 'repository',
    );

    expect(repositories.map((each) => each.key).sort()).toEqual([
      'acme/api',
      'acme/docs',
      'acme/run_euro',
      'acme/run_tie_a',
      'acme/run_tie_b',
      'acme/web',
      null,
    ]);
    expect(current.links.some((each) => each.target.key === null)).toBe(true);
    expect(current.cache?.cacheWrite).not.toBeNull();
    expect(current.cacheByStation.some((each) => each.cache === null)).toBe(
      true,
    );
    expect(current.mixedCurrencies).toBe(true);
    expect(current.spend).toBeNull();

    const tiedAt = (model: string) =>
      current.shares.find((each) => each.part === 'model' && each.key === model)
        ?.first.run ?? Number.NaN;

    expect(tiedAt('gpt')).toBe(tiedAt('haiku') + 1);
    expect(current.shares.some((each) => each.key === null)).toBe(true);
  });

  it.each(INSIGHTS_PERIODS)(
    'counts the same flow as the domain over %s',
    async (name) => {
      const { history, period, truncated } = await histories.of(
        TEAM.value,
        PersonPrincipal.of(VIEWER),
        name,
      );
      const counts = await reader.flowCounts({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        period,
      });
      const expected = flowCountsOf(
        history,
        period,
        openingsOf(
          await touches.forTasks(history.deliveries.map((each) => each.taskId)),
        ),
      );
      const byStation = <T extends { readonly stationId: string }>(
        items: readonly T[],
      ) => [...items].sort((a, b) => a.stationId.localeCompare(b.stationId));

      expect(truncated).toBe(false);
      expect({
        ...counts,
        current: { ...counts.current, inbox: byStation(counts.current.inbox) },
        previous: {
          ...counts.previous,
          inbox: byStation(counts.previous.inbox),
        },
      }).toEqual({
        ...expected,
        current: {
          ...expected.current,
          inbox: byStation(expected.current.inbox),
        },
        previous: {
          ...expected.previous,
          inbox: byStation(expected.previous.inbox),
        },
      });
    },
  );

  it('covers what makes a flow hard to get right', async () => {
    const { period } = await histories.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '90d',
    );
    const { current, deliveries } = await reader.flowCounts({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      period,
    });

    expect(current.stations.some((each) => each.queued.count > 0)).toBe(true);
    expect(current.stations.some((each) => each.running.count > 1)).toBe(true);
    expect(current.inbox.some((each) => each.unanswered > 0)).toBe(true);
    expect(current.inbox.some((each) => each.inbox.count > 0)).toBe(true);
    expect(deliveries.some((each) => each.firstReviewAt !== null)).toBe(true);
    expect(
      deliveries.some((each) => each.closedAt === null && !each.merged),
    ).toBe(true);
    expect(deliveries.some((each) => each.taskOpenedAt !== null)).toBe(true);
  });

  it.each(INSIGHTS_PERIODS)(
    'counts the same people as the domain over %s',
    async (name) => {
      const { history, period, truncated } = await histories.of(
        TEAM.value,
        PersonPrincipal.of(VIEWER),
        name,
      );
      const counts = await reader.peopleCounts({
        workspaceId: WORKSPACE,
        teamId: TEAM,
        period,
      });

      expect(truncated).toBe(false);
      expect(counts).toEqual(peopleCountsOf(history, period));
    },
  );

  it('covers what makes people counts hard to get right', async () => {
    const { period } = await histories.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '90d',
    );
    const { load, adoption } = await reader.peopleCounts({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      period,
    });

    expect(load.current.refused).toBeGreaterThan(1);
    expect(load.current.refusedTaskIds.length).toBeGreaterThan(1);
    expect(load.current.askedTaskIds.length).toBeGreaterThan(1);
    expect(load.current.unanswered).toBeGreaterThan(0);
    expect(load.current.sentBack).toBeGreaterThan(0);
    expect(adoption.people.map((each) => each.personId)).toContain(FAR);
    expect(adoption.people.some((each) => each.chats > 0)).toBe(true);
    expect(adoption.people.some((each) => each.opened > 0)).toBe(true);
  });

  it('counts someone active only the period before in it and in the month, not now', async () => {
    const { period } = await histories.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '7d',
    );
    const { load, adoption } = await reader.peopleCounts({
      workspaceId: WORKSPACE,
      teamId: TEAM,
      period,
    });
    const askedBefore = new Set(load.previous.askedTaskIds);
    const bob = adoption.people.find((each) => each.personId === 'user_bob');

    expect(load.current.askedTaskIds).toContain('task_both_windows');
    expect(askedBefore.has('task_both_windows')).toBe(true);
    expect(adoption.people.map((each) => each.personId)).not.toContain(GUS);
    expect(adoption.monthly).toBeGreaterThan(adoption.weekly);
    expect(adoption.before).toBeGreaterThan(0);
    expect(bob?.firstAt.getTime()).toBeLessThan(period.current.from.getTime());
  });
});

describe('the pipeline of the tasks a team shipped', () => {
  it.each(INSIGHTS_PERIODS)(
    'counts the same pipeline as the domain over %s',
    async (name) => {
      const { history, period, truncated } = await histories.of(
        TEAM.value,
        PersonPrincipal.of(VIEWER),
        name,
      );
      const counts = await reader.pipelineCounts(
        { workspaceId: WORKSPACE, teamId: TEAM, period },
        CANDIDATES,
      );

      expect(truncated).toBe(false);
      expect(counts).toEqual(pipelineCountsOf(history, CANDIDATES, period));
    },
  );

  it('covers what makes a pipeline hard to get right', async () => {
    const { history, period } = await histories.of(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '90d',
    );
    const { openings, stations, passages } = await reader.pipelineCounts(
      { workspaceId: WORKSPACE, teamId: TEAM, period },
      CANDIDATES,
    );
    const opened = new Set(openings.map((each) => each.taskId));
    const touched = openingsOf(history.touches);

    expect(openings.length).toBeGreaterThan(10);
    expect(stations.length).toBeGreaterThan(2);
    expect(passages.some((each) => each.queued > 0)).toBe(true);
    expect(passages.some((each) => each.inbox > 0)).toBe(true);
    expect(
      CANDIDATES.some(
        (taskId) => touched.get(taskId)?.opening && !opened.has(taskId),
      ),
    ).toBe(true);
    expect(
      openings.some(
        (each) => !touched.get(each.taskId)?.opening?.teamId.equals(TEAM),
      ),
    ).toBe(true);
  });

  it('reads nothing for no tasks', async () => {
    const { period } = await histories.scope(
      TEAM.value,
      PersonPrincipal.of(VIEWER),
      '90d',
    );

    expect(
      await reader.pipelineCounts(
        { workspaceId: WORKSPACE, teamId: TEAM, period },
        [],
      ),
    ).toEqual({ openings: [], stations: [], passages: [] });
  });
});

describe('how the inbox pairs answers with asks', () => {
  const WAITS = TeamId.of('team_waits');
  const period = InsightsPeriod.of('7d', NOW);
  const asked = new Date(period.current.from.getTime() + 2 * DAY);
  const askedAgain = new Date(asked.getTime() + DAY);
  const none = { p50: null, p90: null, count: 0 };

  beforeAll(async () => {
    const context = new DrizzleContext(held.db);
    const quiet = {
      dispatch: async () => {},
    } as unknown as DomainEventDispatcher;
    const facts = new DrizzleRunFactProjection(context);
    const records = new DrizzleRunRecordRepository(context, facts, quiet);
    const ended = (
      runId: string,
      place: { readonly lineId: string; readonly stationId: string },
      endedAt: Date,
      ending: RunEnding,
    ) =>
      RunRecord.heardOf(RunId.of(runId), WORKSPACE).ended(
        RunEnd.of({
          place: RunPlace.of({
            teamId: WAITS,
            ...place,
            taskId: TaskId.of(`task_${runId}`),
          }),
          fingerprint: 'a'.repeat(64),
          setup: RunSetup.of({
            harness: 'claude-code',
            model: 'sonnet',
            effort: null,
            profileKey: null,
            repositories: [],
            skills: [],
          }),
          queuedAt: null,
          startedAt: new Date(endedAt.getTime() - HOUR),
          endedAt,
          ending,
          failure: null,
          round: 1,
          asked: false,
        }),
      );

    await records.add(
      ended(
        'idle',
        { lineId: 'line_c', stationId: 'idle' },
        asked,
        'withdrawn',
      ),
    );
    await records.add(
      ended(
        'waits',
        STATIONS[0],
        new Date(askedAgain.getTime() + HOUR),
        'completed',
      ),
    );
    await new DrizzleTaskTouchesRepository(context, facts).add(
      TaskTouches.heardOf(TaskId.of('task_waits'), WORKSPACE)
        .opened(
          TaskOpening.of({
            teamId: WAITS,
            ...STATIONS[0],
            by: VIEWER,
            at: new Date(asked.getTime() - DAY),
          }),
        )
        .asked(InboxAsk.of('review', asked))
        .asked(InboxAsk.of('build', asked))
        .asked(InboxAsk.of('plan', askedAgain))
        .asked(InboxAsk.of('ship', period.current.from))
        .actedOn(
          PersonTouch.of({
            act: 'answered',
            by: VIEWER,
            stationId: 'build',
            at: asked,
          }),
        )
        .actedOn(
          PersonTouch.of({
            act: 'answered',
            by: VIEWER,
            stationId: 'plan',
            at: askedAgain,
          }),
        ),
    );
  });

  it('leaves an ask unanswered when another follows at the same instant, and takes an answer at the very moment of the ask', async () => {
    const counts = await reader.flowCounts({
      workspaceId: WORKSPACE,
      teamId: WAITS,
      period,
    });
    const { history } = await histories.of(
      WAITS.value,
      PersonPrincipal.of(VIEWER),
      '7d',
    );

    expect(
      [...counts.current.inbox].sort((a, b) =>
        a.stationId.localeCompare(b.stationId),
      ),
    ).toEqual([
      {
        stationId: 'build',
        asks: 1,
        unanswered: 0,
        inbox: { p50: 0, p90: 0, count: 1 },
      },
      {
        stationId: 'plan',
        asks: 1,
        unanswered: 0,
        inbox: { p50: 0, p90: 0, count: 1 },
      },
      { stationId: 'review', asks: 1, unanswered: 1, inbox: none },
      { stationId: 'ship', asks: 1, unanswered: 1, inbox: none },
    ]);
    expect(counts.current.stations).toEqual([
      {
        lineId: 'line_c',
        stationId: 'idle',
        taskIds: [],
        runs: 0,
        queued: none,
        running: none,
      },
      {
        ...STATIONS[0],
        taskIds: ['task_waits'],
        runs: 1,
        queued: none,
        running: { p50: HOUR, p90: HOUR, count: 1 },
      },
    ]);
    const people = await reader.peopleCounts({
      workspaceId: WORKSPACE,
      teamId: WAITS,
      period,
    });

    expect(people.load.current).toEqual({
      asks: 4,
      unanswered: 2,
      toAnswer: { p50: 0, p90: 0, count: 2 },
      askedTaskIds: ['task_waits'],
      tasks: 1,
      runs: 1,
      sentBack: 0,
      refused: 0,
      refusedTaskIds: [],
    });
    expect(people.adoption).toEqual({
      people: [
        {
          personId: VIEWER.value,
          opened: 1,
          acts: 2,
          chats: 0,
          lastActiveAt: askedAgain,
          firstAt: new Date(asked.getTime() - DAY),
        },
      ],
      before: 0,
      weekly: 1,
      monthly: 1,
    });
    expect(
      flowFrom(counts, period).stations.map((each) => [
        each.stationId,
        each.asks,
      ]),
    ).toEqual([
      ['idle', 0],
      ['plan', 1],
    ]);
    const expected = flowCountsOf(history, period, new Map()).current;

    expect(counts.current.stations).toEqual(expected.stations);
    expect(
      [...counts.current.inbox].sort((a, b) =>
        a.stationId.localeCompare(b.stationId),
      ),
    ).toEqual(
      [...expected.inbox].sort((a, b) =>
        a.stationId.localeCompare(b.stationId),
      ),
    );
  });
});

describe('how the pipeline sums a task’s time at each station', () => {
  const PIPED = TeamId.of('team_piped');
  const period = InsightsPeriod.of('7d', NOW);
  const opened = ago(3 * DAY);
  const at = (hours: number) => new Date(opened.getTime() + hours * HOUR);
  const TASKS = [
    'task_piped',
    'task_long_ago',
    'task_unopened',
    'task_next_door',
    'task_nowhere',
  ];

  beforeAll(async () => {
    const context = new DrizzleContext(held.db);
    const quiet = {
      dispatch: async () => {},
    } as unknown as DomainEventDispatcher;
    const facts = new DrizzleRunFactProjection(context);
    const records = new DrizzleRunRecordRepository(context, facts, quiet);
    const touching = new DrizzleTaskTouchesRepository(context, facts);
    const ran = (
      runId: string,
      taskId: string,
      teamId: TeamId,
      stationId: string,
      lineId: string,
      times: {
        readonly queuedAt: Date | null;
        readonly startedAt: Date | null;
        readonly endedAt: Date;
      },
      ending: RunEnding = 'completed',
    ) =>
      records.add(
        RunRecord.heardOf(RunId.of(runId), WORKSPACE).ended(
          RunEnd.of({
            place: RunPlace.of({
              teamId,
              lineId,
              stationId,
              taskId: TaskId.of(taskId),
            }),
            fingerprint: 'a'.repeat(64),
            setup: RunSetup.of({
              harness: 'claude-code',
              model: 'sonnet',
              effort: null,
              profileKey: null,
              repositories: [],
              skills: [],
            }),
            ...times,
            ending,
            failure: null,
            round: 1,
            asked: false,
          }),
        ),
      );
    const openedOn = (taskId: string, teamId: TeamId, openedAt: Date) =>
      TaskTouches.heardOf(TaskId.of(taskId), WORKSPACE).opened(
        TaskOpening.of({
          teamId,
          lineId: 'line_piped',
          stationId: 'draft',
          by: VIEWER,
          at: openedAt,
        }),
      );

    await context.run(async () => {
      await ran('run_piped_b', 'task_piped', PIPED, 'draft', 'line_piped', {
        queuedAt: null,
        startedAt: at(4),
        endedAt: at(5),
      });
      await ran('run_piped_a', 'task_piped', PIPED, 'draft', 'line_piped', {
        queuedAt: at(1),
        startedAt: at(1.5),
        endedAt: at(3),
      });
      await ran(
        'run_piped_c',
        'task_piped',
        PIPED,
        'check',
        'line_piped',
        { queuedAt: at(2), startedAt: null, endedAt: at(3.5) },
        'withdrawn',
      );
      await ran('run_piped_d', 'task_piped', PIPED, 'draft', 'line_moved', {
        queuedAt: null,
        startedAt: at(5.5),
        endedAt: at(6),
      });
      await ran('run_long_ago', 'task_long_ago', PIPED, 'late', 'line_piped', {
        queuedAt: null,
        startedAt: at(1),
        endedAt: at(2),
      });
      await ran('run_unopened', 'task_unopened', PIPED, 'late', 'line_piped', {
        queuedAt: null,
        startedAt: at(1),
        endedAt: at(2),
      });
      await ran(
        'run_next_door',
        'task_next_door',
        NEXT_DOOR,
        'late',
        'line_piped',
        {
          queuedAt: null,
          startedAt: at(1),
          endedAt: at(2),
        },
      );
      await touching.add(
        openedOn('task_piped', PIPED, opened)
          .asked(InboxAsk.of('draft', at(3)))
          .asked(InboxAsk.of('check', at(5)))
          .asked(InboxAsk.of('draft', at(6)))
          .asked(InboxAsk.of('review', at(8)))
          .actedOn(
            PersonTouch.of({
              act: 'answered',
              by: VIEWER,
              stationId: 'draft',
              at: at(3.5),
            }),
          )
          .actedOn(
            PersonTouch.of({
              act: 'answered',
              by: VIEWER,
              stationId: 'check',
              at: at(5.25),
            }),
          )
          .actedOn(
            PersonTouch.of({
              act: 'answered',
              by: VIEWER,
              stationId: 'review',
              at: at(9),
            }),
          ),
      );
      await touching.add(openedOn('task_long_ago', PIPED, ago(60 * DAY)));
      await touching.add(
        TaskTouches.heardOf(TaskId.of('task_unopened'), WORKSPACE).asked(
          InboxAsk.of('late', at(2)),
        ),
      );
      await touching.add(openedOn('task_next_door', NEXT_DOOR, opened));
    });
  });

  it('adds up every run and every answered ask of a task opened in reach', async () => {
    const counts = await reader.pipelineCounts(
      { workspaceId: WORKSPACE, teamId: PIPED, period },
      TASKS,
    );
    const { history } = await histories.of(
      PIPED.value,
      PersonPrincipal.of(VIEWER),
      '7d',
    );

    expect(counts).toEqual({
      openings: [{ taskId: 'task_piped', openedAt: opened }],
      stations: [
        { lineId: 'line_piped', stationId: 'draft' },
        { lineId: 'line_piped', stationId: 'check' },
      ],
      passages: [
        {
          taskId: 'task_piped',
          stationId: 'check',
          queued: 0,
          running: 0,
          inbox: 0.25 * HOUR,
        },
        {
          taskId: 'task_piped',
          stationId: 'draft',
          queued: 0.5 * HOUR,
          running: 3 * HOUR,
          inbox: 0.5 * HOUR,
        },
      ],
    });
    expect(counts).toEqual(pipelineCountsOf(history, TASKS, period));
  });
});
