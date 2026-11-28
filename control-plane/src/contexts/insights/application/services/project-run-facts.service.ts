import type { RunEndingsPort } from '@insights/application/ports/run-endings.port';
import type {
  RunFactOwner,
  RunFactsPort,
} from '@insights/application/ports/run-facts.port';
import { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { PullRequestRecordRepository } from '@insights/domain/repositories/pull-request-record.repository';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import type { TaskActionsRepository } from '@insights/domain/repositories/task-actions.repository';
import { followedAtOf } from '@insights/domain/services/followed-run';
import type {
  RunFact,
  TaskOpeningFact,
} from '@insights/domain/value-objects/run-fact.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { itemAt } from '@shared-kernel/domain/item-at';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export interface RunFactsDrift {
  readonly checked: number;
  readonly repaired: readonly string[];
}

export interface RunFactsMaintenance {
  repairEndedSince(since: Date): Promise<RunFactsDrift>;

  rebuild(owner: RunFactOwner): Promise<number>;

  workspaces(): Promise<readonly string[]>;
}

const AT_ONCE = 100;

const placeKey = (workspaceId: string, taskId: string): string =>
  `${workspaceId}\u0000${taskId}`;

const withTaskRecords = (
  records: readonly RunRecord[],
  taskRecords: readonly RunRecord[],
): readonly RunRecord[] => {
  const byRun = new Map(records.map((each) => [each.runId.value, each]));

  for (const each of taskRecords) {
    byRun.set(each.runId.value, byRun.get(each.runId.value) ?? each);
  }

  return [...byRun.values()];
};

const distinct = (taskIds: readonly TaskId[]): readonly TaskId[] => [
  ...new Map(taskIds.map((each) => [each.value, each])).values(),
];

const tasksOf = (records: readonly RunRecord[]): readonly TaskId[] =>
  [
    ...new Set(
      records.flatMap((each) => (each.taskId ? [each.taskId.value] : [])),
    ),
  ]
    .sort()
    .map(TaskId.of);

export class ProjectRunFacts implements RunFactsMaintenance {
  constructor(
    private readonly records: RunRecordRepository,
    private readonly taskActions: TaskActionsRepository,
    private readonly pullRequests: PullRequestRecordRepository,
    private readonly facts: RunFactsPort,
    private readonly endings: RunEndingsPort,
    private readonly transaction: TransactionPort,
  ) {}

  ofRuns(runIds: readonly RunId[]): Promise<void> {
    if (runIds.length === 0) {
      return Promise.resolve();
    }

    return this.transaction.inTransaction(async () => {
      const records = await this.records.ofRuns(runIds);
      const projectedTasks = await this.facts.tasksOfRuns(runIds);

      const tasks = distinct([...tasksOf(records), ...projectedTasks]);

      await this.facts.lockTasks(tasks);

      const taskRecords = await this.records.ofTasks(tasks);
      const projected = await this.factsOf(
        withTaskRecords(records, taskRecords),
        taskRecords,
      );
      const kept = new Set(projected.map((each) => each.runId.value));

      await this.facts.put(projected);
      await this.facts.drop(runIds.filter((each) => !kept.has(each.value)));
    });
  }

  ofTasks(taskIds: readonly TaskId[]): Promise<void> {
    if (taskIds.length === 0) {
      return Promise.resolve();
    }

    return this.transaction.inTransaction(async () => {
      await this.facts.lockTasks(taskIds);

      const records = await this.records.ofTasks(taskIds);
      const projected = await this.factsOf(records, records);
      const kept = new Set(projected.map((each) => each.runId.value));

      await this.facts.put(projected);
      await this.facts.drop(
        (await this.facts.runsOfTasks(taskIds)).filter(
          (each) => !kept.has(each.value),
        ),
      );
    });
  }

  async rebuild(owner: RunFactOwner): Promise<number> {
    let after: RunId | null = null;
    let rebuilt = 0;

    for (;;) {
      const runIds = await this.records.runIdsOf(
        {
          workspaceId: owner.workspaceId,
          teamId: owner.kind === 'team' ? owner.teamId : null,
        },
        after,
        AT_ONCE,
      );
      const last = itemAt(runIds, runIds.length - 1);

      if (last === undefined) {
        break;
      }

      await this.ofRuns(runIds);
      rebuilt += runIds.length;
      after = last;
    }

    const stored = await this.facts.runsOf(owner);

    for (let at = 0; at < stored.length; at += AT_ONCE) {
      await this.dropOrphans(stored.slice(at, at + AT_ONCE));
    }

    return rebuilt;
  }

  async repairEndedSince(since: Date): Promise<RunFactsDrift> {
    const repaired = new Map<string, RunId>();
    let after: RunId | null = null;
    let checked = 0;

    for (;;) {
      const records = await this.records.endedSince(since, after, AT_ONCE);
      const last = itemAt(records, records.length - 1);

      if (last === undefined) {
        break;
      }

      checked += records.length;
      const differing = await this.facts.differing(
        await this.factsOf(
          records,
          await this.records.ofTasks(tasksOf(records)),
        ),
      );

      for (const runId of differing) {
        repaired.set(runId.value, runId);
      }

      after = last.runId;
    }

    for (const runId of await this.orphansOf(
      await this.facts.runsEndedSince(since),
    )) {
      repaired.set(runId.value, runId);
    }

    const all = [...repaired.values()];

    for (let at = 0; at < all.length; at += AT_ONCE) {
      await this.ofRuns(all.slice(at, at + AT_ONCE));
    }

    return { checked, repaired: all.map((each) => each.value) };
  }

  async workspaces(): Promise<readonly string[]> {
    return (await this.facts.workspaces()).map((each) => each.value);
  }

  private async dropOrphans(runIds: readonly RunId[]): Promise<void> {
    const orphans = await this.orphansOf(runIds);

    if (orphans.length > 0) {
      await this.ofRuns(orphans);
    }
  }

  private async orphansOf(runIds: readonly RunId[]): Promise<readonly RunId[]> {
    const orphans: RunId[] = [];

    for (let at = 0; at < runIds.length; at += AT_ONCE) {
      const batch = runIds.slice(at, at + AT_ONCE);
      const ended = new Set(
        (await this.records.ofRuns(batch))
          .filter((each) => each.hasEnded)
          .map((each) => each.runId.value),
      );

      orphans.push(...batch.filter((each) => !ended.has(each.value)));
    }

    return orphans;
  }

  private async factsOf(
    records: readonly RunRecord[],
    siblings: readonly RunRecord[],
  ): Promise<readonly RunFact[]> {
    const ended = records.filter((each) => each.hasEnded);
    const tasks = tasksOf(ended);

    if (tasks.length === 0) {
      return [];
    }

    const openings = new Map<string, TaskOpeningFact>();

    for (const each of await this.taskActions.ofTasks(tasks)) {
      if (each.opening) {
        openings.set(placeKey(each.workspaceId.value, each.taskId.value), {
          by: each.opening.by,
          at: each.opening.at,
        });
      }
    }

    const owned = new Map<string, PullRequestRecord[]>();
    const taskRecords = new Map<string, RunRecord[]>();

    for (const each of withTaskRecords(ended, siblings)) {
      if (each.taskId) {
        const key = placeKey(each.workspaceId.value, each.taskId.value);
        taskRecords.set(key, [...(taskRecords.get(key) ?? []), each]);
      }
    }

    for (const each of await this.pullRequests.ownedBy(tasks)) {
      if (each.owner) {
        const key = placeKey(each.workspaceId.value, each.owner.taskId.value);
        owned.set(key, [...(owned.get(key) ?? []), each]);
      }
    }

    return ended.flatMap((record) => {
      const key = placeKey(
        record.workspaceId.value,
        record.taskId?.value ?? '',
      );
      const fact = record.factWith(
        openings.get(key) ?? null,
        PullRequestRecord.taskPullRequestsOf(owned.get(key) ?? []),
        followedAtOf(record, taskRecords.get(key) ?? []),
        record.end ? this.endings.outsideCauseOf(record.end) : null,
      );

      return fact ? [fact] : [];
    });
  }
}
