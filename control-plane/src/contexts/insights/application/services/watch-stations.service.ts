import type { LineSettingsPort } from '@insights/application/ports/line-settings.port';
import type { StationFactsPort } from '@insights/application/ports/station-facts.port';
import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import {
  type RuleReading,
  StationAlertState,
  type WatchedStation,
} from '@insights/domain/aggregates/station-alert-state.aggregate';
import type { PullRequestRecordClosed } from '@insights/domain/events/pull-request-record-closed.event';
import type { RunOutcomeChanged } from '@insights/domain/events/run-outcome-changed.event';
import type { RunRecordEnded } from '@insights/domain/events/run-record-ended.event';
import type { StationAlertStateRepository } from '@insights/domain/repositories/station-alert-state.repository';
import {
  readingOf,
  runsToReadFor,
} from '@insights/domain/services/station-measures';
import { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface WatchSources {
  readonly facts: StationFactsPort;
  readonly alertStates: StationAlertStateRepository;
}

export interface LineChanged {
  readonly lineId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly stationIds: readonly string[];
}

const endedAt = (fact: RunFact): number => fact.end.endedAt.getTime();

const newestAtEachStation = (facts: readonly RunFact[]): readonly RunFact[] => {
  const newest = new Map<string, RunFact>();

  for (const fact of facts) {
    const stationId = fact.end.location.stationId.value;
    const known = newest.get(stationId);

    if (!known || endedAt(fact) > endedAt(known)) {
      newest.set(stationId, fact);
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
    private readonly lines: LineSettingsPort,
    private readonly sources: WatchSources,
    private readonly recorder: FactRecorder,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  runEnded(event: RunRecordEnded): Promise<void> {
    return this.watch(stationAt(event.workspaceId, event.location));
  }

  outcomeChanged(event: RunOutcomeChanged): Promise<void> {
    return this.watch(stationAt(event.workspaceId, event.location));
  }

  async pullRequestClosed(event: PullRequestRecordClosed): Promise<void> {
    const facts = await this.sources.facts.ofTasks([event.taskId]);

    for (const fact of newestAtEachStation(facts)) {
      await this.watch(stationAt(event.workspaceId, fact.end.location));
    }
  }

  async lineChanged(event: LineChanged): Promise<void> {
    for (const stationId of event.stationIds) {
      await this.watch({
        workspaceId: WorkspaceId.of(event.workspaceId),
        teamId: TeamId.of(event.teamId),
        lineId: LineId.of(event.lineId),
        stationId: StationId.of(stationId),
      });
    }
  }

  private async watch(station: WatchedStation): Promise<void> {
    const { workspaceId, teamId } = station;
    const rules = (await this.lines.alertsAt(station.stationId)) ?? [];

    await this.transaction.inTransaction(async () => {
      if (
        !(await this.recorder.admits(FactOwner.of(workspaceId, { teamId })))
      ) {
        return;
      }

      const existing = await this.sources.alertStates.of(station.stationId);

      if (!existing && rules.length === 0) {
        return;
      }

      const last = runsToReadFor(rules);
      const facts =
        last === 0
          ? []
          : await this.sources.facts.lastEndedAt({
              workspaceId,
              teamId,
              lineId: station.lineId,
              stationId: station.stationId,
              last,
            });
      const readings = await this.notDeleted(
        station,
        rules.map((rule) => ({
          rule,
          reading: readingOf(rule, facts),
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
        ? this.sources.alertStates.save(checked)
        : this.sources.alertStates.add(checked));
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
      const owner = FactOwner.of(station.workspaceId, {
        teamId: station.teamId,
        taskId: TaskId.of(task),
      });

      if (!(await this.recorder.admits(owner))) {
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
