import type { StationAlertDto } from '@outcomes/application/dto/station-alert.dto';
import type { ReadStationAlertQuery } from '@outcomes/application/queries/read-station-alert.query';
import type { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import { UnknownAlertError } from '@outcomes/domain/exceptions/unknown-alert.error';
import type { RunRecordRepository } from '@outcomes/domain/repositories/run-record.repository';
import type { StationWatchRepository } from '@outcomes/domain/repositories/station-watch.repository';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import { spendingOf } from '@outcomes/domain/services/measures';
import { measureAround } from '@outcomes/domain/services/station-measures';
import { AlertId } from '@outcomes/domain/value-objects/alert-id.vo';
import type { AlertRule } from '@outcomes/domain/value-objects/alert-rule.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

const MOST_AROUND = 500;

const thresholdOf = (rule: AlertRule) => {
  const at = (threshold: AlertRule['threshold']): number | null =>
    rule.threshold === threshold ? rule.amount : null;

  return {
    measure: rule.measure,
    risesBy: at('risesBy'),
    fallsBy: at('fallsBy'),
    above: at('above'),
    below: at('below'),
    over: rule.over,
  };
};

export class ReadStationAlertHandler
  implements QueryHandlerPort<ReadStationAlertQuery, StationAlertDto>
{
  constructor(
    private readonly access: OutcomesAccess,
    private readonly watches: StationWatchRepository,
    private readonly records: RunRecordRepository,
    private readonly deliveries: TaskDeliveryRepository,
  ) {}

  async execute(query: ReadStationAlertQuery): Promise<StationAlertDto> {
    try {
      const clearance = await this.access.clearanceFor(
        query.teamId,
        query.principal,
      );
      const alertId = AlertId.of(query.alertId);
      const watch = await this.watches.raising(alertId);
      const crossing = watch?.crossing(alertId);

      if (
        !watch ||
        !crossing ||
        !watch.station.teamId.equals(clearance.teamId) ||
        !watch.station.workspaceId.equals(clearance.workspaceId)
      ) {
        throw new UnknownAlertError(query.alertId);
      }

      const { station } = watch;
      const records = await this.records.lastAtStation({
        workspaceId: station.workspaceId,
        teamId: station.teamId,
        lineId: station.lineId,
        stationId: station.stationId,
        last: MOST_AROUND,
      });
      const deliveries = await this.deliveries.forTasks(
        records.flatMap((each) => (each.taskId ? [each.taskId] : [])),
      );

      return {
        alertId: crossing.id.value,
        lineId: station.lineId,
        stationId: station.stationId,
        threshold: thresholdOf(crossing.rule),
        value: crossing.reading.value,
        baseline: crossing.reading.baseline,
        runId: crossing.runId.value,
        taskId: crossing.taskId.value,
        raisedAt: crossing.raisedAt.toISOString(),
        recoveredAt: crossing.recoveredAt?.toISOString() ?? null,
        currency:
          spendingOf(records.map((each) => each.cost?.spend ?? null)).spend
            ?.currency ?? null,
        series: measureAround(
          crossing.rule,
          { runId: crossing.runId, value: crossing.reading.value },
          records,
          deliveries,
        ).map((each) => ({
          runId: each.runId,
          endedAt: each.endedAt.toISOString(),
          value: each.value,
        })),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
