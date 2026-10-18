import type { StationAlertDto } from '@insights/application/dto/station-alert.dto';
import type { ReadStationAlertQuery } from '@insights/application/queries/read-station-alert.query';
import type { InsightsAccess } from '@insights/application/services/insights-access.service';
import { UnknownAlertError } from '@insights/domain/exceptions/unknown-alert.error';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import type { StationAlertStateRepository } from '@insights/domain/repositories/station-alert-state.repository';
import type { TaskPullRequestRepository } from '@insights/domain/repositories/task-pull-request.repository';
import { alertDeltaOf } from '@insights/domain/services/alert-change';
import { spendingOf } from '@insights/domain/services/measures';
import { measureAround } from '@insights/domain/services/station-measures';
import { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import type { AlertRule } from '@insights/domain/value-objects/alert-rule.vo';
import { InsightsPeriod } from '@insights/domain/value-objects/insights-period.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

const MAX_AROUND = 500;

const ruleOf = (rule: AlertRule) => {
  const at = (condition: AlertRule['condition']): number | null =>
    rule.condition === condition ? rule.threshold : null;

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
    private readonly access: InsightsAccess,
    private readonly alertStates: StationAlertStateRepository,
    private readonly records: RunRecordRepository,
    private readonly taskPullRequests: TaskPullRequestRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(query: ReadStationAlertQuery): Promise<StationAlertDto> {
    try {
      const access = await this.access.accessFor(query.teamId, query.principal);
      const alertId = AlertId.of(query.alertId);
      const alertState = await this.alertStates.ofAlert(alertId);
      const firing = alertState?.firing(alertId);

      if (
        !alertState ||
        !firing ||
        !alertState.station.teamId.equals(access.teamId) ||
        !alertState.station.workspaceId.equals(access.workspaceId)
      ) {
        throw new UnknownAlertError(query.alertId);
      }

      const { station } = alertState;
      const records = await this.records.lastAtStation({
        workspaceId: station.workspaceId,
        teamId: station.teamId,
        lineId: station.lineId,
        stationId: station.stationId,
        last: MAX_AROUND,
      });
      const taskPullRequests = await this.taskPullRequests.forTasks(
        records.flatMap((each) => (each.taskId ? [each.taskId] : [])),
      );

      return {
        alertId: firing.id.value,
        lineId: station.lineId,
        stationId: station.stationId,
        rule: ruleOf(firing.rule),
        value: firing.reading.value,
        baseline: firing.reading.baseline,
        change: alertDeltaOf(firing.rule.measure, firing.reading),
        runId: firing.runId.value,
        taskId: firing.taskId.value,
        firedAt: firing.firedAt.toISOString(),
        insightsPeriod: InsightsPeriod.covering(
          firing.firedAt,
          this.clock.now(),
        ),
        resolvedAt: firing.resolvedAt?.toISOString() ?? null,
        currency:
          spendingOf(records.map((each) => each.usage?.spend ?? null)).spend
            ?.currency ?? null,
        series: measureAround(
          firing.rule,
          { runId: firing.runId, value: firing.reading.value },
          records,
          taskPullRequests,
        ).map((each) => ({
          runId: each.runId,
          endedAt: each.endedAt.toISOString(),
          value: each.value,
        })),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
