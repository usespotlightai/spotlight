import {
  rubricVersionOf,
  type StationJudgeDto,
} from '@outcomes/application/dto/station-judge.dto';
import type { ReadStationJudgeQuery } from '@outcomes/application/queries/read-station-judge.query';
import type { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import type { StationJudgeReports } from '@outcomes/application/services/station-judge-reports.service';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
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
      const clearance = await this.access.clearance(
        query.teamId,
        query.viewerId,
      );
      const { judge, report, standing } = await this.reports.at({
        workspaceId: clearance.workspaceId,
        teamId: clearance.teamId,
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
      rethrowAsFault(error);
    }
  }
}
