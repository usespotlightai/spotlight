import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import {
  type RuleReading,
  StationWatch,
  type WatchedStation,
} from '@outcomes/domain/aggregates/station-watch.aggregate';
import type { RunRecordEnded } from '@outcomes/domain/events/run-record-ended.event';
import type { RunRecordSettled } from '@outcomes/domain/events/run-record-settled.event';
import type { TaskDeliveryClosed } from '@outcomes/domain/events/task-delivery-closed.event';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import type { StationWatchRepository } from '@outcomes/domain/repositories/station-watch.repository';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import { readingOf } from '@outcomes/domain/services/station-measures';
import { AlertId } from '@outcomes/domain/value-objects/alert-id.vo';
import type { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const UNSETTLED_SLACK = 4;

export interface WatchRepositories {
  readonly records: RunRecordRepository;
  readonly deliveries: TaskDeliveryRepository;
  readonly watches: StationWatchRepository;
  readonly forgotten: ForgottenPort;
}

export interface LineRedefined {
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
    const stationId = record.end?.place.stationId;
    const known = stationId ? newest.get(stationId) : undefined;

    if (stationId && (!known || endedAt(record) > endedAt(known))) {
      newest.set(stationId, record);
    }
  }

  return [...newest.values()];
};

const stationAt = (
  workspaceId: WorkspaceId,
  place: RunPlace,
): WatchedStation => ({
  workspaceId,
  teamId: place.teamId,
  lineId: place.lineId,
  stationId: place.stationId,
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
    return this.watch(stationAt(event.workspaceId, event.place));
  }

  runSettled(event: RunRecordSettled): Promise<void> {
    return this.watch(stationAt(event.workspaceId, event.place));
  }

  async deliveryClosed(event: TaskDeliveryClosed): Promise<void> {
    const records = await this.repositories.records.ofTasks([event.taskId]);

    for (const record of newestAtEachStation(records)) {
      if (record.end) {
        await this.watch(stationAt(event.workspaceId, record.end.place));
      }
    }
  }

  async lineRedefined(event: LineRedefined): Promise<void> {
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
      await this.repositories.forgotten.lockForgetting(
        workspaceId,
        null,
        teamId,
      );

      if (await this.repositories.forgotten.forgot(workspaceId, null, teamId)) {
        return;
      }

      const existing = await this.repositories.watches.of(station.stationId);

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
              last: max * UNSETTLED_SLACK,
            });
      const deliveries = await this.repositories.deliveries.forTasks(
        records.flatMap((each) => (each.taskId ? [each.taskId] : [])),
      );
      const readings = await this.unforgotten(
        station,
        rules.map((rule) => ({
          rule,
          reading: readingOf(rule, records, deliveries),
        })),
      );
      const watch = existing ?? StationWatch.start(station);
      const checked = watch.check(readings, this.clock.now(), () =>
        AlertId.of(this.ids.generate()),
      );

      if (checked === watch) {
        return;
      }

      await (existing
        ? this.repositories.watches.save(checked)
        : this.repositories.watches.add(checked));
    });
  }

  private async unforgotten(
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
    const forgotten = new Set<string>();

    for (const task of tasks) {
      const taskId = TaskId.of(task);

      await this.repositories.forgotten.lockForgetting(
        station.workspaceId,
        taskId,
        station.teamId,
      );

      if (
        await this.repositories.forgotten.forgot(
          station.workspaceId,
          taskId,
          station.teamId,
        )
      ) {
        forgotten.add(task);
      }
    }

    return readings.map((each) =>
      each.reading && forgotten.has(each.reading.taskId.value)
        ? { rule: each.rule, reading: null }
        : each,
    );
  }
}
