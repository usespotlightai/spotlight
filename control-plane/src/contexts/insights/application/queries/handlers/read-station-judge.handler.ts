import { judgeCalibrationOf } from '@insights/application/dto/judge-calibration.dto';
import {
  rubricVersionOf,
  type StationJudgeDto,
} from '@insights/application/dto/station-judge.dto';
import type { ReadStationJudgeQuery } from '@insights/application/queries/read-station-judge.query';
import type { InsightsAccess } from '@insights/application/services/insights-access.service';
import type { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export class ReadStationJudgeHandler
  implements QueryHandlerPort<ReadStationJudgeQuery, StationJudgeDto>
{
  constructor(
    private readonly access: InsightsAccess,
    private readonly reports: StationJudgeReports,
  ) {}

  async execute(query: ReadStationJudgeQuery): Promise<StationJudgeDto> {
    try {
      const access = await this.access.forTeam(query.teamId, query.viewerId);
      const { judge, report, calibration } = await this.reports.at({
        workspaceId: access.workspaceId,
        teamId: access.teamId,
        lineId: LineId.of(query.lineId),
        stationId: StationId.of(query.stationId),
      });
      const current = judge?.rubricVersion ?? null;

      return {
        stationId: query.stationId,
        judge: judge
          ? {
              rubricVersion: judge.rubricVersion,
              kind: judge.scale?.kind ?? null,
              claims: [...judge.claims],
              passThreshold: judge.passThreshold,
              sample: judge.sample,
              minAgreement: judge.minAgreement,
            }
          : null,
        calibration: judgeCalibrationOf(calibration),
        versions: report.versions.map((each) =>
          rubricVersionOf(each, current, calibration),
        ),
        coverage: report.coverage,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
