import type { RunScoresDto } from '@insights/application/dto/run-scores.dto';
import type { ReadRunScoresQuery } from '@insights/application/queries/read-run-scores.query';
import type { InsightsAccess } from '@insights/application/services/insights-access.service';
import type { RunScoresViews } from '@insights/application/services/run-scores-views.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ReadRunScoresHandler
  implements QueryHandlerPort<ReadRunScoresQuery, RunScoresDto>
{
  constructor(
    private readonly access: InsightsAccess,
    private readonly views: RunScoresViews,
  ) {}

  async execute(query: ReadRunScoresQuery): Promise<RunScoresDto> {
    try {
      const access = await this.access.forTeam(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
      );

      return await this.views.of(
        access,
        await this.views.onTeam(access, query.runId),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
