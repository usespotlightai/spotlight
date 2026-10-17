import {
  adoptionDtoOf,
  humanLoadDtoOf,
  type InsightsPeopleDto,
  periodOf,
} from '@outcomes/application/dto/insights.dto';
import type { FirstSeenPort } from '@outcomes/application/ports/first-seen.port';
import type { InsightsReaderPort } from '@outcomes/application/ports/insights-reader.port';
import type { PeoplePort } from '@outcomes/application/ports/people.port';
import type { ReadInsightsPeopleQuery } from '@outcomes/application/queries/read-insights-people.query';
import type { TeamScopes } from '@outcomes/application/services/team-scopes.service';
import { adoptionFrom } from '@outcomes/domain/services/adoption';
import {
  humanLoadChangesOf,
  humanLoadFrom,
} from '@outcomes/domain/services/human-load';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadInsightsPeopleHandler
  implements QueryHandlerPort<ReadInsightsPeopleQuery, InsightsPeopleDto>
{
  constructor(
    private readonly scopes: TeamScopes,
    private readonly reader: InsightsReaderPort,
    private readonly firstSeen: FirstSeenPort,
    private readonly people: PeoplePort,
  ) {}

  async execute(query: ReadInsightsPeopleQuery): Promise<InsightsPeopleDto> {
    try {
      const { access, period } = await this.scopes.scope(
        query.teamId,
        query.principal,
        query.period,
      );
      const counts = await this.reader.peopleCounts({
        workspaceId: access.workspaceId,
        teamId: access.teamId,
        period,
      });
      const active = counts.adoption.people.map((each) => each.personId);
      const adoption = adoptionFrom(
        counts.adoption,
        period,
        await this.firstSeen.onTeam(access.workspaceId, access.teamId, active),
      );
      const names = await this.people.namesOf(active);
      const load = humanLoadFrom(counts.load.current);

      return {
        period: periodOf(period),
        load: humanLoadDtoOf(load),
        loadChanges: humanLoadChangesOf(
          load,
          humanLoadFrom(counts.load.previous),
        ),
        adoption: adoptionDtoOf(adoption, names),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
