import {
  type InsightsRunsDto,
  insightsRunOf,
  namedOf,
  periodOf,
} from '@outcomes/application/dto/insights.dto';
import type { InsightsReaderPort } from '@outcomes/application/ports/insights-reader.port';
import type { PeoplePort } from '@outcomes/application/ports/people.port';
import { pageOf, sizeOf } from '@outcomes/application/queries/handlers/paging';
import type { ListInsightsRunsQuery } from '@outcomes/application/queries/list-insights-runs.query';
import {
  type TeamScopes,
  windowOf,
} from '@outcomes/application/services/team-scopes.service';
import { runFilterOf } from '@outcomes/domain/services/run-filter';
import { pageAskedOf, pageWithin } from '@outcomes/domain/services/run-page';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListInsightsRunsHandler
  implements QueryHandlerPort<ListInsightsRunsQuery, InsightsRunsDto>
{
  constructor(
    private readonly histories: TeamScopes,
    private readonly reader: InsightsReaderPort,
    private readonly people: PeoplePort,
  ) {}

  async execute(query: ListInsightsRunsQuery): Promise<InsightsRunsDto> {
    try {
      const { clearance, period } = await this.histories.scope(
        query.teamId,
        query.principal,
        query.period,
      );
      const filter = runFilterOf(query.filter, period.current);
      const size = sizeOf(query.size);
      const page = pageAskedOf(pageOf(query.page));
      const listed = await this.reader.runPage({
        window: windowOf(clearance, period.current),
        filter,
        offset: (page - 1) * size,
        limit: size,
      });

      pageWithin(page, listed.total, size);
      const runs = listed.runs.map(insightsRunOf);
      const ids = runs.flatMap((each) =>
        each.openedBy ? [each.openedBy] : [],
      );

      return {
        period: periodOf(period),
        total: listed.total,
        page,
        size,
        runs,
        people: namedOf(ids, await this.people.namesOf(ids)),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
