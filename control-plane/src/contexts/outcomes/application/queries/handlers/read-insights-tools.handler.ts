import { periodOf } from '@outcomes/application/dto/insights.dto';
import type { InsightsToolsDto } from '@outcomes/application/dto/insights-tools.dto';
import type { InsightsReaderPort } from '@outcomes/application/ports/insights-reader.port';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import type { ReadInsightsToolsQuery } from '@outcomes/application/queries/read-insights-tools.query';
import type { TeamScopes } from '@outcomes/application/services/team-scopes.service';
import { weeksOf } from '@outcomes/domain/services/pull-request-insights';
import {
  TREND_MIN_RUNS,
  TREND_RECENT_WEEKS,
  TREND_SHIFT_POINTS,
} from '@outcomes/domain/services/skill-trend';
import { toolInsightsFrom } from '@outcomes/domain/services/tool-insights';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsToolsHandler
  implements QueryHandlerPort<ReadInsightsToolsQuery, InsightsToolsDto>
{
  constructor(
    private readonly scopes: TeamScopes,
    private readonly reader: InsightsReaderPort,
    private readonly work: WorkPort,
  ) {}

  async execute(query: ReadInsightsToolsQuery): Promise<InsightsToolsDto> {
    try {
      const { access, period } = await this.scopes.scope(
        query.teamId,
        query.principal,
        query.period,
      );
      const weeks = weeksOf(period.current);
      const counts = await this.reader.toolCounts({
        workspaceId: access.workspaceId,
        teamId: access.teamId,
        period,
      });

      return {
        period: periodOf(period),
        weeks,
        trendRule: {
          recentWeeks: TREND_RECENT_WEEKS,
          minRuns: TREND_MIN_RUNS,
          shiftPoints: TREND_SHIFT_POINTS,
        },
        ...toolInsightsFrom(
          counts,
          weeks,
          await this.work.teamSkillKeys(access.teamId.value),
        ),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
