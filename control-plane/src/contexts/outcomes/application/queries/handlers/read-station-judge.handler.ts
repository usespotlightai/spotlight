import {
  rubricVersionOf,
  type StationJudgeDto,
} from '@outcomes/application/dto/station-judge.dto';
import type { ReadStationJudgeQuery } from '@outcomes/application/queries/read-station-judge.query';
import type { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import type { StationJudgeReports } from '@outcomes/application/services/station-judge-reports.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadStationJudgeHandler
  implements QueryHandlerPort<ReadStationJudgeQuery, StationJudgeDto>
{
  constructor(
    private readonly access: OutcomesAccess,
    private readonly reports: StationJudgeReports,
  ) {}

  async execute(query: ReadStationJudgeQuery): Promise<StationJudgeDto> {
    try {
      const access = await this.access.forTeam(query.teamId, query.viewerId);
      const { judge, report, standing } = await this.reports.at({
        workspaceId: access.workspaceId,
        teamId: access.teamId,
        lineId: query.lineId,
        stationId: query.stationId,
      });
      const current = judge?.rubricVersion ?? null;

      return {
        stationId: query.stationId,
        judge: judge
          ? {
              rubricVersion: judge.rubricVersion,
              kind: judge.scale?.kind ?? null,
              claims: [...judge.claims],
              passShare: judge.passShare,
              sample: judge.sample,
              trust: judge.trust,
            }
          : null,
        standing,
        versions: report.versions.map((each) =>
          rubricVersionOf(each, current, standing),
        ),
        coverage: report.coverage,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
