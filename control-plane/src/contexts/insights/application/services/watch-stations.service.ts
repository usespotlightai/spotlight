import type { DeletionsPort } from '@insights/application/ports/deletions.port';
import type { WorkPort } from '@insights/application/ports/work.port';
import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import {
  type RuleReading,
  StationAlertState,
  type WatchedStation,
} from '@insights/domain/aggregates/station-alert-state.aggregate';
import type { RunRecordEnded } from '@insights/domain/events/run-record-ended.event';
import type { RunRecordEnriched } from '@insights/domain/events/run-record-enriched.event';
import type { TaskPullRequestClosed } from '@insights/domain/events/task-pull-request-closed.event';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import type { StationAlertStateRepository } from '@insights/domain/repositories/station-alert-state.repository';
import type { TaskPullRequestRepository } from '@insights/domain/repositories/task-pull-request.repository';
import { readingOf } from '@insights/domain/services/station-measures';
import { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import type { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const UNMEASURED_SLACK = 4;

export interface WatchRepositories {
  readonly records: RunRecordRepository;
  readonly taskPullRequests: TaskPullRequestRepository;
  readonly alertStates: StationAlertStateRepository;
  readonly deletions: DeletionsPort;
}

export interface LineChanged {
  readonly lineId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly stationIds: readonly string[];
}

const endedAt = (record: RunRecord): number =>
  record.end?.endedAt.getTime() ?? 0;

const newestAtEachStation = (
  records: readonly RunRecord[],
): readonly RunRecord[] => {
  const newest = new Map<string, RunRecord>();

  for (const record of records) {
    const stationId = record.end?.location.stationId;
    const known = stationId ? newest.get(stationId) : undefined;

    if (stationId && (!known || endedAt(record) > endedAt(known))) {
      newest.set(stationId, record);
    }
  }

  return [...newest.values()];
};

const stationAt = (
  workspaceId: WorkspaceId,
  location: RunLocation,
): WatchedStation => ({
  workspaceId,
  teamId: location.teamId,
  lineId: location.lineId,
  stationId: location.stationId,
});

export class WatchStations {
  constructor(
    private readonly work: WorkPort,
    private readonly repositories: WatchRepositories,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  runEnded(event: RunRecordEnded): Promise<void> {
    return this.watch(stationAt(event.workspaceId, event.location));
  }

  runEnriched(event: RunRecordEnriched): Promise<void> {
    return this.watch(stationAt(event.workspaceId, event.location));
  }

  async pullRequestClosed(event: TaskPullRequestClosed): Promise<void> {
    const records = await this.repositories.records.ofTasks([event.taskId]);

    for (const record of newestAtEachStation(records)) {
      if (record.end) {
        await this.watch(stationAt(event.workspaceId, record.end.location));
      }
    }
  }

  async lineChanged(event: LineChanged): Promise<void> {
    for (const stationId of event.stationIds) {
      await this.watch({
        workspaceId: WorkspaceId.of(event.workspaceId),
        teamId: TeamId.of(event.teamId),
        lineId: event.lineId,
        stationId,
      });
    }
  }

  private async watch(station: WatchedStation): Promise<void> {
    const { workspaceId, teamId } = station;
    const rules = (await this.work.alertsAt(station.stationId)) ?? [];

    await this.transaction.inTransaction(async () => {
      await this.repositories.deletions.lockDeletion(workspaceId, null, teamId);

      if (
        await this.repositories.deletions.isDeleted(workspaceId, null, teamId)
      ) {
        return;
      }

      const existing = await this.repositories.alertStates.of(
        station.stationId,
      );

      if (!existing && rules.length === 0) {
        return;
      }

      const max = Math.max(0, ...rules.map((each) => each.runsNeeded));
      const records =
        max === 0
          ? []
          : await this.repositories.records.lastAtStation({
              workspaceId,
              teamId,
              lineId: station.lineId,
              stationId: station.stationId,
              last: max * UNMEASURED_SLACK,
            });
      const taskPullRequests =
        await this.repositories.taskPullRequests.forTasks(
          records.flatMap((each) => (each.taskId ? [each.taskId] : [])),
        );
      const readings = await this.notDeleted(
        station,
        rules.map((rule) => ({
          rule,
          reading: readingOf(rule, records, taskPullRequests),
        })),
      );
      const alertState = existing ?? StationAlertState.start(station);
      const checked = alertState.check(readings, this.clock.now(), () =>
        AlertId.of(this.ids.generate()),
      );

      if (checked === alertState) {
        return;
      }

      await (existing
        ? this.repositories.alertStates.save(checked)
        : this.repositories.alertStates.add(checked));
    });
  }

  private async notDeleted(
    station: WatchedStation,
    readings: readonly RuleReading[],
  ): Promise<readonly RuleReading[]> {
    const tasks = [
      ...new Set(
        readings.flatMap((each) =>
          each.reading ? [each.reading.taskId.value] : [],
        ),
      ),
    ].sort();
    const deleted = new Set<string>();

    for (const task of tasks) {
      const taskId = TaskId.of(task);

      await this.repositories.deletions.lockDeletion(
        station.workspaceId,
        taskId,
        station.teamId,
      );

      if (
        await this.repositories.deletions.isDeleted(
          station.workspaceId,
          taskId,
          station.teamId,
        )
      ) {
        deleted.add(task);
      }
    }

    return readings.map((each) =>
      each.reading && deleted.has(each.reading.taskId.value)
        ? { rule: each.rule, reading: null }
        : each,
    );
  }
}
