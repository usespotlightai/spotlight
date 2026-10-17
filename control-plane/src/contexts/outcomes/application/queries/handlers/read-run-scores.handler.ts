import type { RunScoresDto } from '@outcomes/application/dto/run-scores.dto';
import type { ReadRunScoresQuery } from '@outcomes/application/queries/read-run-scores.query';
import type { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import type { RunScoresViews } from '@outcomes/application/services/run-scores-views.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ReadRunScoresHandler
  implements QueryHandlerPort<ReadRunScoresQuery, RunScoresDto>
{
  constructor(
    private readonly access: OutcomesAccess,
    private readonly views: RunScoresViews,
  ) {}

  async execute(query: ReadRunScoresQuery): Promise<RunScoresDto> {
    try {
      const access = await this.access.forTeam(query.teamId, query.viewerId);

      return await this.views.of(
        access,
        await this.views.onTeam(access, query.runId),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
