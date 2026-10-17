import { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import { RunRecordVersionConflictError } from '@outcomes/domain/exceptions/run-record-version-conflict.error';
import { TaskDeliveryVersionConflictError } from '@outcomes/domain/exceptions/task-delivery-version-conflict.error';
import type {
  RunListing,
  RunRecordRepository,
  StationRecords,
  TeamWindow,
} from '@outcomes/domain/repositories/run-record.repository';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import {
  earliestBounds,
  type StretchBound,
} from '@outcomes/domain/services/config-stretches';
import {
  inEndOrder,
  inStartOrder,
  type StartedRun,
  startOf,
} from '@outcomes/domain/services/run-order';
import { RunCost } from '@outcomes/domain/value-objects/run-cost.vo';
import { RunEnd } from '@outcomes/domain/value-objects/run-end.vo';
import type { RunEnding } from '@outcomes/domain/value-objects/run-ending';
import { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import { RunSetup } from '@outcomes/domain/value-objects/run-setup.vo';
import { RunTools } from '@outcomes/domain/value-objects/run-tools.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const fromBound = (run: StartedRun, bound: StretchBound): boolean =>
  run.beganAt.getTime() > bound.from.getTime() ||
  (run.beganAt.getTime() === bound.from.getTime() &&
    (bound.fromRun === undefined || run.runId.value >= bound.fromRun.value));

export const WORKSPACE = WorkspaceId.of('ws_1');
export const TEAM = TeamId.of('team_1');
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
    queuedAt?: Date | null;
    startedAt?: Date | null;
    ending?: RunEnding;
    failure?: string | null;
    round?: number;
    asked?: boolean;
    harness?: string;
    model?: string | null;
    effort?: string | null;
    profileKey?: string | null;
    repositories?: readonly string[];
    skills?: readonly string[];
  } = {},
): RunEnd =>
  RunEnd.of({
    place: placeOf(change.taskId, change.stationId),
    fingerprint:
      change.fingerprint === undefined ? FIRST_CONFIG : change.fingerprint,
    setup: RunSetup.of({
      harness: change.harness ?? 'claude-code',
      model: change.model === undefined ? 'sonnet' : change.model,
      effort: change.effort ?? null,
      profileKey: change.profileKey ?? null,
      repositories: change.repositories ?? ['acme/api'],
      skills: change.skills ?? [],
    }),
    queuedAt: change.queuedAt === undefined ? null : change.queuedAt,
    startedAt: change.startedAt === undefined ? null : change.startedAt,
    endedAt: change.endedAt ?? new Date('2026-09-30T10:00:00.000Z'),
    ending: change.ending ?? 'completed',
    failure: change.failure ?? null,
    round: change.round ?? 1,
    asked: change.asked ?? false,
  });

export const costOf = (
  change: {
    ms?: number | null;
    amount?: number | null;
    currency?: string | null;
    steps?: number;
    changedLines?: number;
  } = {},
): RunCost =>
  RunCost.of({
    ms: change.ms === undefined ? 60_000 : change.ms,
    steps: change.steps ?? 10,
    faults: 0,
    changedLines: change.changedLines ?? 0,
    used: 1_000,
    size: null,
    amount: change.amount === undefined ? 0.5 : change.amount,
    currency: change.currency === undefined ? 'USD' : change.currency,
    tokens: { input: null, output: null, cacheRead: null, cacheWrite: null },
  });

export const endedRecord = (
  runId: string,
  change: Parameters<typeof endOf>[0] = {},
): RunRecord =>
  RunRecord.heardOf(RunId.of(runId), WORKSPACE).recordEnd(endOf(change));

export const costedRecord = (
  runId: string,
  change: NonNullable<Parameters<typeof endOf>[0]> &
    NonNullable<Parameters<typeof costOf>[0]> & { tools?: RunTools } = {},
): RunRecord =>
  endedRecord(runId, change).recordDigest(
    costOf(change),
    change.tools ?? RunTools.NONE,
  );

const endedTime = (record: RunRecord): number =>
  record.end?.endedAt.getTime() ?? 0;

export const lastConfigRunsFrom = (
  records: readonly RunRecord[],
  bounds: readonly StretchBound[],
): readonly RunRecord[] => {
  const earliest = earliestBounds(bounds);
  const last = new Map<string, RunRecord>();

  for (const record of [...records].sort((one, other) =>
    inStartOrder(startOf(one), startOf(other)),
  )) {
    const end = record.end;
    const bound = end ? earliest.get(end.place.stationId) : undefined;

    if (
      end?.ranItsConfig &&
      end.fingerprint !== null &&
      bound &&
      !fromBound(startOf(record), bound)
    ) {
      last.set(end.place.stationId, record);
    }
  }

  return [...last.values()];
};

export interface RunPage {
  readonly records: readonly RunRecord[];
  readonly total: number;
}

export class RunRecordsInMemory implements RunRecordRepository {
  readonly held = new Map<string, RunRecord>();
  readonly raised: DomainEvent[] = [];

  async add(record: RunRecord): Promise<void> {
    if (this.held.has(record.runId.value)) {
      throw new RunRecordVersionConflictError(record.runId.value);
    }
    this.raised.push(...record.pullEvents());
    this.held.set(record.runId.value, record);
  }

  async save(record: RunRecord): Promise<void> {
    const held = this.held.get(record.runId.value);

    if (!held || held.version !== record.version) {
      throw new RunRecordVersionConflictError(record.runId.value);
    }
    this.raised.push(...record.pullEvents());
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

  async ofTasks(taskIds: readonly TaskId[]): Promise<readonly RunRecord[]> {
    return [...this.held.values()].filter((each) =>
      taskIds.some((taskId) => each.taskId?.equals(taskId)),
    );
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

  async lastConfigRunsBefore(
    teamId: TeamId,
    bounds: readonly StretchBound[],
  ): Promise<readonly RunRecord[]> {
    return lastConfigRunsFrom(
      this.ended().filter((each) => each.end?.place.teamId.equals(teamId)),
      bounds,
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

  async latestStartedAtStation(
    criteria: StationRecords,
  ): Promise<readonly RunRecord[]> {
    return this.ended()
      .filter(
        (each) =>
          each.workspaceId.equals(criteria.workspaceId) &&
          each.end?.place.teamId.equals(criteria.teamId) &&
          each.end.place.stationId === criteria.stationId &&
          (criteria.lineId === null ||
            each.end.place.lineId === criteria.lineId),
      )
      .sort((one, other) => inStartOrder(startOf(other), startOf(one)))
      .slice(0, criteria.last);
  }

  async endedForTeam(
    window: TeamWindow,
    max: number,
  ): Promise<readonly RunRecord[]> {
    return [...this.endedIn(window)]
      .sort((one, other) => inStartOrder(startOf(other), startOf(one)))
      .slice(0, max)
      .sort(inEndOrder);
  }

  async listedForTeam(listing: RunListing): Promise<RunPage> {
    const { filter } = listing;
    const matching = this.endedIn(listing.window)
      .filter((each) => {
        const end = each.end;

        return (
          end !== null &&
          (filter.stationId === null ||
            end.place.stationId === filter.stationId) &&
          (filter.lineId === null || end.place.lineId === filter.lineId) &&
          (filter.outcome === null || each.ending === filter.outcome) &&
          (filter.taskIds === null ||
            filter.taskIds.includes(end.place.taskId.value))
        );
      })
      .reverse();

    return {
      records: matching.slice(listing.offset, listing.offset + listing.limit),
      total: matching.length,
    };
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

  private endedIn(window: TeamWindow): RunRecord[] {
    return this.ended()
      .filter(
        (each) =>
          each.workspaceId.equals(window.workspaceId) &&
          each.end?.place.teamId.equals(window.teamId) &&
          endedTime(each) >= window.from.getTime() &&
          endedTime(each) < window.to.getTime(),
      )
      .sort((a, b) => endedTime(a) - endedTime(b));
  }

  private ended(): RunRecord[] {
    return [...this.held.values()].filter((each) => each.hasEnded);
  }
}

export class TaskDeliveriesInMemory implements TaskDeliveryRepository {
  readonly held = new Map<string, TaskDelivery>();
  readonly raised: DomainEvent[] = [];

  async add(delivery: TaskDelivery): Promise<void> {
    if (this.held.has(delivery.taskId.value)) {
      throw new TaskDeliveryVersionConflictError(delivery.taskId.value);
    }
    this.raised.push(...delivery.pullEvents());
    this.held.set(delivery.taskId.value, delivery);
  }

  async save(delivery: TaskDelivery): Promise<void> {
    const held = this.held.get(delivery.taskId.value);

    if (!held || held.version !== delivery.version) {
      throw new TaskDeliveryVersionConflictError(delivery.taskId.value);
    }
    this.raised.push(...delivery.pullEvents());
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

  async ofTeamBetween(
    window: TeamWindow,
    max: number,
  ): Promise<readonly TaskDelivery[]> {
    return [...this.held.values()]
      .filter(
        (each) =>
          each.workspaceId.equals(window.workspaceId) &&
          each.teamId.equals(window.teamId) &&
          each.openedAt.getTime() < window.to.getTime() &&
          (each.closedAt === null
            ? each.openedAt.getTime() >= window.from.getTime() ||
              (each.firstReviewAt?.getTime() ?? 0) >= window.from.getTime()
            : each.closedAt.getTime() >= window.from.getTime()),
      )
      .sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime())
      .slice(0, max);
  }

  async ofTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<readonly TaskDelivery[]> {
    return [...this.held.values()].filter(
      (each) =>
        each.workspaceId.equals(workspaceId) && each.teamId.equals(teamId),
    );
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

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (each.workspaceId.equals(workspaceId) && each.teamId.equals(teamId)) {
        this.held.delete(each.taskId.value);
      }
    }
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (each.workspaceId.equals(workspaceId)) {
        this.held.delete(each.taskId.value);
      }
    }
  }
}

export const SET_UP = {
  harness: 'claude-code',
  model: 'sonnet',
  effort: null,
  profileKey: null,
  repositories: ['acme/api'],
  skills: [],
  queuedAt: new Date('2026-09-01T00:00:00.000Z'),
  startedAt: null,
};

export const NOBODY_ELSE = {
  membershipOnTeam: async () => null,
  namesOf: async () => new Map<string, string>(),
};

export const inTransaction = {
  inTransaction: <T>(work: () => Promise<T>): Promise<T> => work(),
};
