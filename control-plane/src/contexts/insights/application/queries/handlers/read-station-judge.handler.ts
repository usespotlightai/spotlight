import { judgeCalibrationOf } from '@insights/application/dto/judge-calibration.dto';
import {
  rubricVersionOf,
  type StationJudgeDto,
} from '@insights/application/dto/station-judge.dto';
import type { ReadStationJudgeQuery } from '@insights/application/queries/read-station-judge.query';
import type { InsightsAccess } from '@insights/application/services/insights-access.service';
import type { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import type { ClaimsSourceRepository } from '@insights/domain/repositories/claims-source.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ReadStationJudgeHandler implements QueryHandlerPort<
  ReadStationJudgeQuery,
  StationJudgeDto
> {
  constructor(
    private readonly access: InsightsAccess,
    private readonly reports: StationJudgeReports,
    private readonly sources: ClaimsSourceRepository,
  ) {}

  async execute(query: ReadStationJudgeQuery): Promise<StationJudgeDto> {
    try {
      const access = await this.access.forTeam(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
      );
      const stationId = StationId.of(query.stationId);
      const { judge, report, calibration } = await this.reports.at({
        workspaceId: access.workspaceId,
        teamId: access.teamId,
        lineId: LineId.of(query.lineId),
        stationId,
      });
      const current = judge?.rubricVersion ?? null;
      const sources = new Map(
        (await this.sources.ofStation(stationId))
          .filter((each) => each.station.workspaceId.equals(access.workspaceId))
          .map((each) => [each.rubricVersion as string, each]),
      );

      return {
        stationId: query.stationId,
        judge: judge
          ? {
              rubricVersion: judge.rubricVersion,
              readable: judge.rubric !== null,
              claims: [...judge.claims],
              passThreshold: judge.passThreshold,
              sample: judge.sample,
              minAgreement: judge.minAgreement,
            }
          : null,
        calibration: judgeCalibrationOf(calibration),
        versions: report.versions.map((each) =>
          rubricVersionOf(
            each,
            current,
            calibration,
            sources.get(each.rubricVersion) ?? null,
          ),
        ),
        coverage: report.coverage,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
