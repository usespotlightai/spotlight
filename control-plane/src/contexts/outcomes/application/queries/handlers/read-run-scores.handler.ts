import type { RunScoresDto } from '@outcomes/application/dto/run-scores.dto';
import type { ReadRunScoresQuery } from '@outcomes/application/queries/read-run-scores.query';
import type { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import type { RunScoresViews } from '@outcomes/application/services/run-scores-views.service';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
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
      const clearance = await this.access.clearance(
        query.teamId,
        query.viewerId,
      );

      return await this.views.of(
        clearance,
        await this.views.onTeam(clearance, query.runId),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
