import type { LineSettingsPort } from '@insights/application/ports/line-settings.port';
import { InvalidAlertError } from '@insights/domain/exceptions/invalid-alert.error';
import {
  type AlertMeasure,
  AlertRule,
} from '@insights/domain/value-objects/alert-rule.vo';
import type {
  AlertMeasureView,
  StationAlertView,
} from '@lines/application/contracts/line-view.contract';
import type { LinesPort } from '@lines/application/ports/lines.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const MEASURE: Readonly<Record<AlertMeasureView, AlertMeasure>> = {
  sent_back_rate: 'sent_back_rate',
  accepted_rate: 'accepted_rate',
  checks_failed_rate: 'checks_failed_rate',
  failed_rate: 'failed_rate',
  merged_rate: 'merged_rate',
  cost_per_run: 'cost_per_run',
};

export class Lines implements LineSettingsPort {
  constructor(
    private readonly lines: LinesPort,
    private readonly logger: LoggerPort,
  ) {}

  async alertsAt(stationId: string): Promise<readonly AlertRule[] | null> {
    const line = await this.lines.findByStation(stationId);
    const station = line?.stations.find((each) => each.id === stationId);

    return station
      ? station.alerts.flatMap((each) => this.ruleOf(stationId, each))
      : null;
  }

  async teamRepositories(teamId: string): Promise<readonly string[]> {
    const names = (await this.lines.ofTeam(teamId)).flatMap((line) =>
      line.repositories.map((each) => each.repository),
    );

    return [...new Set(names)];
  }

  private ruleOf(
    stationId: string,
    alert: StationAlertView,
  ): readonly AlertRule[] {
    try {
      return [
        AlertRule.of({
          measure: MEASURE[alert.measure],
          risesBy: alert.risesBy,
          above: alert.above,
          fallsBy: alert.fallsBy,
          below: alert.below,
          over: alert.over,
        }),
      ];
    } catch (error) {
      if (!(error instanceof InvalidAlertError)) {
        throw error;
      }

      this.logger.warn(
        { stationId, measure: alert.measure, reason: error.message },
        'Skipped a station alert that Insights cannot watch',
      );
      return [];
    }
  }
}
