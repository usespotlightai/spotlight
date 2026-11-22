import { randomUUID } from 'node:crypto';

import { LEASE_MS } from '@platform/events/event-delivery';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { CompleteRunHandler } from '@runs/application/commands/handlers/complete-run.handler';
import { CompleteRunCommand } from '@runs/application/commands/runner.commands';
import { RecordRunUsage } from '@runs/application/events/handlers/record-run-usage.handler';
import type { ContentHashPort } from '@runs/application/ports/content-hash.port';
import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import type { HeldHarnessKeys } from '@runs/application/services/held-harness-keys.service';
import type { RunFileSources } from '@runs/application/services/run-file-sources.service';
import { RunReadModel } from '@runs/application/services/run-read-model.service';
import { Runs } from '@runs/application/services/runs.service';
import { RunEnded } from '@runs/domain/events/run-ended.event';
import { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import { DrizzleRunJournal } from '@runs/infrastructure/persistence/drizzle/ledgers/run-journal.ledger';
import { DrizzleRunUsages } from '@runs/infrastructure/persistence/drizzle/ledgers/run-usages.ledger';
import { DrizzleRunFactsReader } from '@runs/infrastructure/persistence/drizzle/readers/run-facts.reader';
import { DrizzleRunRepository } from '@runs/infrastructure/persistence/drizzle/repositories/run.repository';
import type { RunEndedIntegrationEvent } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { CancelDetachedRun } from '@work/application/events/handlers/cancel-detached-run.handler';
import { DispatchRunEndings } from '@work/application/events/handlers/dispatch-run-endings.handler';
import {
  requestedBy,
  runCancelled,
  runEnded,
  runExhausted,
  runFailed,
} from '@work/application/ports/runs.fake-spec';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import { TaskRunDetached } from '@work/domain/events/task-run-detached.event';
import { runOrderOf } from '@work/domain/value-objects/dispatch-order.fake-spec';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { DrizzleDispatchRepository } from '@work/infrastructure/persistence/drizzle/repositories/dispatch.repository';
import { eq } from 'drizzle-orm';
import fc from 'fast-check';
import { afterAll, beforeAll, describe, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import { requestedBySpec } from './support/runs';
import * as schema from './support/schema';

const START = new Date('2026-11-01T09:00:00.000Z').getTime();
const REDELIVERED_AFTER_MS = LEASE_MS + 1_000;
const HOLDER = 'runner_holder';
const RUNS = { numRuns: 60 };

interface Step {
  readonly event: number;
  readonly atOnce: boolean;
}

interface Delivery extends Step {
  readonly at: number;
}

const stepsOver = (events: number): fc.Arbitrary<readonly Step[]> =>
  fc.array(
    fc.record({
      event: fc.integer({ min: 0, max: events - 1 }),
      atOnce: fc.boolean(),
    }),
    { minLength: 1, maxLength: 5, size: 'max' },
  );

const timed = (steps: readonly Step[]): readonly Delivery[] =>
  steps.map((step, index) => ({
    ...step,
    at: START + index * REDELIVERED_AFTER_MS,
  }));

const firstOf = (deliveries: readonly Delivery[]): readonly Delivery[] =>
  deliveries
    .filter(
      (each, index) =>
        deliveries.findIndex((other) => other.event === each.event) === index,
    )
    .map((each) => ({ ...each, atOnce: false }));

const delivered = async (
  deliveries: readonly Delivery[],
  handle: (event: number, at: number) => Promise<void>,
): Promise<void> => {
  for (const each of deliveries) {
    const outcomes = await Promise.allSettled(
      each.atOnce
        ? [handle(each.event, each.at), handle(each.event, each.at)]
        : [handle(each.event, each.at)],
    );

    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        await handle(each.event, each.at + 1_000);
      }
    }
  }
};

const clockAt = (at: number): ClockPort => ({
  now: () => new Date(at),
  sleep: async () => {},
});

const about = (event: DomainEvent, runId: string): boolean =>
  'runId' in event &&
  event.runId instanceof RunId &&
  event.runId.value === runId;

const sameJson = (one: unknown, other: unknown): boolean =>
  JSON.stringify(one) === JSON.stringify(other);

let database: TestDatabase;
let context: DrizzleContext;
const committed: DomainEvent[] = [];

const dispatcher: DomainEventDispatcher = {
  dispatch: async (events) =>
    context.afterCommit(() => committed.push(...events)),
};

const committedKinds = (runId: string): readonly string[] =>
  committed.filter((event) => about(event, runId)).map((event) => event.kind);

beforeAll(async () => {
  database = await openDatabase('event_subscriber_redelivery');
  context = new DrizzleContext(database.db);
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const runsAt = (at: number) => {
  const runs = new DrizzleRunRepository(context, dispatcher);

  return {
    runs,
    service: new Runs(
      runs,
      {} as ContentHashPort,
      clockAt(at),
      {} as HeldHarnessKeys,
    ),
    completing: new CompleteRunHandler(
      runs,
      context,
      clockAt(at),
      {} as RunFileSources,
    ),
  };
};

const claimedRun = async (): Promise<string> => {
  const id = randomUUID();

  await database.db.insert(schema.run).values({
    id,
    workspaceId: `ws_${id}`,
    harness: 'dev',
    state: 'claimed',
    claimedBy: HOLDER,
    leaseExpiresAt: new Date(START + LEASE_MS),
    placement: [],
    ...requestedBySpec(id),
    spec: {
      command: { executable: 'sh', args: [] },
      briefing: 'do the thing',
      handover: { options: [], noteLimit: 0 },
      resume: {},
    },
  });

  return id;
};

const completedRun = async (runId: string, failed: boolean): Promise<void> => {
  await runsAt(START).completing.execute(
    new CompleteRunCommand(
      runId,
      HOLDER,
      failed ? 1 : 0,
      failed,
      undefined,
      { next: 'review', note: 'Which queue?' },
      'session_1',
    ),
  );
};

type RunBefore = 'queued' | 'claimed' | 'completed' | 'failed' | 'cancelled';

const runBefore = fc.constantFrom<RunBefore>(
  'queued',
  'claimed',
  'completed',
  'failed',
  'cancelled',
);

const runIn = async (before: RunBefore): Promise<string> => {
  const runId = await claimedRun();

  switch (before) {
    case 'queued':
      await database.db
        .update(schema.run)
        .set({ state: 'queued', claimedBy: null, leaseExpiresAt: null })
        .where(eq(schema.run.id, runId));
      return runId;
    case 'claimed':
      return runId;
    case 'completed':
    case 'failed':
      await completedRun(runId, before === 'failed');
      return runId;
    case 'cancelled':
      await database.db
        .update(schema.run)
        .set({ state: 'queued', claimedBy: null, leaseExpiresAt: null })
        .where(eq(schema.run.id, runId));
      await runsAt(START).service.cancel(RunId.of(runId), 'cancelled before');
      return runId;
  }
};

const runState = async (runId: string): Promise<unknown> => {
  const [row] = await database.db
    .select({
      state: schema.run.state,
      endedAt: schema.run.endedAt,
      stopRequestedAt: schema.run.stopRequestedAt,
      claimedBy: schema.run.claimedBy,
      leaseExpiresAt: schema.run.leaseExpiresAt,
      exitCode: schema.run.exitCode,
      failure: schema.run.failure,
      detail: schema.run.detail,
      stopped: schema.run.stopped,
    })
    .from(schema.run)
    .where(eq(schema.run.id, runId));

  return { row, events: committedKinds(runId) };
};

type EndedAs = 'completed' | 'failed' | 'exhausted' | 'cancelled';

type DispatchBefore = 'ordered' | 'enqueued' | 'refused';

const dispatchIn = async (before: DispatchBefore): Promise<RunId> => {
  const runId = RunId.of(randomUUID());
  const ordered = Dispatch.ordered({
    id: runId,
    workspaceId: WorkspaceId.of(`ws_${runId.value}`),
    teamId: null,
    subject: {
      kind: 'task',
      taskId: TaskId.of(`task_${runId.value}`),
      revision: TaskRevision.of(0),
      stationId: StationId.of('station_1'),
      driver: 'line',
    },
    configuredAs: null,
    order: runOrderOf(runId),
    now: new Date(START),
  });
  const dispatches = new DrizzleDispatchRepository(context, dispatcher);

  await dispatches.add(ordered);

  const found = await dispatches.find(runId);

  if (!found || before === 'ordered') {
    return runId;
  }

  await dispatches.save(
    before === 'enqueued'
      ? found.enqueuedAsRun()
      : found.refusedFor('order-refused'),
  );

  return runId;
};

const endedEvent = (
  runId: RunId,
  as: EndedAs,
  at: number,
): RunEndedIntegrationEvent => {
  const part = {
    runId: runId.value,
    workspaceId: `ws_${runId.value}`,
    requester: requestedBy.task(`task_${runId.value}`, 0),
    endedAt: new Date(at).toISOString(),
  };

  switch (as) {
    case 'completed':
      return runEnded(part);
    case 'failed':
      return runFailed(part);
    case 'exhausted':
      return runExhausted({ ...part, failure: 'runner-lost' });
    case 'cancelled':
      return runCancelled({ ...part, started: false });
  }
};

const dispatchState = async (runId: RunId): Promise<unknown> => {
  const [row] = await database.db
    .select({
      enqueued: schema.dispatch.enqueued,
      refused: schema.dispatch.refused,
      detachedAt: schema.dispatch.detachedAt,
      endedAt: schema.dispatch.endedAt,
      outcome: schema.dispatch.outcome,
      failure: schema.dispatch.failure,
      stopped: schema.dispatch.stopped,
      superseded: schema.dispatch.superseded,
    })
    .from(schema.dispatch)
    .where(eq(schema.dispatch.id, runId.value));

  return { row, events: committedKinds(runId.value) };
};

const endingsOf = (runId: RunId, as: EndedAs) => {
  const ended = endedEvent(runId, as, START);

  return (event: number, at: number): Promise<void> => {
    const endings = new DispatchRunEndings(
      new DrizzleDispatchRepository(context, dispatcher),
      clockAt(at),
    );

    return event === 0
      ? endings.onRunEnded(ended)
      : endings.onTaskRunDetached(
          new TaskRunDetached(
            TaskId.of(`task_${runId.value}`),
            WorkspaceId.of(`ws_${runId.value}`),
            runId,
          ),
        );
  };
};

const cancellingOf =
  (runId: string) =>
  (_event: number, at: number): Promise<void> =>
    new CancelDetachedRun(runsAt(at).service).on(
      new TaskRunDetached(
        TaskId.of(`task_${runId}`),
        WorkspaceId.of(`ws_${runId}`),
        RunId.of(runId),
      ),
    );

const launch = {
  skillHomes: () => ['.claude/skills'],
} as unknown as HarnessLaunchPort;

const usageRecorded: DomainEvent[] = [];

const recordingOf = (event: RunEnded) => (): Promise<void> =>
  new RecordRunUsage(
    new RunReadModel(new DrizzleRunFactsReader(context)),
    new DrizzleRunUsages(context, {
      dispatch: async (events) =>
        context.afterCommit(() => usageRecorded.push(...events)),
    }),
    launch,
  ).onRunEnded(event);

const endedRunWith = async (
  steps: readonly string[],
  failed: boolean,
): Promise<RunEnded> => {
  const runId = await claimedRun();

  await new DrizzleRunJournal(context, clockAt(START)).append(
    RunAttempt.of(RunId.of(runId), 1),
    steps.map((message, index) => ({
      seq: index + 1,
      type: 'step.ended',
      at: new Date(START + index * 1_000),
      message,
    })),
  );
  await completedRun(runId, failed);

  const ended = committed.find(
    (event): event is RunEnded =>
      event instanceof RunEnded && event.runId.value === runId,
  );

  if (!ended) {
    throw new Error(`Run ${runId} ended without a RunEnded event`);
  }

  return ended;
};

const usageState = async (runId: RunId): Promise<unknown> => {
  const rows = await database.db
    .select({
      attempt: schema.runUsage.attempt,
      ms: schema.runUsage.ms,
      steps: schema.runUsage.steps,
      errors: schema.runUsage.errors,
      changedLines: schema.runUsage.changedLines,
      inputTokens: schema.runUsage.inputTokens,
      outputTokens: schema.runUsage.outputTokens,
      tools: schema.runUsage.tools,
    })
    .from(schema.runUsage)
    .where(eq(schema.runUsage.runId, runId.value));

  return {
    rows,
    events: usageRecorded
      .filter((event) => about(event, runId.value))
      .map((event) => event.kind),
  };
};

describe('a subscriber handed the same event again, later or at once', () => {
  it('ends or detaches a dispatch as if it heard each event once', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<DispatchBefore>('ordered', 'enqueued', 'refused'),
        fc.constantFrom<EndedAs>(
          'completed',
          'failed',
          'exhausted',
          'cancelled',
        ),
        stepsOver(2),
        async (before, as, steps) => {
          const deliveries = timed(steps);
          const once = await dispatchIn(before);
          const again = await dispatchIn(before);

          await delivered(firstOf(deliveries), endingsOf(once, as));
          await delivered(deliveries, endingsOf(again, as));

          return sameJson(
            await dispatchState(once),
            await dispatchState(again),
          );
        },
      ),
      RUNS,
    );
  }, 120_000);

  it('cancels a detached run as if it heard the detachment once', async () => {
    await fc.assert(
      fc.asyncProperty(runBefore, stepsOver(1), async (before, steps) => {
        const deliveries = timed(steps);
        const once = await runIn(before);
        const again = await runIn(before);

        await delivered(firstOf(deliveries), cancellingOf(once));
        await delivered(deliveries, cancellingOf(again));

        return sameJson(await runState(once), await runState(again));
      }),
      RUNS,
    );
  }, 120_000);

  it('records the usage of an ended run once, however often it hears the run ended', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom('build', 'test', 'lint'), { maxLength: 3 }),
        fc.boolean(),
        stepsOver(1),
        async (steps, failed, redeliveries) => {
          const deliveries = timed(redeliveries);
          const once = await endedRunWith(steps, failed);
          const again = await endedRunWith(steps, failed);

          await delivered(firstOf(deliveries), recordingOf(once));
          await delivered(deliveries, recordingOf(again));

          return sameJson(
            await usageState(once.runId),
            await usageState(again.runId),
          );
        },
      ),
      RUNS,
    );
  }, 120_000);
});
