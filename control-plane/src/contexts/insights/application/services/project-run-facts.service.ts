import type {
  RunFactOwner,
  RunFactsPort,
} from '@insights/application/ports/run-facts.port';
import { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { PullRequestRecordRepository } from '@insights/domain/repositories/pull-request-record.repository';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import type { TaskHumanActionsRepository } from '@insights/domain/repositories/task-human-actions.repository';
import type {
  RunFact,
  TaskOpeningFact,
} from '@insights/domain/value-objects/run-fact.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
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
    private readonly humanActions: TaskHumanActionsRepository,
    private readonly pullRequests: PullRequestRecordRepository,
    private readonly facts: RunFactsPort,
    private readonly transaction: TransactionPort,
  ) {}

  ofRuns(runIds: readonly RunId[]): Promise<void> {
    if (runIds.length === 0) {
      return Promise.resolve();
    }

    return this.transaction.inTransaction(async () => {
      const records = await this.records.ofRuns(runIds);
      const projectedTasks = await this.facts.tasksOfRuns(runIds);

      await this.facts.lockTasks([...tasksOf(records), ...projectedTasks]);

      const projected = await this.factsOf(records);
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

      const projected = await this.factsOf(await this.records.ofTasks(taskIds));
      const kept = new Set(projected.map((each) => each.runId.value));

      await this.facts.put(projected);
      await this.facts.drop(
        (await this.facts.runsOfTasks(taskIds)).filter(
          (each) => !kept.has(each.value),
        ),
      );
      await this.projectTaskPullRequests(taskIds);
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
      const last = runIds[runIds.length - 1];

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
      const last = records[records.length - 1];

      if (last === undefined) {
        break;
      }

      checked += records.length;
      const differing = await this.facts.differing(await this.factsOf(records));

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

  private async projectTaskPullRequests(
    taskIds: readonly TaskId[],
  ): Promise<void> {
    const owned = await this.pullRequests.ownedBy(taskIds);
    const projected = new Set<string>();

    const latest = taskIds.flatMap((taskId) => {
      const current = PullRequestRecord.latestOwnedOf(
        owned.filter((each) => each.owner?.taskId.equals(taskId)),
      );
      return current ? [current] : [];
    });

    await this.facts.putTaskPullRequests(latest);

    for (const each of latest) {
      projected.add(each.taskId.value);
    }

    await this.facts.dropTaskPullRequests(
      taskIds.filter((each) => !projected.has(each.value)),
    );
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
  ): Promise<readonly RunFact[]> {
    const ended = records.filter((each) => each.hasEnded);
    const tasks = tasksOf(ended);

    if (tasks.length === 0) {
      return [];
    }

    const openings = new Map<string, TaskOpeningFact>();

    for (const each of await this.humanActions.ofTasks(tasks)) {
      if (each.opening) {
        openings.set(placeKey(each.workspaceId.value, each.taskId.value), {
          by: each.opening.by,
          at: each.opening.at,
        });
      }
    }

    const owned = new Map<string, PullRequestRecord[]>();

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
        PullRequestRecord.latestOwnedOf(owned.get(key) ?? []),
      );

      return fact ? [fact] : [];
    });
  }
}
