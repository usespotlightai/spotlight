import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import { RunRecordMovedOnError } from '@outcomes/domain/exceptions/run-record-moved-on.error';
import { TaskDeliveryMovedOnError } from '@outcomes/domain/exceptions/task-delivery-moved-on.error';
import type {
  RunRecordRepository,
  StationRecords,
} from '@outcomes/domain/repositories/run-record.repository';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import { RunCost } from '@outcomes/domain/value-objects/run-cost.vo';
import { RunEnd } from '@outcomes/domain/value-objects/run-end.vo';
import type { RunEnding } from '@outcomes/domain/value-objects/run-ending';
import { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE = WorkspaceId.of('ws_1');
const TEAM = TeamId.of('team_1');
export const FIRST_CONFIG = 'a'.repeat(64);
export const SECOND_CONFIG = 'b'.repeat(64);

const placeOf = (taskId = 'task_1', stationId = 'station_1'): RunPlace =>
  RunPlace.of({
    teamId: TEAM,
    lineId: 'line_1',
    stationId,
    taskId: TaskId.of(taskId),
  });

export const endOf = (
  change: {
    taskId?: string;
    stationId?: string;
    fingerprint?: string | null;
    endedAt?: Date;
    ending?: RunEnding;
    failure?: string | null;
    round?: number;
  } = {},
): RunEnd =>
  RunEnd.of({
    place: placeOf(change.taskId, change.stationId),
    fingerprint:
      change.fingerprint === undefined ? FIRST_CONFIG : change.fingerprint,
    endedAt: change.endedAt ?? new Date('2026-09-30T10:00:00.000Z'),
    ending: change.ending ?? 'completed',
    failure: change.failure ?? null,
    round: change.round ?? 1,
  });

export const costOf = (
  change: {
    ms?: number | null;
    amount?: number | null;
    currency?: string | null;
  } = {},
): RunCost =>
  RunCost.of({
    ms: change.ms === undefined ? 60_000 : change.ms,
    steps: 10,
    faults: 0,
    used: 1_000,
    amount: change.amount === undefined ? 0.5 : change.amount,
    currency: change.currency === undefined ? 'USD' : change.currency,
  });

export const endedRecord = (
  runId: string,
  change: Parameters<typeof endOf>[0] = {},
): RunRecord =>
  RunRecord.heardOf(RunId.of(runId), WORKSPACE).ended(endOf(change));

export class RunRecordsInMemory implements RunRecordRepository {
  readonly held = new Map<string, RunRecord>();

  async add(record: RunRecord): Promise<void> {
    if (this.held.has(record.runId.value)) {
      throw new RunRecordMovedOnError(record.runId.value);
    }
    this.held.set(record.runId.value, record);
  }

  async save(record: RunRecord): Promise<void> {
    const held = this.held.get(record.runId.value);

    if (!held || held.version !== record.version) {
      throw new RunRecordMovedOnError(record.runId.value);
    }
    this.held.set(
      record.runId.value,
      RunRecord.rehydrate({ ...record, version: record.version + 1 }),
    );
  }

  async of(runId: RunId): Promise<RunRecord | null> {
    return this.held.get(runId.value) ?? null;
  }

  async ofRuns(runIds: readonly RunId[]): Promise<readonly RunRecord[]> {
    return runIds.flatMap((each) => {
      const held = this.held.get(each.value);
      return held ? [held] : [];
    });
  }

  async lastEndedOfTaskAt(
    taskId: TaskId,
    stationId: string,
    by: Date,
  ): Promise<RunRecord | null> {
    return (
      this.ended()
        .filter(
          (each) =>
            each.ran &&
            each.end?.place.taskId.equals(taskId) &&
            each.end.place.stationId === stationId &&
            each.end.endedAt.getTime() <= by.getTime(),
        )
        .sort(
          (a, b) =>
            (b.end?.endedAt.getTime() ?? 0) - (a.end?.endedAt.getTime() ?? 0),
        )[0] ?? null
    );
  }

  async lastAtStation(criteria: StationRecords): Promise<readonly RunRecord[]> {
    return this.ended()
      .filter(
        (each) =>
          each.workspaceId.equals(criteria.workspaceId) &&
          each.end?.place.teamId.equals(criteria.teamId) &&
          each.end.place.stationId === criteria.stationId &&
          (criteria.lineId === null ||
            each.end.place.lineId === criteria.lineId),
      )
      .sort(
        (a, b) =>
          (b.end?.endedAt.getTime() ?? 0) - (a.end?.endedAt.getTime() ?? 0),
      )
      .slice(0, criteria.last);
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (each.taskId?.equals(taskId)) {
        this.held.delete(each.runId.value);
      }
    }
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    for (const each of this.ended()) {
      if (
        each.workspaceId.equals(workspaceId) &&
        each.end?.place.teamId.equals(teamId)
      ) {
        this.held.delete(each.runId.value);
      }
    }
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (each.workspaceId.equals(workspaceId)) {
        this.held.delete(each.runId.value);
      }
    }
  }

  private ended(): RunRecord[] {
    return [...this.held.values()].filter((each) => each.hasEnded);
  }
}

export class TaskDeliveriesInMemory implements TaskDeliveryRepository {
  readonly held = new Map<string, TaskDelivery>();

  async add(delivery: TaskDelivery): Promise<void> {
    if (this.held.has(delivery.taskId.value)) {
      throw new TaskDeliveryMovedOnError(delivery.taskId.value);
    }
    this.held.set(delivery.taskId.value, delivery);
  }

  async save(delivery: TaskDelivery): Promise<void> {
    const held = this.held.get(delivery.taskId.value);

    if (!held || held.version !== delivery.version) {
      throw new TaskDeliveryMovedOnError(delivery.taskId.value);
    }
    this.held.set(
      delivery.taskId.value,
      TaskDelivery.rehydrate({ ...delivery, version: delivery.version + 1 }),
    );
  }

  async forTask(taskId: TaskId): Promise<TaskDelivery | null> {
    return this.held.get(taskId.value) ?? null;
  }

  async forTasks(taskIds: readonly TaskId[]): Promise<readonly TaskDelivery[]> {
    return taskIds.flatMap((each) => {
      const held = this.held.get(each.value);
      return held ? [held] : [];
    });
  }

  async forPullRequest(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<TaskDelivery | null> {
    return (
      [...this.held.values()].find(
        (each) =>
          each.workspaceId.equals(workspaceId) &&
          each.pullRequest.equals(pullRequest),
      ) ?? null
    );
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    this.held.delete(taskId.value);
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (each.workspaceId.equals(workspaceId)) {
        this.held.delete(each.taskId.value);
      }
    }
  }
}

export const inTransaction = {
  run: <T>(work: () => Promise<T>): Promise<T> => work(),
};
