import { periodOf } from '@outcomes/application/dto/insights.dto';
import type { InsightsToolsDto } from '@outcomes/application/dto/insights-tools.dto';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import type { ReadInsightsToolsQuery } from '@outcomes/application/queries/read-insights-tools.query';
import type { TeamHistories } from '@outcomes/application/services/team-histories.service';
import { weeksOf } from '@outcomes/domain/services/pull-request-insights';
import {
  TREND_FEWEST_RUNS,
  TREND_RECENT_WEEKS,
  TREND_SHIFT_POINTS,
} from '@outcomes/domain/services/skill-trend';
import { endedWithin } from '@outcomes/domain/services/team-history';
import { toolInsightsOf } from '@outcomes/domain/services/tool-insights';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsToolsHandler
  implements QueryHandlerPort<ReadInsightsToolsQuery, InsightsToolsDto>
{
  constructor(
    private readonly histories: TeamHistories,
    private readonly work: WorkPort,
  ) {}

  async execute(query: ReadInsightsToolsQuery): Promise<InsightsToolsDto> {
    try {
      const { clearance, period, history, truncated } = await this.histories.of(
        query.teamId,
        query.principal,
        query.period,
      );
      const weeks = weeksOf(period.current);

      return {
        period: periodOf(period),
        truncated,
        weeks,
        trendRule: {
          recentWeeks: TREND_RECENT_WEEKS,
          fewestRuns: TREND_FEWEST_RUNS,
          shiftPoints: TREND_SHIFT_POINTS,
        },
        ...toolInsightsOf(
          endedWithin(history.records, period.current),
          weeks,
          await this.work.teamSkillKeys(clearance.teamId.value),
        ),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
