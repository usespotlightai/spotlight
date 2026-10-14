import { periodOf } from '@outcomes/application/dto/insights.dto';
import type { InsightsToolsDto } from '@outcomes/application/dto/insights-tools.dto';
import type { InsightsReaderPort } from '@outcomes/application/ports/insights-reader.port';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import type { ReadInsightsToolsQuery } from '@outcomes/application/queries/read-insights-tools.query';
import type { TeamHistories } from '@outcomes/application/services/team-histories.service';
import { weeksOf } from '@outcomes/domain/services/pull-request-insights';
import {
  TREND_FEWEST_RUNS,
  TREND_RECENT_WEEKS,
  TREND_SHIFT_POINTS,
} from '@outcomes/domain/services/skill-trend';
import { toolInsightsFrom } from '@outcomes/domain/services/tool-insights';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsToolsHandler
  implements QueryHandlerPort<ReadInsightsToolsQuery, InsightsToolsDto>
{
  constructor(
    private readonly histories: TeamHistories,
    private readonly reader: InsightsReaderPort,
    private readonly work: WorkPort,
  ) {}

  async execute(query: ReadInsightsToolsQuery): Promise<InsightsToolsDto> {
    try {
      const { clearance, period } = await this.histories.scope(
        query.teamId,
        query.principal,
        query.period,
      );
      const weeks = weeksOf(period.current);
      const counts = await this.reader.toolCounts({
        workspaceId: clearance.workspaceId,
        teamId: clearance.teamId,
        period,
      });

      return {
        period: periodOf(period),
        truncated: false,
        weeks,
        trendRule: {
          recentWeeks: TREND_RECENT_WEEKS,
          fewestRuns: TREND_FEWEST_RUNS,
          shiftPoints: TREND_SHIFT_POINTS,
        },
        ...toolInsightsFrom(
          counts,
          weeks,
          await this.work.teamSkillKeys(clearance.teamId.value),
        ),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
