import {
  adoptionDtoOf,
  humanLoadDtoOf,
  type InsightsPeopleDto,
  periodOf,
} from '@outcomes/application/dto/insights.dto';
import type { FirstSeenPort } from '@outcomes/application/ports/first-seen.port';
import type { PeoplePort } from '@outcomes/application/ports/people.port';
import type { ReadInsightsPeopleQuery } from '@outcomes/application/queries/read-insights-people.query';
import type { TeamHistories } from '@outcomes/application/services/team-histories.service';
import {
  activitiesOf,
  adoptionOf,
  peopleActiveIn,
} from '@outcomes/domain/services/adoption';
import {
  humanLoadChangesOf,
  humanLoadOf,
} from '@outcomes/domain/services/human-load';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsPeopleHandler
  implements QueryHandlerPort<ReadInsightsPeopleQuery, InsightsPeopleDto>
{
  constructor(
    private readonly histories: TeamHistories,
    private readonly firstSeen: FirstSeenPort,
    private readonly people: PeoplePort,
  ) {}

  async execute(query: ReadInsightsPeopleQuery): Promise<InsightsPeopleDto> {
    try {
      const { clearance, period, history, truncated } = await this.histories.of(
        query.teamId,
        query.principal,
        query.period,
      );
      const active = peopleActiveIn(activitiesOf(history), period.current);
      const adoption = adoptionOf(
        history,
        period,
        await this.firstSeen.onTeam(
          clearance.workspaceId,
          clearance.teamId,
          active,
        ),
      );
      const names = await this.people.namesOf(active);
      const load = humanLoadOf(history, period.current);

      return {
        period: periodOf(period),
        truncated,
        load: humanLoadDtoOf(load),
        loadChanges: humanLoadChangesOf(
          load,
          humanLoadOf(history, period.previous),
        ),
        adoption: adoptionDtoOf(adoption, names),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
