import { periodOf } from '@insights/application/dto/insights.dto';
import type { InsightsAgentConfigsDto } from '@insights/application/dto/insights-changes.dto';
import { stationJudgeCalibrationOf } from '@insights/application/dto/judge-calibration.dto';
import type { InsightsReaderPort } from '@insights/application/ports/insights-reader.port';
import type { ReadInsightsAgentConfigsQuery } from '@insights/application/queries/read-insights-agent-configs.query';
import type { QualifiedJudges } from '@insights/application/services/qualified-judges.service';
import type { TeamScopes } from '@insights/application/services/team-scopes.service';
import {
  agentConfigsFrom,
  judgeOmittedFor,
  MIN_AGENT_CONFIG_RUNS,
} from '@insights/domain/services/agent-config-comparison';
import {
  requestedRunSizeOf,
  SIZE_BOUNDS,
} from '@insights/domain/services/run-size';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsAgentConfigsHandler
  implements
    QueryHandlerPort<ReadInsightsAgentConfigsQuery, InsightsAgentConfigsDto>
{
  constructor(
    private readonly scopes: TeamScopes,
    private readonly reader: InsightsReaderPort,
    private readonly judges: QualifiedJudges,
  ) {}

  async execute(
    query: ReadInsightsAgentConfigsQuery,
  ): Promise<InsightsAgentConfigsDto> {
    try {
      const size = requestedRunSizeOf(query.size);
      const { access, period } = await this.scopes.scope(
        query.teamId,
        query.principal,
        query.period,
      );
      const counts = await this.reader.agentConfigCounts(
        {
          workspaceId: access.workspaceId,
          teamId: access.teamId,
          period,
        },
        { stationId: query.stationId, size },
      );
      const judgeOmitted = judgeOmittedFor(query.stationId);
      const calibrations =
        query.stationId === null
          ? null
          : {
              stationId: query.stationId,
              ...(await this.judges.calibrations(access, counts.stations)),
            };
      const compared = agentConfigsFrom(
        counts.agentConfigs,
        calibrations
          ? {
              omitted: false,
              qualified:
                calibrations.qualified.get(calibrations.stationId) ?? null,
            }
          : { omitted: true },
      );

      return {
        period: periodOf(period),
        stationId: query.stationId,
        size,
        sizes: SIZE_BOUNDS,
        minRuns: MIN_AGENT_CONFIG_RUNS,
        currency: compared.currency,
        agentConfigs: compared.agentConfigs,
        judgeOmitted,
        judges: (calibrations?.judges ?? []).map(stationJudgeCalibrationOf),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
